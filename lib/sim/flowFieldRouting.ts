import type { Entity, SimState } from "../types";
import { flowCellTaken, flowDistanceAt, flowFieldFor, flowStep, type FlowField } from "./flowField";
import { routePendingFor } from "./pathfinding";
import { tryFindPathDetailed } from "./pathBudget";

const FLOW_PATH_PREFIX_LENGTH = 1;

type RankedFollower = { entity: Entity; field: FlowField; dist: number };
type FlowRoutingBuffers = {
  fields: Map<string, FlowField>;
  followers: Entity[];
  ranked: RankedFollower[];
};

const flowRoutingBuffers = new WeakMap<SimState, FlowRoutingBuffers>();

function buffersFor(state: SimState): FlowRoutingBuffers {
  const cached = flowRoutingBuffers.get(state);
  if (cached) {
    cached.fields.clear();
    cached.followers.length = 0;
    cached.ranked.length = 0;
    return cached;
  }
  const buffers = { fields: new Map<string, FlowField>(), followers: [], ranked: [] };
  flowRoutingBuffers.set(state, buffers);
  return buffers;
}

/** Prepare a short shared-field path prefix for each active group follower. */
export function prepareFlowFieldRoutes(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
): void {
  const { fields, followers, ranked } = buffersFor(state);
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
      entity.routePending = true;
      continue;
    }
    followers.push(entity);
  }

  for (let i = 0; i < followers.length; i++) {
    const entity = followers[i]!;
    const goal = entity.flowGoal!;
    const key = `${state.navigationRevision ?? 0}:${Math.round(goal.x)}:${Math.round(goal.y)}`;
    const field = fields.get(key) ?? flowFieldFor(state, goal);
    fields.set(key, field);
    const entry = ranked[i] ?? { entity, field, dist: 0 };
    entry.entity = entity;
    entry.field = field;
    entry.dist = flowDistanceAt(field, entity.x, entity.y);
    ranked[i] = entry;
  }
  ranked.length = followers.length;
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
  const cursorX = Math.round(entity.x);
  const cursorY = Math.round(entity.y);
  const next = FLOW_PATH_PREFIX_LENGTH > 0
    ? flowStep(field, cursorX, cursorY, { occupancy, reserved, ignoreId: entity.id, state })
    : undefined;

  const existing = entity.path[0];
  const nextFree = next ? prefixCellOpen(state, occupancy, reserved, entity.id, next.x, next.y) : false;
  const existingFree = existing ? prefixCellOpen(state, occupancy, reserved, entity.id, existing.x, existing.y) : false;

  if (next && nextFree) {
    entity.path = [next];
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
    entity.path = [next];
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
