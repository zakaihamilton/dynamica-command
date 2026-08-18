import { BUILDING_STATS, MAX_PRODUCTION_QUEUE, UNIT_STATS, producerFor, productionQueueSize, sellRefundFor } from "../catalog";
import type { BuildingKind, Command, Entity, Formation, SimEvent, SimState, UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { canRepair } from "./repair";
import { canSell } from "./sell";
import { byId, canPlaceBuilding, closestApproach, powerFor, spawnBuilding } from "./world";
import { buildingBuildTicks, buildingCost, unitBuildTicks } from "./upgrades";

export function issue(state: SimState, command: Command): SimEvent[] {
  if (state.result !== "playing") return [];
  if (state.tutorialStage && state.tutorialStage !== "complete") {
    const stages = ["select", "move", "harvest", "build", "produce", "attack", "repair", "complete"] as const;
    const required = command.type === "move" || command.type === "stop" || command.type === "formation" || command.type === "stance" ? "move"
      : command.type === "harvest" ? "harvest"
        : command.type === "build" || command.type === "cancelBuild" ? "build"
          : command.type === "produce" || command.type === "cancelProduce" ? "produce"
            : command.type === "attack" || command.type === "attackMove" ? "attack"
              : command.type === "repair" ? "repair" : undefined;
    if (required && stages.indexOf(state.tutorialStage) < stages.indexOf(required)) {
      return [{ type: "commandRejected", reason: `training step: ${required}` }];
    }
  }
  switch (command.type) {
    case "move":
      return moveUnits(state, command.unitIds, command.x, command.y, command.formation);
    case "attackMove":
      return attackMoveUnits(state, command.unitIds, command.x, command.y, command.formation);
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
    case "stop":
      return stopUnits(state, command.unitIds);
    case "stance":
      return setStance(state, command.unitIds, command.stance);
    case "formation":
      return setFormation(state, command.unitIds, command.formation);
    default:
      return [];
  }
}

function moveUnits(state: SimState, ids: number[], x: number, y: number, formation?: Formation): SimEvent[] {
  const tx = Math.round(x);
  const ty = Math.round(y);
  ids.forEach((id, index) => {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0 || e.neutral) return;
    e.attackTarget = undefined;
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = false;
    e.formation = formation;
    e.path = findPath(state, e, formationDestination(tx, ty, formation, index, ids.length));
  });
  return [];
}

function attackMoveUnits(state: SimState, ids: number[], x: number, y: number, formation?: Formation): SimEvent[] {
  ids.forEach((id, index) => {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0 || e.neutral || e.kind === "harvester") return;
    e.attackTarget = undefined;
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = false;
    e.formation = formation;
    e.path = findPath(state, e, formationDestination(Math.round(x), Math.round(y), formation, index, ids.length));
  });
  return [];
}

function formationDestination(x: number, y: number, formation: Formation | undefined, index: number, count: number): { x: number; y: number } {
  if (!formation || count <= 1) return { x, y };
  const centered = index - (count - 1) / 2;
  if (formation === "column") return { x: x + Math.round(centered), y };
  if (formation === "wedge") return { x: x + Math.round(centered), y: y + Math.abs(Math.round(centered)) };
  return { x, y: y + Math.round(centered) };
}

function stopUnits(state: SimState, ids: number[]): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.owner !== 0 || e.class !== "unit") continue;
    e.path = [];
    e.attackTarget = undefined;
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = true;
  }
  return [];
}

function setStance(state: SimState, ids: number[], stance: "aggressive" | "defensive" | "hold"): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (e?.owner === 0 && e.class === "unit") e.stance = stance;
  }
  return [];
}

function setFormation(state: SimState, ids: number[], formation: Formation): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (e?.owner === 0 && e.class === "unit") e.formation = formation;
  }
  return [];
}

function attackUnits(state: SimState, ids: number[], targetId: number): SimEvent[] {
  const target = byId(state, targetId);
  if (!target || target.owner !== 1 || target.neutral) return [{ type: "commandRejected", reason: "invalid attack target" }];
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0 || e.neutral) continue;
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
    if (!e || e.kind !== "harvester" || e.owner !== 0 || e.neutral) continue;
    e.attackTarget = undefined;
    e.gatherX = Math.round(x);
    e.gatherY = Math.round(y);
    e.idle = false;
    e.path = findPath(state, e, { x: e.gatherX, y: e.gatherY });
  }
  return [];
}

function startBuild(state: SimState, kind: BuildingKind, x: number, y: number): SimEvent[] {
  if (kind === "constructionYard" || kind === "objective") return [{ type: "commandRejected", reason: "invalid building" }];
  const tx = Math.round(x);
  const ty = Math.round(y);
  if (!canPlaceBuilding(state, kind, tx, ty)) return [{ type: "commandRejected", reason: "invalid placement" }];
  const yard = state.entities.find(
    (e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0 && e.constructing === 0,
  );
  if (!yard) return [{ type: "commandRejected", reason: "construction yard unavailable" }];
  const cost = buildingCost(state, 0, kind);
  if (state.credits[0] < cost) return [{ type: "commandRejected", reason: "insufficient credits" }];
  state.credits[0] -= cost;
  spawnBuilding(state, 0, kind, tx, ty, buildingBuildTicks(state, 0, kind));
  return [];
}

function startProduce(state: SimState, fromId: number, unit: UnitKind): SimEvent[] {
  const b = byId(state, fromId);
  if (!b || b.class !== "building" || b.owner !== 0 || b.constructing > 0) return [{ type: "commandRejected", reason: "producer unavailable" }];
  if (b.kind !== producerFor(unit)) return [{ type: "commandRejected", reason: "wrong producer" }];
  if (!b.queue) b.queue = [];
  if (productionQueueSize(b) >= MAX_PRODUCTION_QUEUE) return [{ type: "commandRejected", reason: "production queue full" }];
  const stats = UNIT_STATS[unit];
  if (state.credits[0] < stats.cost) return [{ type: "commandRejected", reason: "insufficient credits" }];
  if (powerFor(state, 0) < 0) return [{ type: "commandRejected", reason: "power shortage" }];
  state.credits[0] -= stats.cost;
  if (!b.producing) {
    b.producing = { kind: unit, remaining: unitBuildTicks(state, 0, unit) };
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
