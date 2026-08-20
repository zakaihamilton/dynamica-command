import { BUILDING_STATS, MAX_PRODUCTION_QUEUE, UNIT_STATS, producerFor, productionQueueSize, sellRefundFor } from "../catalog";
import { TILE_RESOURCE, type BuildingKind, type Command, type Entity, type Formation, type SimEvent, type SimState, type TutorialStage, type UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { canRepair } from "./repair";
import { canSell } from "./sell";
import { byId, canPlaceBuilding, closestApproach, inBounds, isStaticWalkable, powerFor, spawnBuilding, tileAt } from "./world";

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
  let events: SimEvent[];
  switch (command.type) {
    case "move":
      events = moveUnits(state, command.unitIds, command.x, command.y, command.formation);
      break;
    case "attackMove":
      events = attackMoveUnits(state, command.unitIds, command.x, command.y, command.formation);
      break;
    case "attack":
      events = attackUnits(state, command.unitIds, command.targetId);
      break;
    case "harvest":
      events = harvestUnits(state, command.unitIds, command.x, command.y);
      break;
    case "build":
      events = startBuild(state, command.building, command.x, command.y);
      break;
    case "produce":
      events = startProduce(state, command.fromId, command.unit);
      break;
    case "cancelBuild":
      events = cancelBuild(state, command.building);
      break;
    case "cancelProduce":
      events = cancelProduce(state, command.unit);
      break;
    case "repair":
      events = toggleRepair(state, command.buildingId);
      break;
    case "sell":
      events = sellBuilding(state, command.buildingId);
      break;
    case "stop":
      events = stopUnits(state, command.unitIds);
      break;
    case "stance":
      events = setStance(state, command.unitIds, command.stance);
      break;
    case "formation":
      events = setFormation(state, command.unitIds, command.formation);
      break;
    default:
      events = [];
  }
  if (!events.some((event) => event.type === "commandRejected")) advanceTutorialAfterCommand(state, command.type);
  return events;
}

function advanceTutorialAfterCommand(state: SimState, type: Command["type"]): void {
  if (!state.tutorialStage || state.tutorialStage === "complete") return;
  const next: Partial<Record<TutorialStage, TutorialStage>> = {
    move: "harvest",
    harvest: "build",
    build: "produce",
    produce: "attack",
    attack: "repair",
    repair: "complete",
  };
  const expected: Record<string, Command["type"][]> = {
    move: ["move", "attackMove"],
    harvest: ["harvest"],
    build: ["build"],
    produce: ["produce"],
    attack: ["attack", "attackMove"],
    repair: ["repair"],
  };
  const stage = state.tutorialStage;
  const nextStage = next[stage];
  if (expected[stage]?.includes(type) && nextStage) state.tutorialStage = nextStage;
}

function moveUnits(state: SimState, ids: number[], x: number, y: number, formation?: Formation): SimEvent[] {
  const tx = Math.round(x);
  const ty = Math.round(y);
  const movers = collectMovers(state, ids, false);
  const dests = destinationsForGroup(state, movers, tx, ty, formation);
  movers.forEach((e, index) => {
    e.attackTarget = undefined;
    e.orderMode = "move";
    e.orderDestination = dests[index] ?? { x: tx, y: ty };
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = false;
    if (formation) e.formation = formation;
    e.path = findPath(state, e, dests[index] ?? { x: tx, y: ty });
  });
  return [];
}

function attackMoveUnits(state: SimState, ids: number[], x: number, y: number, formation?: Formation): SimEvent[] {
  const tx = Math.round(x);
  const ty = Math.round(y);
  const movers = collectMovers(state, ids, true);
  const dests = destinationsForGroup(state, movers, tx, ty, formation);
  movers.forEach((e, index) => {
    e.attackTarget = undefined;
    e.orderMode = "attackMove";
    e.orderDestination = dests[index] ?? { x: tx, y: ty };
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = false;
    if (formation) e.formation = formation;
    e.path = findPath(state, e, dests[index] ?? { x: tx, y: ty });
  });
  return [];
}

function collectMovers(state: SimState, ids: number[], attackMove: boolean): Entity[] {
  const movers: Entity[] = [];
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0 || e.neutral) continue;
    if (attackMove && e.kind === "harvester") continue;
    movers.push(e);
  }
  return movers;
}

function formationDestination(x: number, y: number, formation: Formation, index: number, count: number): { x: number; y: number } {
  const centered = index - (count - 1) / 2;
  if (formation === "column") return { x: x + Math.round(centered), y };
  if (formation === "wedge") return { x: x + Math.round(centered), y: y + Math.abs(Math.round(centered)) };
  return { x, y: y + Math.round(centered) };
}

