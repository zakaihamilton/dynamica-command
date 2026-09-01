import { isSupportUnit, UNIT_STATS } from "../../catalog";
import { isUnitEntity, type BuildingKind, type Command, type Entity, type MissionKind, type SimState, type UnitKind } from "../../types";
import { living } from "../world";

export const COMMANDER_CADENCE = 24;
export const COMBAT_ORDER_REFRESH = 96;
export const BUILDING_RESERVE = 180;
export const YARD_THREAT_RADIUS = 18;
// Keep this list aligned with generated structure-quota objectives. Barracks
// and factories are single-instance buildings, so asking the commander to
// build another one would produce a rejected command forever.
export const STRUCTURE_QUOTA_KINDS: BuildingKind[] = ["power", "refinery", "turret"];
export const OFFENSIVE_KINDS = new Set<MissionKind>([
  "sabotage",
  "destroyMarked",
  "decapitate",
  "razeAll",
  "annihilate",
]);

export type CommanderMetrics = {
  plans: number;
  commands: number;
  commandsByType: Partial<Record<Command["type"], number>>;
};

export function playerBuildings(state: SimState, kind?: BuildingKind): Entity[] {
  return living(state).filter(
    (entity) => entity.owner === 0 && entity.class === "building" && (kind === undefined || entity.kind === kind),
  );
}

export function playerUnits(state: SimState, predicate?: (entity: Entity) => boolean): Entity[] {
  return living(state).filter(
    (entity) => entity.owner === 0 && entity.class === "unit" && !entity.neutral && (!predicate || predicate(entity)),
  );
}

export function enemyEntities(state: SimState): Entity[] {
  return living(state).filter((entity) => entity.owner === 1);
}

export function combatUnits(state: SimState): Entity[] {
  return playerUnits(
    state,
    (entity) => isUnitEntity(entity) && UNIT_STATS[entity.kind].damage > 0 && !isSupportUnit(entity.kind),
  );
}

export function readyProducers(state: SimState, kind: BuildingKind): Entity[] {
  return playerBuildings(state, kind).filter((entity) => entity.constructing === 0);
}

export function queuedUnitCount(state: SimState, kind: UnitKind): number {
  return playerBuildings(state).reduce((count, producer) => {
    const active = producer.producing?.kind === kind ? 1 : 0;
    const queued = producer.queue?.filter((item) => item === kind).length ?? 0;
    return count + active + queued;
  }, 0);
}

export function totalUnitCount(state: SimState, kind: UnitKind): number {
  return playerUnits(state, (entity) => entity.kind === kind).length;
}

export function completedOrBuilding(state: SimState, kind: BuildingKind): number {
  return playerBuildings(state, kind).length;
}

export function combatValue(entity: Entity): number {
  if (entity.kind === "tank") return 4;
  if (entity.kind === "antiArmor") return 3;
  if (entity.kind === "infantry") return 1;
  return 0;
}

export function isCombatEntity(entity: Entity): boolean {
  return isUnitEntity(entity) && UNIT_STATS[entity.kind].damage > 0 && !isSupportUnit(entity.kind);
}

export function objectiveKind(state: SimState): MissionKind {
  return state.win.kind;
}

export function commanderCadence(): number {
  return COMMANDER_CADENCE;
}
