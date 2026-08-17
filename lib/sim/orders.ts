import { BUILDING_STATS, MAX_PRODUCTION_QUEUE, UNIT_STATS, producerFor, productionQueueSize, sellRefundFor } from "../catalog";
import type { BuildingKind, Command, Entity, SimEvent, SimState, UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { canRepair } from "./repair";
import { canSell } from "./sell";
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
    case "cancelBuild":
      return cancelBuild(state, command.building);
    case "cancelProduce":
      return cancelProduce(state, command.unit);
    case "repair":
      return toggleRepair(state, command.buildingId);
    case "sell":
      return sellBuilding(state, command.buildingId);
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

function cancelBuild(state: SimState, kind: BuildingKind): SimEvent[] {
  if (kind === "constructionYard" || kind === "objective") return [];
  let target: Entity | undefined;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.owner !== 0 || e.class !== "building") continue;
    if (e.kind !== kind || e.constructing <= 0) continue;
    target = e;
  }
  if (!target) return [];
  target.hp = 0;
  target.constructing = 0;
  state.credits[0] += BUILDING_STATS[kind].cost;
  return [];
}

function toggleRepair(state: SimState, buildingId: number): SimEvent[] {
  const e = byId(state, buildingId);
  if (!e || e.class !== "building" || e.owner !== 0) return [];
  if (e.repairing) {
    e.repairing = false;
    return [];
  }
  if (!canRepair(e)) return [];
  e.repairing = true;
  return [];
}

function refundQueuedUnits(state: SimState, e: Entity): void {
  if (e.producing) {
    state.credits[0] += UNIT_STATS[e.producing.kind].cost;
    e.producing = undefined;
  }
  if (!e.queue?.length) return;
  for (const unit of e.queue) state.credits[0] += UNIT_STATS[unit].cost;
  e.queue = [];
}

function sellBuilding(state: SimState, buildingId: number): SimEvent[] {
  const e = byId(state, buildingId);
  if (!e || e.owner !== 0 || !canSell(e)) return [];
  refundQueuedUnits(state, e);
  state.credits[0] += sellRefundFor(e.kind as BuildingKind, e.hp);
  e.hp = 0;
  e.repairing = false;
  state.losses.buildings[0] += 1;
  return [{ type: "destroyed", id: e.id, kind: String(e.kind) }];
}

function cancelProduce(state: SimState, unit: UnitKind): SimEvent[] {
  let queued: { entity: Entity; index: number } | undefined;
  let producing: Entity | undefined;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.owner !== 0 || e.class !== "building" || e.constructing > 0) continue;
    if (!e.queue) e.queue = [];
    for (let i = e.queue.length - 1; i >= 0; i--) {
      if (e.queue[i] === unit) {
        queued = { entity: e, index: i };
        break;
      }
    }
    if (e.producing?.kind === unit) producing = e;
  }
  if (queued) {
    queued.entity.queue.splice(queued.index, 1);
    state.credits[0] += UNIT_STATS[unit].cost;
    return [];
  }
  if (!producing?.producing) return [];
  state.credits[0] += UNIT_STATS[unit].cost;
  const next = producing.queue.shift();
  producing.producing = next
    ? { kind: next, remaining: UNIT_STATS[next].buildTicks }
    : undefined;
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
