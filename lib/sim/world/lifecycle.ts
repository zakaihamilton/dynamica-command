import type { Entity, SimState } from "../../types";

export function compactDestroyedEntities(state: SimState): number {
  const removedIds = new Set(
    state.entities.filter((entity) => entity.hp <= 0).map((entity) => entity.id),
  );
  if (removedIds.size === 0) return 0;

  for (const entity of state.entities) {
    if (entity.hp <= 0) continue;
    clearDeadReferences(entity, removedIds);
  }
  state.entities = state.entities.filter((entity) => entity.hp > 0);
  return removedIds.size;
}

export function compactedState(state: SimState): SimState {
  if (!Array.isArray(state.entities) || !state.entities.some((entity) => entity.hp <= 0)) return state;
  const copy: SimState = {
    ...state,
    entities: state.entities.map((entity) => ({ ...entity })),
  };
  compactDestroyedEntities(copy);
  return copy;
}

function clearDeadReferences(entity: Entity, removedIds: Set<number>): void {
  if (entity.attackTarget !== undefined && removedIds.has(entity.attackTarget)) {
    entity.attackTarget = undefined;
  }
  if (entity.supportTargetId !== undefined && removedIds.has(entity.supportTargetId)) {
    entity.supportTargetId = undefined;
    if (entity.supportMode === "assigned") entity.supportMode = "auto";
  }
}
