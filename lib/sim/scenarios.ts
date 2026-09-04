import type { Rng } from "../seed/rng";
import type { GeneratedMap } from "../gen/map";
import { footprintOf } from "../catalog";
import type {
  BuildingKind,
  MissionDef,
  MissionRuntime,
  SimEvent,
  SimState,
  Vec2,
} from "../types";
import { secondaryObjectivesForMission } from "../gen/objectives";
import { inObjectiveZone, OBJECTIVE_ZONE_RADIUS, RESCUE_CONTACT_RADIUS } from "../types";
import { CONVOY_COMPLETION_BUFFER_TICKS, CONVOY_STAGING_TICKS } from "../gen/pacing";
import { resolveMissionProfile } from "../gen/profile";
import { PATH_DIRS, diagonalCornerBlocked, findPathDetailed, routePendingFor } from "./pathfinding";
import { tryFindPathDetailed } from "./pathBudget";
import { canClimb, distToEntity, inBounds, isStaticWalkable, isWalkable, spawnBuildingAt, spawnUnit } from "./world";

export { CONVOY_COMPLETION_BUFFER_TICKS, CONVOY_STAGING_TICKS };

export type ScenarioAffordances = {
  targetDepth: number;
  routeLength: number;
  targetReachable: boolean;
};

/** Adds scenario targets and common runtime metadata to a freshly spawned mission. */
export function configureMissionScenario(
  state: SimState,
  map: GeneratedMap,
  mission: MissionDef,
  rng: Rng,
): void {
  const profile = resolveMissionProfile(state.seed, mission.index, mission.win.kind, mission.profile);
  const scenarioReachability = reachableScenarioCells(state);

  if (mission.win.kind === "destroyMarked") {
    const ids: number[] = [];
    const spots = map.markedSpots.length
      ? map.markedSpots
      : [
          enemyApproachPoint(map, 6, -2),
          enemyApproachPoint(map, 6, 2),
        ];
    const count = mission.win.targetCount ?? 1;
    for (let i = 0; i < count; i++) {
      const spot = spots[i] ?? enemyApproachPoint(map, 6 + i * 3, i % 2 === 0 ? -2 : 2);
      const kind = rng.pick(["refinery", "factory", "objective"] as const);
      const buildingKind = kind === "refinery" ? "objective" : kind;
      const placed = spawnBuildingAt(
        state,
        1,
        buildingKind,
        spot.x,
        spot.y,
        0,
        true,
        reachableBuildingFilter(state, buildingKind, scenarioReachability),
      );
      if (placed) ids.push(placed.id);
    }
    state.win.targetIds = ids;
  }

  if (["escort", "sabotage", "rescue", "extraction"].includes(mission.win.kind)) {
    const kind = mission.win.kind;
    const targetIds: number[] = [];
    const contestedRoute = profile.variant === "contestedRoute";
    const count = mission.win.targetCount ?? 2;
    const rescueRoute = kind === "rescue"
      ? {
          start: map.playerStart,
          end: map.enemyStart,
          min: 0.55,
          max: 0.8,
        }
      : undefined;
    if (kind === "sabotage") {
      for (let i = 0; i < count; i++) {
        const depth = contestedRoute ? 6 : 4;
        const spacing = contestedRoute ? 4 : 3;
        const spot = map.markedSpots[i] ?? enemyApproachPoint(map, depth + i * spacing, i % 2 === 0 ? -2 : 2);
        const objective = spawnBuildingAt(
          state,
          1,
          "objective",
          spot.x,
          spot.y,
          0,
          true,
          reachableBuildingFilter(state, "objective", scenarioReachability),
        );
        if (objective) targetIds.push(objective.id);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const desired = kind === "escort"
          ? convoyStartPoint(map, i)
          : kind === "rescue"
            ? rescuePoint(map, i, count)
          : centerPoint(map, i, count, contestedRoute);
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
      // Escort missions terminate at a route-side extraction point rather
      // than sending the convoy into the enemy base. This keeps the convoy
      // objective distinct from an assault while preserving a reachable
      // destination on the same operational lanes.
      zone: kind === "escort"
        ? convoyZonePoint(state, map, contestedRoute, scenarioReachability)
        : map.playerStart,
      deadline: state.tick + (mission.win.ticks ?? 3600) + (kind === "escort" ? CONVOY_STAGING_TICKS + CONVOY_COMPLETION_BUFFER_TICKS : 0),
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

/** Measures the generated scenario without adding metadata to persisted state. */
export function scenarioAffordances(state: SimState): ScenarioAffordances {
  const playerYard = state.entities.find(
    (entity) => entity.owner === 0 && entity.class === "building" && entity.kind === "constructionYard" && entity.hp > 0,
  );
  const enemyYard = state.entities.find(
    (entity) => entity.owner === 1 && entity.class === "building" && entity.kind === "constructionYard" && entity.hp > 0,
  );
  const targetId = state.runtime?.targetIds[0];
  const target = targetId === undefined
    ? enemyYard
    : state.entities.find((entity) => entity.id === targetId);
  if (!playerYard || !target) return { targetDepth: 0, routeLength: 0, targetReachable: false };
  const route = findPathDetailed(state, playerYard, target);
  const baseDistance = enemyYard ? Math.max(1, Math.hypot(enemyYard.x - playerYard.x, enemyYard.y - playerYard.y)) : 1;
  const targetDistance = Math.hypot(target.x - playerYard.x, target.y - playerYard.y);
  return {
    targetDepth: Math.min(1, targetDistance / baseDistance),
    routeLength: route.status === "complete" ? route.path.length : 0,
    targetReachable: route.status === "complete",
  };
}

function centerPoint(
  map: Pick<GeneratedMap, "playerStart" | "enemyStart">,
  index: number,
  count: number,
  contested: boolean,
): Vec2 {
  const base = (index + 1) / (count + 1);
  const t = contested ? Math.min(0.78, base + 0.12) : base;
  return {
    x: Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * t),
    y: Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * t),
  };
}

function rescuePoint(
  map: Pick<GeneratedMap, "playerStart" | "enemyStart">,
  index: number,
  count: number,
): Vec2 {
  // Rescue missions already place the stranded units on a visible route band.
  // Keep the contested profile's extra risk in the approach lanes and alerts,
  // rather than pushing the rescue targets deeper and starving the base guard.
  const t = 0.55 + (index / Math.max(1, count - 1)) * 0.25;
  return {
    x: Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * t),
    y: Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * t),
  };
}

