import { BUILDING_STATS, UNIT_STATS } from "../catalog";
import type { BuildingKind, Entity, SimEvent, SimState, UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { byId, closestApproach, distToEntity, living } from "./world";
import { rngFromState, type Rng } from "../seed/rng";

const CELL = 8;

type CombatGrid = {
  cols: number;
  rows: number;
  cells: Entity[][];
  order: Map<number, number>;
};

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

function buildGrid(state: SimState): CombatGrid {
  const cols = Math.max(1, Math.ceil(state.width / CELL));
  const rows = Math.max(1, Math.ceil(state.height / CELL));
  const cells: Entity[][] = Array.from({ length: cols * rows }, () => []);
  const order = new Map<number, number>();
  const all = living(state);
  for (let i = 0; i < all.length; i++) {
    const e = all[i]!;
    order.set(e.id, i);
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(e.x / CELL)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(e.y / CELL)));
    cells[cy * cols + cx]!.push(e);
  }
  return { cols, rows, cells, order };
}

function closestEnemy(
  grid: CombatGrid,
  e: Entity,
  maxDist: number,
  threatsOnly: boolean,
): Entity | undefined {
  const reach = maxDist + 3;
  const x0 = Math.max(0, Math.floor((e.x - reach) / CELL));
  const y0 = Math.max(0, Math.floor((e.y - reach) / CELL));
  const x1 = Math.min(grid.cols - 1, Math.floor((e.x + reach) / CELL));
  const y1 = Math.min(grid.rows - 1, Math.floor((e.y + reach) / CELL));
  let best: Entity | undefined;
  let bestD = Infinity;
  let bestOrder = Infinity;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const bucket = grid.cells[cy * grid.cols + cx];
      if (!bucket) continue;
      for (const o of bucket) {
        if (o.hp <= 0) continue;
        if (o.owner === e.owner) continue;
        if (threatsOnly && !isCombatThreat(o)) continue;
        const d = distToEntity(e, o);
        if (d > maxDist) continue;
        const rank = grid.order.get(o.id) ?? Infinity;
        if (d < bestD || (d === bestD && rank < bestOrder)) {
          bestD = d;
          bestOrder = rank;
          best = o;
        }
      }
    }
  }
  return best;
}

function acquire(grid: CombatGrid, e: Entity, threatsOnly = false): Entity | undefined {
  const { range } = statsFor(e);
  const sight = e.class === "unit" ? UNIT_STATS[e.kind as UnitKind].sight : BUILDING_STATS[e.kind as BuildingKind].sight;
  return closestEnemy(grid, e, Math.max(range + 4, sight), threatsOnly);
}

function acquirePreferred(grid: CombatGrid, e: Entity): Entity | undefined {
  return acquire(grid, e, true) ?? acquire(grid, e, false);
}

function pathDest(path: { x: number; y: number }[]): { x: number; y: number } | undefined {
  return path[path.length - 1];
}

function strike(
  state: SimState,
  e: Entity,
  target: Entity,
  damage: number,
  cooldown: number,
  rng: Rng,
  events: SimEvent[],
): void {
  if (e.cooldown > 0) return;
  const jitter = 0.85 + rng.next() * 0.3;
  target.hp -= damage * jitter;
  e.cooldown = cooldown;
  if (target.hp > 0) return;
  target.hp = 0;
  if (target.class === "unit") state.losses.units[target.owner] += 1;
  else state.losses.buildings[target.owner] += 1;
  events.push({ type: "destroyed", id: target.id, kind: String(target.kind) });
  if (e.attackTarget === target.id) e.attackTarget = undefined;
}

function chase(state: SimState, e: Entity, target: Entity): void {
  const dest = target.class === "building" ? closestApproach(state, e, target) : target;
  const end = pathDest(e.path);
  const stale = !end || Math.hypot(end.x - dest.x, end.y - dest.y) > 1.25;
  if (!e.path.length || stale) e.path = findPath(state, e, dest);
}

export function tickCombat(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const rng = rngFromState(state.rngState);
  const grid = buildGrid(state);
  for (const e of living(state)) {
    const st = statsFor(e);
    if (st.damage <= 0) continue;
    if (e.constructing > 0) continue;
    if (e.cooldown > 0) e.cooldown -= 1;

    const ordered = e.class === "unit" && !e.idle;
    if (ordered && e.attackTarget !== undefined) {
      const assigned = byId(state, e.attackTarget);
      if (!assigned) {
        e.attackTarget = undefined;
        e.idle = true;
      } else {
        const d = distToEntity(e, assigned);
        if (d <= st.range) {
          e.path = [];
          strike(state, e, assigned, st.damage, st.cooldown, rng, events);
          if (e.attackTarget === undefined) e.idle = true;
        } else {
          chase(state, e, assigned);
        }
        continue;
      }
    }

    if (ordered && e.path.length > 0) {
      const opportunity = closestEnemy(grid, e, st.range, false);
      if (opportunity) strike(state, e, opportunity, st.damage, st.cooldown, rng, events);
      continue;
    }

    if (ordered) e.idle = true;

    const inRangeThreat = closestEnemy(grid, e, st.range, true);
    let target = inRangeThreat ?? (e.attackTarget !== undefined ? byId(state, e.attackTarget) : undefined);
    if (target && !isCombatThreat(target)) {
      const threat = acquire(grid, e, true);
      if (threat) {
        target = threat;
        e.path = [];
      }
    }
    if (!target) target = acquirePreferred(grid, e);
    if (target) e.attackTarget = target.id;
    if (!target) continue;

    const d = distToEntity(e, target);
    if (d <= st.range) {
      e.path = [];
      strike(state, e, target, st.damage, st.cooldown, rng, events);
      continue;
    }

    if (e.class === "unit") chase(state, e, target);
  }
  state.rngState = rng.state;
  return events;
}
