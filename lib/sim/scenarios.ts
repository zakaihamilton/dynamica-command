import type { Rng } from "../seed/rng";
import type { GeneratedMap } from "../gen/map";
import type {
  MissionDef,
  MissionRuntime,
  SimEvent,
  SimState,
  Vec2,
} from "../types";
import { secondaryObjectivesForMission } from "../gen/objectives";
import { inObjectiveZone, RESCUE_CONTACT_RADIUS } from "../types";
import { CONVOY_STAGING_TICKS } from "../gen/pacing";
import { PATH_DIRS, diagonalCornerBlocked, routePendingFor } from "./pathfinding";
import { tryFindPathDetailed } from "./pathBudget";
import { canClimb, inBounds, isStaticWalkable, isWalkable, spawnBuildingAt, spawnUnit } from "./world";

export { CONVOY_STAGING_TICKS };

/** Adds scenario targets and common runtime metadata to a freshly spawned mission. */
export function configureMissionScenario(
  state: SimState,
  map: GeneratedMap,
  mission: MissionDef,
  rng: Rng,
): void {
  const enemyStart = map.enemyStart;

  if (mission.win.kind === "destroyMarked") {
    const ids: number[] = [];
    const spots = map.markedSpots.length
      ? map.markedSpots
      : [
          { x: enemyStart.x - 4, y: enemyStart.y - 6 },
          { x: enemyStart.x + 2, y: enemyStart.y - 6 },
        ];
    const count = mission.win.targetCount ?? 1;
    for (let i = 0; i < count; i++) {
      const spot = spots[i] ?? { x: enemyStart.x - 4 - i * 3, y: enemyStart.y - 6 };
      const kind = rng.pick(["refinery", "factory", "objective"] as const);
      const placed = spawnBuildingAt(
        state,
        1,
        kind === "refinery" ? "objective" : kind,
        spot.x,
        spot.y,
        0,
        true,
      );
      if (placed) ids.push(placed.id);
    }
    state.win.targetIds = ids;
  }

  if (["escort", "sabotage", "rescue", "extraction"].includes(mission.win.kind)) {
    const kind = mission.win.kind;
    const targetIds: number[] = [];
    const count = mission.win.targetCount ?? 2;
    const scenarioReachability = kind === "sabotage" ? undefined : reachableScenarioCells(state);
    const rescueRoute = kind === "rescue"
      ? { start: map.playerStart, end: map.enemyStart, min: 0.55, max: 0.8 }
      : undefined;
    if (kind === "sabotage") {
      for (let i = 0; i < count; i++) {
        const spot = map.markedSpots[i] ?? { x: enemyStart.x - 4 - i * 3, y: enemyStart.y - 5 + (i % 2) * 2 };
        const objective = spawnBuildingAt(state, 1, "objective", spot.x, spot.y, 0, true);
        if (objective) targetIds.push(objective.id);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const desired = kind === "escort"
          ? convoyStartPoint(map, i)
          : kind === "rescue"
            ? rescuePoint(map, i, count)
            : centerPoint(map, i, count);
        const point = reachableScenarioPoint(state, desired, scenarioReachability, rescueRoute);
        const target = spawnUnit(state, 0, kind === "escort" ? "convoyTruck" : "infantry", point.x, point.y);
        target.neutral = kind === "escort" || kind === "rescue" || kind === "extraction";
        target.scenarioRole = kind === "escort" ? "convoy" : kind === "rescue" ? "stranded" : "cargo";
        if (kind === "extraction") target.marked = true;
        if (kind === "escort" || kind === "extraction") {
          target.maxHp *= 12;
          target.hp = target.maxHp;
        }
        targetIds.push(target.id);
      }
    }
    const runtime: MissionRuntime = {
      kind,
      phase: "active",
      targetIds,
      convoyStartTick: kind === "escort" ? CONVOY_STAGING_TICKS : undefined,
      zone: kind === "escort" ? map.enemyStart : map.playerStart,
      deadline: state.tick + (mission.win.ticks ?? 3600) + (kind === "escort" ? CONVOY_STAGING_TICKS : 0),
      rescued: 0,
      required: count,
      secondary: secondaryObjectivesForMission(mission, rng),
    };
    state.runtime = runtime;
    state.win.targetIds = targetIds;
  }

  if (!state.runtime) {
    state.runtime = {
      kind: mission.win.kind,
      phase: "active",
      targetIds: state.win.targetIds ?? mission.win.targetIds ?? [],
      rescued: 0,
      required: mission.win.targetCount ?? 1,
      secondary: secondaryObjectivesForMission(mission, rng),
    };
  }
}