function enemyApproachPoint(
  map: Pick<GeneratedMap, "playerStart" | "enemyStart" | "width" | "height">,
  distance: number,
  lateralOffset: number,
): Vec2 {
  const towardPlayer = {
    x: Math.sign(map.playerStart.x - map.enemyStart.x),
    y: Math.sign(map.playerStart.y - map.enemyStart.y),
  };
  const lateral = { x: -towardPlayer.y, y: towardPlayer.x };
  return {
    x: Math.max(2, Math.min(map.width - 3, Math.round(map.enemyStart.x + towardPlayer.x * distance + lateral.x * lateralOffset))),
    y: Math.max(2, Math.min(map.height - 3, Math.round(map.enemyStart.y + towardPlayer.y * distance + lateral.y * lateralOffset))),
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

function reachableBuildingFilter(
  state: SimState,
  kind: BuildingKind,
  seen: Uint8Array | undefined,
): ((x: number, y: number) => boolean) | undefined {
  if (!seen) return undefined;
  const footprint = footprintOf(kind);
  return (x, y) => {
    for (let py = y - 1; py <= y + footprint.h; py++) {
      for (let px = x - 1; px <= x + footprint.w; px++) {
        const inside = px >= x && px < x + footprint.w && py >= y && py < y + footprint.h;
        if (inside || !inBounds(state, px, py) || !isStaticWalkable(state, px, py)) continue;
        if (seen[py * state.width + px] === 1) return true;
      }
    }
    return false;
  };
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

function convoyStartPoint(
  map: Pick<GeneratedMap, "playerStart" | "width" | "height">,
  index: number,
): Vec2 {
  const offsets = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
  ];
  const offset = offsets[index % offsets.length]!;
  const anchorX = Math.round(map.playerStart.x);
  const anchorY = Math.round(map.playerStart.y);
  return {
    x: Math.max(2, Math.min(map.width - 3, anchorX + offset.x)),
    y: Math.max(2, Math.min(map.height - 3, anchorY + offset.y)),
  };
}

function convoyZonePoint(
  state: SimState,
  map: Pick<GeneratedMap, "playerStart" | "enemyStart">,
  contested: boolean,
  seen?: Uint8Array,
): Vec2 {
  const routeT = contested ? 0.66 : 0.72;
  const desired = {
    x: Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * routeT),
    y: Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * routeT),
  };
  return reachableScenarioPoint(state, desired, seen, {
    start: map.playerStart,
    end: map.enemyStart,
    min: routeT - 0.08,
    max: routeT + 0.08,
  });
}

function convoyDestination(state: SimState, zone: Vec2, index: number): Vec2 {
  const enemyBase = state.entities.filter((entity) => entity.owner === 1 && entity.class === "building" && entity.hp > 0);
  const candidates: Array<{ point: Vec2; zoneDistance: number; baseDistance: number }> = [];
  for (let y = zone.y - OBJECTIVE_ZONE_RADIUS; y <= zone.y + OBJECTIVE_ZONE_RADIUS; y++) {
    for (let x = zone.x - OBJECTIVE_ZONE_RADIUS; x <= zone.x + OBJECTIVE_ZONE_RADIUS; x++) {
      const zoneDistance = Math.hypot(x - zone.x, y - zone.y);
      if (zoneDistance < OBJECTIVE_ZONE_RADIUS - 1.5 || zoneDistance > OBJECTIVE_ZONE_RADIUS || !isStaticWalkable(state, x, y)) continue;
      const baseDistance = enemyBase.length
        ? Math.min(...enemyBase.map((building) => distToEntity({ x, y }, building)))
        : Infinity;
      if (baseDistance < 2.5) continue;
      candidates.push({ point: { x, y }, zoneDistance, baseDistance });
    }
  }
  candidates.sort((a, b) => b.baseDistance - a.baseDistance || b.zoneDistance - a.zoneDistance || a.point.y - b.point.y || a.point.x - b.point.x);
  return candidates[index % candidates.length]?.point ?? zone;
}

const EMPTY_EVENTS: SimEvent[] = [];

export function tickScenario(state: SimState): SimEvent[] {
  const runtime = state.runtime;
  if (!runtime || runtime.phase === "complete") return EMPTY_EVENTS;
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
  return EMPTY_EVENTS;
}
