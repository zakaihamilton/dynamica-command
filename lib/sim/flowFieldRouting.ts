import type { Entity, SimState, Vec2 } from "../types";
import { flowCellTaken, flowDistanceAt, flowFieldFor, flowStep, type FlowField } from "./flowField";
import { routePendingFor } from "./pathfinding";
import { tryFindPathDetailed } from "./pathBudget";

const FLOW_PATH_PREFIX_LENGTH = 1;

/** Prepare a short shared-field path prefix for each active group follower. */
export function prepareFlowFieldRoutes(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
): void {
  const fields = new Map<string, FlowField>();
  const followers: Entity[] = [];
  for (const entity of state.entities) {
    if (entity.hp <= 0 || entity.class !== "unit" || !entity.flowGoal || !entity.orderDestination) continue;
    const destination = entity.orderDestination;
    const personalCheb = Math.max(
      Math.abs(Math.round(entity.x) - Math.round(destination.x)),
      Math.abs(Math.round(entity.y) - Math.round(destination.y)),
    );
    const goal = entity.flowGoal;
    const sharedCheb = Math.max(
      Math.abs(Math.round(entity.x) - Math.round(goal.x)),
      Math.abs(Math.round(entity.y) - Math.round(goal.y)),
    );
    if (personalCheb <= 2 || sharedCheb <= 2) {
      if (finishFlowFieldRoute(state, entity)) continue;
      // Stay put until A* budget is available. A leftover shared-field prefix
      // would keep walking the rally instead of the personal slot.
      entity.path = [];
      entity.routePending = true;
      continue;
    }
    followers.push(entity);
  }

  const ranked = followers.map((entity) => {
    const goal = entity.flowGoal!;
    const key = `${state.navigationRevision ?? 0}:${Math.round(goal.x)}:${Math.round(goal.y)}`;
    const field = fields.get(key) ?? flowFieldFor(state, goal);
    fields.set(key, field);
    return { entity, field, dist: flowDistanceAt(field, entity.x, entity.y) };
  });
  ranked.sort((a, b) => a.dist - b.dist || a.entity.id - b.entity.id);

  for (const { entity, field } of ranked) {
    assignFlowPrefix(state, occupancy, reserved, entity, field);
  }
}

function assignFlowPrefix(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  entity: Entity,
  field: FlowField,
): void {
  const path: Vec2[] = [];
  let cursor = { x: Math.round(entity.x), y: Math.round(entity.y) };
  for (let i = 0; i < FLOW_PATH_PREFIX_LENGTH; i++) {
    const step = flowStep(field, cursor.x, cursor.y, {
      occupancy,
      reserved,
      ignoreId: entity.id,
      state,
    });
    if (!step) break;
    path.push(step);
    cursor = step;
  }

  const next = path[0];
  const existing = entity.path[0];
  const nextFree = next ? prefixCellOpen(state, occupancy, reserved, entity.id, next.x, next.y) : false;
  const existingFree = existing ? prefixCellOpen(state, occupancy, reserved, entity.id, existing.x, existing.y) : false;

  if (next && nextFree) {
    entity.path = path;
    entity.routePending = true;
    reserveCell(state, reserved, entity.id, next.x, next.y);
    return;
  }
  if (existingFree && existing) {
    entity.routePending = true;
    reserveCell(state, reserved, entity.id, existing.x, existing.y);
    return;
  }
  if (next) {
    entity.path = path;
    entity.routePending = true;
    return;
  }
  if (finishFlowFieldRoute(state, entity)) return;
  entity.routePending = true;
}

function prefixCellOpen(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  ignoreId: number,
  x: number,
  y: number,
): boolean {
  return !flowCellTaken(occupancy, reserved, state.width, Math.round(x), Math.round(y), ignoreId);
}

function reserveCell(state: SimState, reserved: Map<number, number>, id: number, x: number, y: number): void {
  reserved.set(Math.round(y) * state.width + Math.round(x), id);
}

function finishFlowFieldRoute(state: SimState, entity: Entity): boolean {
  const result = tryFindPathDetailed(state, entity, entity.orderDestination!);
  if (!result) return false;
  entity.flowGoal = undefined;
  entity.path = result.path;
  entity.routePending = routePendingFor(result.status);
  entity.idle = result.status === "unreachable";
  return true;
}
