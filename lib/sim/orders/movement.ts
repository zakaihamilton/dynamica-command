import { findPath } from "../pathfinding";
import { type Entity, type Formation, type SimEvent, type SimState } from "../../types";
import { byId, inBounds, isStaticWalkable } from "../world";
import { clearSupportOrder } from "../support";

export function moveUnits(state: SimState, ids: number[], x: number, y: number, formation?: Formation): SimEvent[] {
  const tx = Math.round(x);
  const ty = Math.round(y);
  const movers = collectMovers(state, ids, false);
  const dests = destinationsForGroup(state, movers, tx, ty, formation);
  movers.forEach((e, index) => {
    clearSupportOrder(e);
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

export function attackMoveUnits(state: SimState, ids: number[], x: number, y: number, formation?: Formation): SimEvent[] {
  const tx = Math.round(x);
  const ty = Math.round(y);
  const movers = collectMovers(state, ids, true);
  const dests = destinationsForGroup(state, movers, tx, ty, formation);
  movers.forEach((e, index) => {
    clearSupportOrder(e);
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

export function collectMovers(state: SimState, ids: number[], attackMove: boolean): Entity[] {
  const movers: Entity[] = [];
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0 || e.neutral) continue;
    if (attackMove && e.kind === "harvester") continue;
    movers.push(e);
  }
  return movers;
}

export function formationDestination(x: number, y: number, formation: Formation, index: number, count: number): { x: number; y: number } {
  const centered = index - (count - 1) / 2;
  if (formation === "column") return { x: x + Math.round(centered), y };
  if (formation === "wedge") return { x: x + Math.round(centered), y: y + Math.abs(Math.round(centered)) };
  return { x, y: y + Math.round(centered) };
}

export function nearbyWalkableSlots(state: SimState, x: number, y: number, count: number): { x: number; y: number }[] {
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

export function snapUnique(state: SimState, x: number, y: number, taken: Set<number>): { x: number; y: number } {
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

export function assignNearest(units: Entity[], slots: { x: number; y: number }[]): { x: number; y: number }[] {
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

export function destinationsForGroup(
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
