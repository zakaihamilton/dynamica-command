import { BUILDING_STATS, UNIT_STATS } from "../../catalog";
import { isBuildingEntity, isUnitEntity, type Entity, type SimState } from "../../types";

export type CombatGrid = {
  state: SimState;
  cols: number;
  rows: number;
  cells: Entity[][];
  order: Map<number, number>;
  all: Entity[];
};

const CELL = 8;

export function isCombatTarget(state: SimState, e: Entity): boolean {
  if (e.scenarioRole === "convoy" && state.runtime?.convoyStartTick !== undefined) return false;
  return !e.neutral || e.scenarioRole === "convoy";
}

export function isCombatThreat(state: SimState, e: Entity): boolean {
  if (!isCombatTarget(state, e)) return false;
  if (e.class === "building" && e.constructing > 0) return false;
  return statsFor(e).damage > 0;
}

export function statsFor(e: Entity): { damage: number; range: number; cooldown: number; weapon: import("../../types").WeaponType; splashRadius: number; suppression: number } {
  if (isUnitEntity(e)) return UNIT_STATS[e.kind];
  if (e.kind === "turret") {
    return { damage: 9, range: 5.5, cooldown: 14, weapon: "cannon", splashRadius: 0.5, suppression: 10 };
  }
  return { damage: 0, range: 0, cooldown: 0, weapon: "smallArms", splashRadius: 0, suppression: 0 };
}

export function buildGrid(state: SimState): CombatGrid {
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
  return { state, cols, rows, cells, order, all };
}

export function closestEnemy(
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
        if (!isCombatTarget(grid.state, o)) continue;
        if (o.owner === e.owner) continue;
        if (threatsOnly && !isCombatThreat(grid.state, o)) continue;
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

export function acquire(grid: CombatGrid, e: Entity, threatsOnly = false): Entity | undefined {
  const { range } = statsFor(e);
  const sight = isUnitEntity(e)
    ? UNIT_STATS[e.kind].sight
    : isBuildingEntity(e) ? BUILDING_STATS[e.kind].sight : 0;
  return closestEnemy(grid, e, Math.max(range + 4, sight), threatsOnly);
}

export function acquirePreferred(grid: CombatGrid, e: Entity): Entity | undefined {
  return acquire(grid, e, true) ?? acquire(grid, e, false);
}

function living(state: SimState): Entity[] {
  return state.entities.filter((e) => e.hp > 0);
}

function distToEntity(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
