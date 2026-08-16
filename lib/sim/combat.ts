import { BUILDING_STATS, UNIT_STATS } from "../catalog";
import type { BuildingKind, Entity, SimEvent, SimState, UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { byId, dist, living } from "./world";
import { rngFromState } from "../seed/rng";

function statsFor(e: Entity): { damage: number; range: number; cooldown: number } {
  if (e.class === "unit") return UNIT_STATS[e.kind as UnitKind];
  if (e.kind === "turret") {
    return { damage: 9, range: 5.5, cooldown: 14 };
  }
  return { damage: 0, range: 0, cooldown: 0 };
}

function acquire(state: SimState, e: Entity): Entity | undefined {
  const { range } = statsFor(e);
  const sight = e.class === "unit" ? UNIT_STATS[e.kind as UnitKind].sight : BUILDING_STATS[e.kind as BuildingKind].sight;
  let best: Entity | undefined;
  let bestD = Infinity;
  for (const o of living(state)) {
    if (o.owner === e.owner) continue;
    const d = dist(e, o);
    if (d < bestD && d <= Math.max(range + 4, sight)) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

export function tickCombat(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const rng = rngFromState(state.rngState);
  for (const e of living(state)) {
    const st = statsFor(e);
    if (st.damage <= 0) continue;
    if (e.cooldown > 0) {
      e.cooldown -= 1;
      continue;
    }
    let target = e.attackTarget !== undefined ? byId(state, e.attackTarget) : undefined;
    if (!target) {
      target = acquire(state, e);
      if (target) e.attackTarget = target.id;
    }
    if (!target) continue;
    const d = dist(e, target);
    if (d > st.range) {
      if (e.class === "unit" && !e.path.length) {
        e.path = findPath(state, e, target);
      }
      continue;
    }
    e.path = [];
    const jitter = 0.85 + rng.next() * 0.3;
    target.hp -= st.damage * jitter;
    e.cooldown = st.cooldown;
    if (target.hp <= 0) {
      target.hp = 0;
      events.push({ type: "destroyed", id: target.id, kind: String(target.kind) });
      e.attackTarget = undefined;
    }
  }
  state.rngState = rng.state;
  return events;
}