function centerPoint(map: Pick<GeneratedMap, "playerStart" | "enemyStart">, index: number, count: number): Vec2 {
  const t = (index + 1) / (count + 1);
  return {
    x: Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * t),
    y: Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * t),
  };
}

function rescuePoint(map: Pick<GeneratedMap, "playerStart" | "enemyStart">, index: number, count: number): Vec2 {
  const t = 0.55 + (index / Math.max(1, count - 1)) * 0.25;
  return {
    x: Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * t),
    y: Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * t),
  };
}

function reachableScenarioCells(state: SimState): Uint8Array | undefined {
  const origin = state.entities.find((entity) => entity.owner === 0 && entity.class === "unit" && !entity.neutral);
  if (!origin) return undefined;

  const seen = new Uint8Array(state.width * state.height);
  const queue: Vec2[] = [{ x: Math.round(origin.x), y: Math.round(origin.y) }];
  const start = queue[0]!;
  seen[start.y * state.width + start.x] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    for (const dir of PATH_DIRS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      if (!inBounds(state, next.x, next.y)) continue;
      const index = next.y * state.width + next.x;
      if (seen[index] || !isStaticWalkable(state, next.x, next.y)) continue;
      if (!canClimb(state, current.x, current.y, next.x, next.y)) continue;
      if (diagonalCornerBlocked(state, current.x, current.y, next.x, next.y)) continue;
      seen[index] = 1;
      queue.push(next);
    }
  }
  return seen;
}

function reachableScenarioPoint(
  state: SimState,
  desired: Vec2,
  seen?: Uint8Array,
  routeBand?: { start: Vec2; end: Vec2; min: number; max: number },
): Vec2 {
  if (!seen) return desired;
  let best: Vec2 | undefined;
  let bestDistance = Infinity;
  let bestInBand: Vec2 | undefined;
  let bestInBandDistance = Infinity;
  const routeDx = (routeBand?.end.x ?? 0) - (routeBand?.start.x ?? 0);
  const routeDy = (routeBand?.end.y ?? 0) - (routeBand?.start.y ?? 0);
  const routeLengthSquared = routeDx * routeDx + routeDy * routeDy;
  const routeLength = Math.sqrt(routeLengthSquared);
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!seen[y * state.width + x] || !isWalkable(state, x, y)) continue;
      const distance = Math.hypot(x - desired.x, y - desired.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
      if (!routeBand || routeLengthSquared === 0) continue;
      const fromStartX = x - routeBand.start.x;
      const fromStartY = y - routeBand.start.y;
      const progress = (fromStartX * routeDx + fromStartY * routeDy) / routeLengthSquared;
      const distanceFromStart = Math.hypot(fromStartX, fromStartY);
      if (progress < routeBand.min || progress > routeBand.max) continue;
      if (distanceFromStart < routeLength * routeBand.min || distanceFromStart > routeLength * routeBand.max) continue;
      if (distance < bestInBandDistance) {
        bestInBandDistance = distance;
        bestInBand = { x, y };
      }
    }
  }
  return bestInBand ?? best ?? desired;
}

function convoyStartPoint(map: Pick<GeneratedMap, "playerStart" | "enemyStart" | "width" | "height">, index: number): Vec2 {
  const offsets = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
  ];
  const offset = offsets[index % offsets.length]!;
  const routeT = 0.4;
  const anchorX = Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * routeT);
  const anchorY = Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * routeT);
  return {
    x: Math.max(2, Math.min(map.width - 3, anchorX + offset.x)),
    y: Math.max(2, Math.min(map.height - 3, anchorY + offset.y)),
  };
}

