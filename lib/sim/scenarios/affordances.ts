import type { SimState } from "../../types";
import { findPathDetailed } from "../pathfinding";

export type ScenarioAffordances = {
  targetDepth: number;
  routeLength: number;
  targetReachable: boolean;
};

/** Measures the generated scenario without adding metadata to persisted state. */
export function scenarioAffordances(state: SimState): ScenarioAffordances {
  const playerYard = state.entities.find(
    (entity) => entity.owner === 0 && entity.class === "building" && entity.kind === "constructionYard" && entity.hp > 0,
  );
  const enemyYard = state.entities.find(
    (entity) => entity.owner === 1 && entity.class === "building" && entity.kind === "constructionYard" && entity.hp > 0,
  );
  const targetId = state.runtime?.targetIds[0];
  const target = targetId === undefined
    ? enemyYard
    : state.entities.find((entity) => entity.id === targetId);
  if (!playerYard || !target) return { targetDepth: 0, routeLength: 0, targetReachable: false };
  const route = findPathDetailed(state, playerYard, target);
  const baseDistance = enemyYard ? Math.max(1, Math.hypot(enemyYard.x - playerYard.x, enemyYard.y - playerYard.y)) : 1;
  const targetDistance = Math.hypot(target.x - playerYard.x, target.y - playerYard.y);
  return {
    targetDepth: Math.min(1, targetDistance / baseDistance),
    routeLength: route.status === "complete" ? route.path.length : 0,
    targetReachable: route.status === "complete",
  };
}
