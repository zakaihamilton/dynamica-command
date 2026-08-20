import type { Vec2 } from "../types";
import type { SimState } from "../types";
import { findPath, type FindPathOptions } from "./pathfinding";

/**
 * Shared background search cap for one sim tick: movement detours, combat chase,
 * and AI repath. Player orders and harvester economy use unbounded `findPath`.
 */
export const PATH_BUDGET_PER_TICK = 6;

let remaining = PATH_BUDGET_PER_TICK;
let used = 0;

export function resetPathBudget(limit = PATH_BUDGET_PER_TICK): void {
  remaining = limit;
  used = 0;
}

export function backgroundPathSearches(): number {
  return used;
}

/**
 * Spend one slot from the per-tick pool. Returns `undefined` when the budget is
 * exhausted so callers (AI, combat, crowded detours) keep the unit's prior path.
 */
export function tryFindPath(
  state: SimState,
  from: Vec2,
  to: Vec2,
  opts?: FindPathOptions,
): Vec2[] | undefined {
  if (remaining <= 0) return undefined;
  remaining -= 1;
  used += 1;
  return findPath(state, from, to, opts);
}