function nearbyWalkableSlots(state: SimState, x: number, y: number, count: number): { x: number; y: number }[] {
  const slots: { x: number; y: number }[] = [];
  const seen = new Set<number>();
  const take = (sx: number, sy: number) => {
    if (!inBounds(state, sx, sy) || !isStaticWalkable(state, sx, sy)) return;
    const key = sy * state.width + sx;
    if (seen.has(key)) return;
    seen.add(key);
    slots.push({ x: sx, y: sy });
  };
  for (let r = 0; r <= 16 && slots.length < count; r++) {
    if (r === 0) {
      take(x, y);
      continue;
    }
    for (let dy = -r; dy <= r && slots.length < count; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        take(x + dx, y + dy);
        if (slots.length >= count) break;
      }
    }
  }
  return slots;
}

function snapUnique(state: SimState, x: number, y: number, taken: Set<number>): { x: number; y: number } {
  for (let r = 0; r <= 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const sx = x + dx;
        const sy = y + dy;
        if (!inBounds(state, sx, sy) || !isStaticWalkable(state, sx, sy)) continue;
        const key = sy * state.width + sx;
        if (taken.has(key)) continue;
        taken.add(key);
        return { x: sx, y: sy };
      }
    }
  }
  return { x, y };
}

function assignNearest(units: Entity[], slots: { x: number; y: number }[]): { x: number; y: number }[] {
  const dests: { x: number; y: number }[] = units.map(() => slots[0] ?? { x: 0, y: 0 });
  const pairs: { ui: number; si: number; d: number }[] = [];
  for (let ui = 0; ui < units.length; ui++) {
    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si]!;
      pairs.push({ ui, si, d: Math.hypot(units[ui]!.x - slot.x, units[ui]!.y - slot.y) });
    }
  }
  pairs.sort((a, b) => a.d - b.d || a.ui - b.ui || a.si - b.si);
  const unitTaken = new Set<number>();
  const slotTaken = new Set<number>();
  for (const pair of pairs) {
    if (unitTaken.has(pair.ui) || slotTaken.has(pair.si)) continue;
    unitTaken.add(pair.ui);
    slotTaken.add(pair.si);
    dests[pair.ui] = slots[pair.si]!;
  }
  return dests;
}

function destinationsForGroup(
  state: SimState,
  units: Entity[],
  x: number,
  y: number,
  commandFormation?: Formation,
): { x: number; y: number }[] {
  if (units.length === 0) return [];
  if (units.length === 1) return [{ x, y }];
  const shared = units.every((e) => e.formation && e.formation === units[0]!.formation)
    ? units[0]!.formation
    : undefined;
  const formation = commandFormation ?? shared;
  if (formation) {
    const taken = new Set<number>();
    return units.map((_, index) => {
      const raw = formationDestination(x, y, formation, index, units.length);
      return snapUnique(state, raw.x, raw.y, taken);
    });
  }
  return assignNearest(units, nearbyWalkableSlots(state, x, y, units.length));
}

function stopUnits(state: SimState, ids: number[]): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.owner !== 0 || e.class !== "unit") continue;
    e.path = [];
    e.attackTarget = undefined;
    e.orderMode = undefined;
    e.orderDestination = undefined;
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
    e.orderMode = "attack";
    e.orderDestination = { x: target.x, y: target.y };
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

function travelOrder(ids: number[], x: number, y: number, attackMove: boolean): Command {
  return attackMove
    ? { type: "attackMove", unitIds: ids, x, y }
    : { type: "move", unitIds: ids, x, y };
}

/** Right-click / tap ground: harvest ore with harvesters, move everyone else onto the tile. */
export function groundOrders(state: SimState, ids: number[], x: number, y: number, attackMove = false): Command[] {
  const tx = Math.round(x);
  const ty = Math.round(y);
  if (!inBounds(state, tx, ty) || tileAt(state, tx, ty) !== TILE_RESOURCE) {
    return [travelOrder(ids, tx, ty, attackMove)];
  }
  const harvesters: number[] = [];
  const movers: number[] = [];
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0 || e.neutral) continue;
    if (e.kind === "harvester") harvesters.push(id);
    else movers.push(id);
  }
  const commands: Command[] = [];
  if (harvesters.length) commands.push({ type: "harvest", unitIds: harvesters, x: tx, y: ty });
  if (movers.length) commands.push(travelOrder(movers, tx, ty, attackMove));
  return commands;
}

function harvestUnits(state: SimState, ids: number[], x: number, y: number): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.kind !== "harvester" || e.owner !== 0 || e.neutral) continue;
    e.attackTarget = undefined;
    e.orderMode = "move";
    e.orderDestination = { x: Math.round(x), y: Math.round(y) };
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
  const cost = BUILDING_STATS[kind].cost;
  if (state.credits[0] < cost) return [{ type: "commandRejected", reason: "insufficient credits" }];
  state.credits[0] -= cost;
  spawnBuilding(state, 0, kind, tx, ty, BUILDING_STATS[kind].buildTicks);
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
