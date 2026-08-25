import { isSupportUnit } from "../../catalog";
import type { Entity, SimState, UnitKind } from "../../types";
import { tryFindPath } from "../pathBudget";
import { byId, closestApproach, distToEntity, living, nearest } from "../world";
import { contestedResourcePoint } from "./helpers";
import { homeGuardCount } from "./director";

export function enemyCombat(state: SimState): Entity[] {
  return living(state).filter((e) => e.owner === 1 && e.class === "unit" && e.kind !== "harvester" && !isSupportUnit(e.kind as UnitKind));
}

export function sendHome(state: SimState, unit: Entity, yard: Entity): void {
  unit.attackTarget = undefined;
  unit.orderMode = "move";
  unit.orderDestination = { x: yard.x, y: yard.y };
  unit.idle = false;
  const path = tryFindPath(state, unit, closestApproach(state, unit, yard));
  if (path !== undefined) unit.path = path;
}

export function assignAttack(state: SimState, unit: Entity, target: Entity): void {
  unit.attackTarget = target.id;
  unit.orderMode = "attack";
  unit.orderDestination = { x: target.x, y: target.y };
  unit.idle = false;
  const path = tryFindPath(state, unit, closestApproach(state, unit, target));
  if (path !== undefined) unit.path = path;
}

export function assignMove(state: SimState, unit: Entity, destination: { x: number; y: number }): void {
  unit.attackTarget = undefined;
  unit.orderMode = "move";
  unit.orderDestination = { x: destination.x, y: destination.y };
  unit.idle = false;
  const path = tryFindPath(state, unit, destination);
  if (path !== undefined) unit.path = path;
}

export function scenarioAssaultTarget(state: SimState, from: Entity): Entity | undefined {
  const runtime = state.runtime;
  if (!runtime) return undefined;
  const candidates = runtime.targetIds
    .map((id) => byId(state, id))
    .filter((entity): entity is Entity => {
      if (!entity || entity.hp <= 0 || entity.owner !== 0) return false;
      if (runtime.kind === "escort") return runtime.convoyStartTick === undefined && entity.scenarioRole === "convoy";
      if (runtime.kind === "extraction") return entity.scenarioRole === "cargo" && !entity.neutral && !runtime.extractedIds?.includes(entity.id);
      if (runtime.kind === "rescue") return entity.scenarioRole === "stranded" && !entity.neutral;
      return false;
    });
  const sorted = candidates.sort((a, b) => distToEntity(from, a) - distToEntity(from, b) || a.id - b.id);
  return sorted.length ? sorted[from.id % sorted.length] : undefined;
}

export function assignAssault(
  state: SimState,
  units: Entity[],
  yard: Entity,
  playerYard: Entity,
  retarget: boolean,
): void {
  const guards = homeGuardCount(state.missionIndex);
  const sorted = [...units].sort((a, b) => distToEntity(a, yard) - distToEntity(b, yard) || a.id - b.id);
  const raiders = sorted.slice(guards);
  const resourcePoint = contestedResourcePoint(state, yard);
  const laneHarvester = resourcePoint
    ? nearest(state, resourcePoint, (e) => e.owner === 0 && e.kind === "harvester" && e.hp > 0)
    : undefined;
  const harvester = laneHarvester && resourcePoint && distToEntity(resourcePoint, laneHarvester) <= 12
    ? laneHarvester
    : nearest(state, yard, (e) => e.owner === 0 && e.kind === "harvester" && e.hp > 0);
  raiders.forEach((u, index) => {
    if (!retarget && u.attackTarget !== undefined && byId(state, u.attackTarget)) return;
    const objectiveTarget = scenarioAssaultTarget(state, u);
    const target = objectiveTarget ?? (harvester && index % 2 === 1 ? playerYard : harvester ?? playerYard);
    assignAttack(state, u, target);
  });
}
