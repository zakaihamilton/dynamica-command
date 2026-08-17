import { BUILDING_STATS, UNIT_STATS } from "../catalog";
import type { BuildingKind, Entity, SimEvent, SimState, UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { byId, closestApproach, distToEntity, living } from "./world";
import { rngFromState } from "../seed/rng";

function statsFor(e: Entity): { damage: number; range: number; cooldown: number } {
  if (e.class === "unit") return UNIT_STATS[e.kind as UnitKind];
  if (e.kind === "turret") {
    return { damage: 9, range: 5.5, cooldown: 14 };
  }
  return { damage: 0, range: 0, cooldown: 0 };
}

function isCombatThreat(e: Entity): boolean {
  if (e.class === "building" && e.constructing > 0) return false;
  return statsFor(e).damage > 0;
}

function closestEnemy(state: SimState, e: Entity, maxDist: number, threatsOnly: boolean): Entity | undefined {
  let best: Entity | undefined;
  let bestD = Infinity;
  for (const o of living(state)) {
    if (o.owner === e.owner) continue;
    if (threatsOnly && !isCombatThreat(o)) continue;
    const d = distToEntity(e, o);
    if (d < bestD && d <= maxDist) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function acquire(state: SimState, e: Entity, threatsOnly = false): Entity | undefined {
  const { range } = statsFor(e);
  const sight = e.class === "unit" ? UNIT_STATS[e.kind as UnitKind].sight : BUILDING_STATS[e.kind as BuildingKind].sight;
  return closestEnemy(state, e, Math.max(range + 4, sight), threatsOnly);
}

function acquirePreferred(state: SimState, e: Entity): Entity | undefined {
  return acquire(state, e, true) ?? acquire(state, e, false);
}

function pathDest(path: { x: number; y: number }[]): { x: number; y: number } | undefined {
  return path[path.length - 1];
}

export function tickCombat(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const rng = rngFromState(state.rngState);
  for (const e of living(state)) {
    const st = statsFor(e);
    if (st.damage <= 0) continue;
    if (e.cooldown > 0) e.cooldown -= 1;

    const inRangeThreat = closestEnemy(state, e, st.range, true);
    let target = inRangeThreat ?? (e.attackTarget !== undefined ? byId(state, e.attackTarget) : undefined);
    if (target && !isCombatThreat(target)) {
      const threat = acquire(state, e, true);
      if (threat) {
        target = threat;
        e.path = [];
      }
    }
    if (!target) target = acquirePreferred(state, e);
    if (target) e.attackTarget = target.id;
    if (!target) continue;

    const d = distToEntity(e, target);
    if (d <= st.range) {
      e.path = [];
      if (e.cooldown > 0) continue;
      const jitter = 0.85 + rng.next() * 0.3;
      target.hp -= st.damage * jitter;
      e.cooldown = st.cooldown;
      if (target.hp <= 0) {
        target.hp = 0;
        if (target.class === "unit") state.losses.units[target.owner] += 1;
        else state.losses.buildings[target.owner] += 1;
        events.push({ type: "destroyed", id: target.id, kind: String(target.kind) });
        e.attackTarget = undefined;
      }
      continue;
    }

    if (e.class === "unit") {
      const dest = target.class === "building" ? closestApproach(state, e, target) : target;
      const end = pathDest(e.path);
      const stale = !end || Math.hypot(end.x - dest.x, end.y - dest.y) > 1.25;
      if (!e.path.length || stale) e.path = findPath(state, e, dest);
    }
  }
  state.rngState = rng.state;
  return events;
}
