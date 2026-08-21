import type { Rng } from "../seed/rng";
import type { GeneratedMap } from "../gen/map";
import type {
  BuildingKind,
  MissionDef,
  MissionRuntime,
  SimState,
  Vec2,
} from "../types";
import { PATH_DIRS, diagonalCornerBlocked } from "./pathfinding";
import { canClimb, inBounds, isStaticWalkable, isWalkable, spawnBuildingAt, spawnUnit } from "./world";

export const CONVOY_STAGING_TICKS = 180 * 12;

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
      const kind = rng.pick(["refinery", "factory", "objective"]) as BuildingKind;
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
    if (kind === "sabotage") {
      for (let i = 0; i < count; i++) {
        const spot = map.markedSpots[i] ?? { x: enemyStart.x - 4 - i * 3, y: enemyStart.y - 5 + (i % 2) * 2 };
        const objective = spawnBuildingAt(state, 1, "objective", spot.x, spot.y, 0, true);
        if (objective) targetIds.push(objective.id);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const desired = kind === "escort" ? convoyStartPoint(map, i) : centerPoint(map, i, count);
        const point = reachableScenarioPoint(state, desired, scenarioReachability);
        const target = spawnUnit(state, 0, kind === "escort" ? "tank" : "infantry", point.x, point.y);
        target.neutral = kind === "escort" || kind === "rescue" || kind === "extraction";
        target.scenarioRole = kind === "escort" ? "convoy" : kind === "rescue" ? "stranded" : "cargo";
        if (kind === "extraction") target.marked = true;
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
      secondary: [
        { id: "yard", kind: "preserveYard", label: "Keep the construction yard standing" },
        { id: "time", kind: "completeBefore", label: "Complete the operation before the deadline", target: mission.win.ticks ?? 3600 },
      ],
    };
    state.runtime = runtime;
    state.win.targetIds = targetIds;
  }

  if (!state.runtime) {
    const secondary = rng.chance(0.5)
      ? { id: "survivors", kind: "keepUnits" as const, label: "Keep at least one combat unit alive", target: 1 }
      : { id: "tempo", kind: "completeBefore" as const, label: "Complete the operation before the final push", target: (mission.win.ticks ?? 3600) + 1 };
    state.runtime = {
      kind: mission.win.kind,
      phase: "active",
      targetIds: state.win.targetIds ?? mission.win.targetIds ?? [],
      rescued: 0,
      required: mission.win.targetCount ?? 1,
      secondary: [
        { id: "yard", kind: "preserveYard", label: "Keep the construction yard standing" },
        secondary,
      ],
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

function reachableScenarioPoint(state: SimState, desired: Vec2, seen?: Uint8Array): Vec2 {
  if (!seen) return desired;
  let best: Vec2 | undefined;
  let bestDistance = Infinity;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!seen[y * state.width + x] || !isWalkable(state, x, y)) continue;
      const distance = Math.hypot(x - desired.x, y - desired.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
  }
  return best ?? desired;
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
