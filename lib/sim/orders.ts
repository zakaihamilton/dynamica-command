import { BUILDING_STATS, MAX_PRODUCTION_QUEUE, UNIT_STATS, producerFor, productionQueueSize } from "../catalog";
import type { BuildingKind, Command, Entity, SimEvent, SimState, UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { byId, canPlaceBuilding, closestApproach, powerFor, spawnBuilding } from "./world";

export function issue(state: SimState, command: Command): SimEvent[] {
  if (state.result !== "playing") return [];
  switch (command.type) {
    case "move":
      return moveUnits(state, command.unitIds, command.x, command.y);
    case "attack":
      return attackUnits(state, command.unitIds, command.targetId);
    case "harvest":
      return harvestUnits(state, command.unitIds, command.x, command.y);
    case "build":
      return startBuild(state, command.building, command.x, command.y);
    case "produce":
      return startProduce(state, command.fromId, command.unit);
    default:
      return [];
  }
}

function moveUnits(state: SimState, ids: number[], x: number, y: number): SimEvent[] {
  const tx = Math.round(x);
  const ty = Math.round(y);
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0) continue;
    e.attackTarget = undefined;
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = false;
    e.path = findPath(state, e, { x: tx, y: ty });
  }
  return [];
}

function attackUnits(state: SimState, ids: number[], targetId: number): SimEvent[] {
  const target = byId(state, targetId);
  if (!target) return [];
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0) continue;
    if (e.kind === "harvester") continue;
    e.attackTarget = targetId;
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = false;
    const range = UNIT_STATS[e.kind as UnitKind].range;
    const dest = target.class === "building" ? closestApproach(state, e, target) : target;
    if (Math.hypot(e.x - dest.x, e.y - dest.y) > range) {
      e.path = findPath(state, e, dest);
    }
  }
  return [];
}

function harvestUnits(state: SimState, ids: number[], x: number, y: number): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.kind !== "harvester") continue;
    e.attackTarget = undefined;
    e.gatherX = Math.round(x);
    e.gatherY = Math.round(y);
    e.idle = false;
    e.path = findPath(state, e, { x: e.gatherX, y: e.gatherY });
  }
  return [];
}

function startBuild(state: SimState, kind: BuildingKind, x: number, y: number): SimEvent[] {
  if (kind === "constructionYard" || kind === "objective") return [];
  const tx = Math.round(x);
  const ty = Math.round(y);
  if (!canPlaceBuilding(state, kind, tx, ty)) return [];
  const yard = state.entities.find(
    (e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0 && e.constructing === 0,
  );
  if (!yard) return [];
  const stats = BUILDING_STATS[kind];
  if (state.credits[0] < stats.cost) return [];
  state.credits[0] -= stats.cost;
  spawnBuilding(state, 0, kind, tx, ty, stats.buildTicks);
  return [];
}

function startProduce(state: SimState, fromId: number, unit: UnitKind): SimEvent[] {
  const b = byId(state, fromId);
  if (!b || b.class !== "building" || b.owner !== 0 || b.constructing > 0) return [];
  if (b.kind !== producerFor(unit)) return [];
  if (!b.queue) b.queue = [];
  if (productionQueueSize(b) >= MAX_PRODUCTION_QUEUE) return [];
  const stats = UNIT_STATS[unit];
  if (state.credits[0] < stats.cost) return [];
  if (powerFor(state, 0) < 0) return [];
  state.credits[0] -= stats.cost;
  if (!b.producing) {
    b.producing = { kind: unit, remaining: stats.buildTicks };
  } else {
    b.queue.push(unit);
  }
  return [];
}

export function applyCommands(state: SimState, commands: Command[]): SimEvent[] {
  const events: SimEvent[] = [];
  for (const c of commands) events.push(...issue(state, c));
  return events;
}

export function setPathTo(state: SimState, e: Entity, dest: { x: number; y: number }): void {
  e.path = findPath(state, e, dest);
}
