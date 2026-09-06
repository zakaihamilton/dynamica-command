import type { Rng } from "../../seed/rng";
import type { GeneratedMap } from "../../gen/map";
import type {
  MissionDef,
  MissionRuntime,
  SimEvent,
  SimState,
} from "../../types";
import { secondaryObjectivesForMission } from "../../gen/objectives";
import { inObjectiveZone } from "../../types";
import { CONVOY_COMPLETION_BUFFER_TICKS, CONVOY_STAGING_TICKS } from "../../gen/pacing";
import { resolveMissionProfile } from "../../gen/profile";
import { spawnBuildingAt, spawnUnit } from "../world";
import { enemyApproachPoint, reachableBuildingFilter, reachableScenarioCells, reachableScenarioPoint } from "./reachability";
import { convoyStartPoint, convoyZonePoint, tickEscort } from "./escort";
import { centerPoint, rescuePoint, tickRescueExtraction } from "./rescueExtraction";

export { CONVOY_COMPLETION_BUFFER_TICKS, CONVOY_STAGING_TICKS };
export { scenarioAffordances, type ScenarioAffordances } from "./affordances";

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

const EMPTY_EVENTS: SimEvent[] = [];

export function tickScenario(state: SimState): SimEvent[] {
  const runtime = state.runtime;
  if (!runtime || runtime.phase === "complete") return EMPTY_EVENTS;

  tickRescueExtraction(state);
  tickEscort(state);

  if (runtime.kind === "escort") {
    const zone = runtime.zone;
    if (zone) {
      let rescued = 0;
      for (const id of runtime.targetIds) {
        const e = state.entities.find((item) => item.id === id && item.hp > 0);
        if (e && inObjectiveZone(e.x, e.y, zone)) rescued += 1;
      }
      runtime.rescued = rescued;
    }
  }

  const yard = state.entities.find((e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0);
  const preserve = runtime.secondary.find((objective) => objective.kind === "preserveYard");
  if (preserve) preserve.completed = !!yard;
  const timed = runtime.secondary.find((objective) => objective.kind === "completeBefore");
  if (timed && timed.target !== undefined) timed.completed = state.tick < timed.target;
  const keepUnits = runtime.secondary.find((objective) => objective.kind === "keepUnits");
  if (keepUnits) keepUnits.completed = state.entities.some((entity) => entity.owner === 0 && entity.class === "unit" && entity.hp > 0 && !entity.neutral);
  return EMPTY_EVENTS;
}