function convoyDestination(state: SimState, zone: Vec2, index: number): Vec2 {
  const candidates: Vec2[] = [];
  for (let radius = 1; radius <= 5; radius++) {
    for (let y = zone.y - radius; y <= zone.y + radius; y++) {
      for (let x = zone.x - radius; x <= zone.x + radius; x++) {
        if (Math.hypot(x - zone.x, y - zone.y) > 5 || !isStaticWalkable(state, x, y)) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length >= 4) break;
  }
  return candidates[index % candidates.length] ?? zone;
}

export function tickScenario(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const runtime = state.runtime;
  if (!runtime || runtime.phase === "complete") return events;
  const yard = state.entities.find((e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0);
  if (runtime.kind === "extraction" && yard) {
    runtime.zone = { x: yard.x, y: yard.y };
  }
  if (runtime.kind === "rescue" || runtime.kind === "extraction") {
    const rescuers = state.entities.filter(
      (e) => e.owner === 0 && e.class === "unit" && e.hp > 0 && !e.neutral,
    );
    for (const id of runtime.targetIds) {
      const e = state.entities.find((item) => item.id === id && item.hp > 0);
      if (!e?.neutral) continue;
      e.path = [];
      e.routePending = false;
      e.idle = true;
      if (rescuers.some((rescuer) => Math.hypot(rescuer.x - e.x, rescuer.y - e.y) <= RESCUE_CONTACT_RADIUS)) {
        e.neutral = false;
        if (runtime.kind === "rescue") runtime.rescued += 1;
        if (runtime.kind === "extraction") runtime.phase = "extraction";
      }
    }
  }
  if (runtime.kind === "escort" && runtime.convoyStartTick !== undefined && state.tick >= runtime.convoyStartTick) {
    for (const [index, id] of runtime.targetIds.entries()) {
      const convoy = state.entities.find((entity) => entity.id === id && entity.hp > 0);
      if (convoy?.scenarioRole === "convoy" && convoy.neutral) {
        const destination = convoyDestination(state, state.runtime!.zone!, index);
        convoy.orderDestination = destination;
        const result = tryFindPathDetailed(state, convoy, destination);
        if (result) {
          convoy.path = result.path;
          convoy.routePending = routePendingFor(result.status);
        } else {
          convoy.path = [];
          convoy.routePending = true;
        }
      }
    }
    delete runtime.convoyStartTick;
  }
  if (runtime.kind === "escort" || runtime.kind === "extraction") {
    const zone = runtime.zone;
    if (zone) {
      if (runtime.kind === "extraction") {
        const extracted = new Set(runtime.extractedIds ?? []);
        for (const id of runtime.targetIds) {
          if (extracted.has(id)) continue;
          const e = state.entities.find((item) => item.id === id && item.hp > 0);
          if (!e || e.neutral || !inObjectiveZone(e.x, e.y, zone)) continue;
          extracted.add(id);
          e.marked = false;
        }
        runtime.extractedIds = [...extracted];
        runtime.rescued = extracted.size;
      } else {
        runtime.rescued = runtime.targetIds.filter((id) => {
          const e = state.entities.find((item) => item.id === id && item.hp > 0);
          return !!e && inObjectiveZone(e.x, e.y, zone);
        }).length;
      }
    }
  }
  const preserve = runtime.secondary.find((objective) => objective.kind === "preserveYard");
  if (preserve) preserve.completed = !!yard;
  const timed = runtime.secondary.find((objective) => objective.kind === "completeBefore");
  if (timed && timed.target !== undefined) timed.completed = state.tick < timed.target;
  const keepUnits = runtime.secondary.find((objective) => objective.kind === "keepUnits");
  if (keepUnits) keepUnits.completed = state.entities.some((entity) => entity.owner === 0 && entity.class === "unit" && entity.hp > 0 && !entity.neutral);
  return events;
}
