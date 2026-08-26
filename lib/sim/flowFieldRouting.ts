import type { Entity, SimState } from "../types";
import { flowFieldFor, flowStep } from "./flowField";
import { routePendingFor } from "./pathfinding";
import { tryFindPathDetailed } from "./pathBudget";

const FLOW_PATH_PREFIX_LENGTH = 1;

/** Prepare a short shared-field path prefix for each active group follower. */
export function prepareFlowFieldRoutes(state: SimState): void {
  const fields = new Map<string, ReturnType<typeof flowFieldFor>>();
  for (const entity of state.entities) {
    if (entity.hp <= 0 || entity.class !== "unit" || !entity.flowGoal || !entity.orderDestination) continue;
    const destination = entity.orderDestination;
    const closeToFormationSlot = Math.max(
      Math.abs(Math.round(entity.x) - Math.round(destination.x)),
      Math.abs(Math.round(entity.y) - Math.round(destination.y)),
    ) <= 1;
    if (closeToFormationSlot) {
      finishFlowFieldRoute(state, entity);
      continue;
    }

    const goal = entity.flowGoal;
    const key = `${state.navigationRevision ?? 0}:${Math.round(goal.x)}:${Math.round(goal.y)}`;
    const field = fields.get(key) ?? flowFieldFor(state, goal);
    fields.set(key, field);
    const path: { x: number; y: number }[] = [];
    let cursor = { x: Math.round(entity.x), y: Math.round(entity.y) };
    for (let i = 0; i < FLOW_PATH_PREFIX_LENGTH; i++) {
      const step = flowStep(field, cursor.x, cursor.y);
      if (!step) break;
      path.push(step);
      cursor = step;
    }
    if (!path.length) {
      // Preserve the existing blocked/recovery behavior when a follower is
      // outside the field or terrain has no route to the shared goal.
      finishFlowFieldRoute(state, entity);
      continue;
    }
    entity.path = path;
    entity.routePending = true;
  }
}

function finishFlowFieldRoute(state: SimState, entity: Entity): void {
  entity.flowGoal = undefined;
  entity.path = [];
  const result = tryFindPathDetailed(state, entity, entity.orderDestination!);
  if (!result) {
    entity.routePending = true;
    return;
  }
  entity.path = result.path;
  entity.routePending = routePendingFor(result.status);
  entity.idle = result.status === "unreachable";
}
