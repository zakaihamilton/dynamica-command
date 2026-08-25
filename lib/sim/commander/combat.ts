import { inObjectiveZone } from "../../types";
import type { Command, Entity, SimState } from "../../types";
import { distToEntity } from "../world";
import {
  OFFENSIVE_KINDS,
  YARD_THREAT_RADIUS,
  combatValue,
  enemyEntities,
  isCombatEntity,
  objectiveKind,
} from "./queries";

export function objectiveEntity(state: SimState): Entity | undefined {
  const kind = objectiveKind(state);
  const targetIds = state.win.targetIds ?? state.runtime?.targetIds ?? [];
  if (kind === "escort" || kind === "rescue" || kind === "extraction") {
    const targets = targetIds
      .map((id) => state.entities.find((entity) => entity.id === id && entity.hp > 0))
      .filter((entity): entity is Entity => !!entity);
    if (kind === "extraction") {
      return targets.find((entity) => entity.neutral) ?? targets.find((entity) => !inObjectiveZone(entity.x, entity.y, state.runtime?.zone));
    }
    return targets.find((entity) => entity.neutral) ?? targets[0];
  }
  if (kind === "sabotage" || kind === "destroyMarked") {
    return targetIds
      .map((id) => state.entities.find((entity) => entity.id === id && entity.hp > 0))
      .find((entity): entity is Entity => !!entity);
  }
  if (kind === "decapitate") return enemyEntities(state).find((entity) => entity.kind === "constructionYard");
  if (kind === "razeAll") return enemyEntities(state).find((entity) => entity.class === "building");
  if (kind === "annihilate") {
    return enemyEntities(state).find((entity) => entity.class === "unit") ?? enemyEntities(state)[0];
  }
  return undefined;
}

export function parallelOffensiveTargets(state: SimState): Entity[] {
  if (objectiveKind(state) !== "sabotage" && objectiveKind(state) !== "destroyMarked") return [];
  const targetIds = state.win.targetIds ?? state.runtime?.targetIds ?? [];
  return targetIds
    .map((id) => state.entities.find((entity) => entity.id === id && entity.hp > 0 && entity.owner === 1))
    .filter((entity): entity is Entity => !!entity);
}

export function defensiveThreat(state: SimState, yard: Entity): Entity | undefined {
  return enemyEntities(state)
    .filter((entity) => isCombatEntity(entity))
    .sort((a, b) => distToEntity(yard, a) - distToEntity(yard, b) || a.id - b.id)
    .find((entity) => distToEntity(yard, entity) <= YARD_THREAT_RADIUS);
}

export function scenarioThreat(state: SimState): Entity | undefined {
  const kind = objectiveKind(state);
  if (kind !== "escort" && kind !== "extraction") return undefined;
  const scenarioTargets = (state.runtime?.targetIds ?? [])
    .map((id) => state.entities.find((entity) => entity.id === id && entity.hp > 0))
    .filter((entity): entity is Entity => !!entity && (kind === "escort" || !entity.neutral));
  if (!scenarioTargets.length) return undefined;
  return enemyEntities(state)
    .filter((entity) => isCombatEntity(entity))
    .sort((a, b) => {
      const aDistance = Math.min(...scenarioTargets.map((target) => distToEntity(target, a)));
      const bDistance = Math.min(...scenarioTargets.map((target) => distToEntity(target, b)));
      return aDistance - bDistance || a.id - b.id;
    })
    .find((entity) => scenarioTargets.some((target) => distToEntity(target, entity) <= YARD_THREAT_RADIUS));
}

export function assaultReady(state: SimState, target: Entity, combat: Entity[]): boolean {
  if (!OFFENSIVE_KINDS.has(objectiveKind(state)) || target.owner !== 1) return true;
  const minimumUnits = objectiveKind(state) === "annihilate" || objectiveKind(state) === "razeAll"
    ? 10 + Math.floor(state.missionIndex / 2)
    : 8 + Math.floor(state.missionIndex / 3);
  if (combat.length < minimumUnits) return false;

  const playerStrength = combat.reduce((sum, entity) => sum + combatValue(entity), 0);
  const enemyStrength = enemyEntities(state)
    .filter((entity) => isCombatEntity(entity) && distToEntity(target, entity) <= 22)
    .reduce((sum, entity) => sum + combatValue(entity), 0);
  if (enemyStrength === 0 || playerStrength >= enemyStrength * 0.5) return true;

  const deadline = state.runtime?.deadline ?? state.win.ticks;
  return deadline !== undefined && state.tick >= deadline * 0.4;
}

export function orderKey(command: Command): string {
  if (command.type === "attack") return `attack:${command.targetId}`;
  if (command.type === "move" || command.type === "attackMove") return `${command.type}:${command.x}:${command.y}`;
  return command.type;
}
