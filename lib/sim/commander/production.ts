import {
  BUILDING_STATS,
  UNIT_STATS,
  isSupportUnit,
  isUnitAvailable,
  producerFor,
  productionQueueSize,
} from "../../catalog";
import { isUnitEntity, type BuildingKind, type Command, type Entity, type SimState, type UnitKind } from "../../types";
import {
  canPlaceBuilding,
  distToEntity,
  findBuildSite,
  powerBreakdown,
  powerFor,
} from "../world";
import {
  BUILDING_RESERVE,
  OFFENSIVE_KINDS,
  STRUCTURE_QUOTA_KINDS,
  YARD_THREAT_RADIUS,
  completedOrBuilding,
  enemyEntities,
  objectiveKind,
  playerBuildings,
  playerUnits,
  queuedUnitCount,
  readyProducers,
  totalUnitCount,
} from "./queries";

export function targetForProduction(state: SimState): UnitKind | undefined {
  const role = state.win.role;
  if (role && isUnitAvailable(role, state.missionIndex)) {
    const produced = state.unitsProducedByRole[role] ?? 0;
    const queued = queuedUnitCount(state, role);
    if (produced + queued < (state.win.target ?? Infinity)) return role;
  }

  const harvesters = totalUnitCount(state, "harvester") + queuedUnitCount(state, "harvester");
  const wantsExtraHarvester = readyProducers(state, "factory").length > 0 && harvesters < 2 && (
    state.tick < 1200 || objectiveKind(state) === "harvestQuota"
  );
  if (wantsExtraHarvester) {
    return "harvester";
  }

  const enemyTanks = enemyEntities(state).filter((entity) => entity.kind === "tank").length;
  const playerAntiArmor = totalUnitCount(state, "antiArmor") + queuedUnitCount(state, "antiArmor");
  if (enemyTanks > playerAntiArmor) return "antiArmor";

  const desiredTanks = Math.min(4, 1 + Math.floor(state.missionIndex / 2));
  const tanks = totalUnitCount(state, "tank") + queuedUnitCount(state, "tank");
  if (tanks < desiredTanks && readyProducers(state, "factory").length) return "tank";

  return "infantry";
}

export function supportNeed(state: SimState): UnitKind | undefined {
  if (state.missionIndex < 2) return undefined;
  const humansWounded = playerUnits(
    state,
    (entity) => isUnitEntity(entity) && !isSupportUnit(entity.kind) && UNIT_STATS[entity.kind].domain === "human" && entity.hp < entity.maxHp,
  ).length > 0;
  const vehiclesWounded = playerUnits(
    state,
    (entity) => isUnitEntity(entity) && !isSupportUnit(entity.kind) && UNIT_STATS[entity.kind].domain === "vehicle" && entity.hp < entity.maxHp,
  ).length > 0;
  if (humansWounded && totalUnitCount(state, "medic") + queuedUnitCount(state, "medic") === 0) return "medic";
  if (vehiclesWounded && totalUnitCount(state, "repairTruck") + queuedUnitCount(state, "repairTruck") === 0) return "repairTruck";
  return undefined;
}

export function missingStructureQuota(state: SimState): BuildingKind | undefined {
  if (objectiveKind(state) !== "structureQuota" || !state.win.building) return undefined;
  const built = state.buildingsCompletedByKind[state.win.building] ?? 0;
  const constructing = playerBuildings(state, state.win.building).filter((entity) => entity.constructing > 0).length;
  return built + constructing < (state.win.target ?? Infinity) ? state.win.building : undefined;
}

function structureQuotaProgress(state: SimState, kind?: BuildingKind): number {
  if (kind) {
    return (state.buildingsCompletedByKind[kind] ?? 0) + playerBuildings(state, kind).filter((entity) => entity.constructing > 0).length;
  }
  return state.buildingsCompleted[0] + playerBuildings(state).filter((entity) => entity.constructing > 0).length;
}

function structureQuotaBuilding(state: SimState): BuildingKind | undefined {
  if (objectiveKind(state) !== "structureQuota") return undefined;
  const target = state.win.target ?? Infinity;
  if (structureQuotaProgress(state, state.win.building) >= target) return undefined;
  if (state.win.building) return state.win.building;

  return [...STRUCTURE_QUOTA_KINDS]
    .sort((a, b) => structureQuotaProgress(state, a) - structureQuotaProgress(state, b) || BUILDING_STATS[a].cost - BUILDING_STATS[b].cost)
    .find((kind) => structureQuotaProgress(state, kind) < target);
}

function buildCommand(state: SimState, kind: BuildingKind, near: Entity): Command | undefined {
  const cost = BUILDING_STATS[kind].cost;
  const reserve = objectiveKind(state) === "structureQuota" ? 0 : BUILDING_RESERVE;
  if (state.credits[0] < cost + reserve) return undefined;
  const site = findBuildSite(state, kind, near.x + 3, near.y, 14, 0);
  if (!site || !canPlaceBuilding(state, kind, site.x, site.y, 0)) return undefined;
  return { type: "build", building: kind, x: site.x, y: site.y };
}

export function planBuilding(state: SimState, yard: Entity): Command | undefined {
  const power = powerBreakdown(state, 0);
  const pending = playerBuildings(state).some((entity) => entity.constructing > 0);
  if (power.surplus < 15 && !playerBuildings(state, "power").some((entity) => entity.constructing > 0)) {
    const powerBuild = buildCommand(state, "power", yard);
    if (powerBuild) return powerBuild;
  }

  const threat = enemyEntities(state).find(
    (entity) => entity.class === "unit" && entity.kind !== "harvester" && distToEntity(yard, entity) <= YARD_THREAT_RADIUS,
  );
  const turretCount = completedOrBuilding(state, "turret");
  if (threat && turretCount < 1 && !pending) {
    const turret = buildCommand(state, "turret", yard);
    if (turret) return turret;
  }

  const objectiveBuilding = missingStructureQuota(state) ?? structureQuotaBuilding(state);
  if (objectiveBuilding && !playerBuildings(state, objectiveBuilding).some((entity) => entity.constructing > 0)) {
    const objectiveBuild = buildCommand(state, objectiveBuilding, yard);
    if (objectiveBuild) return objectiveBuild;
  }

  if (!playerBuildings(state, "barracks").length && !pending) {
    const barracks = buildCommand(state, "barracks", yard);
    if (barracks) return barracks;
  }

  const needsFactory = objectiveKind(state) === "forceQuota" && state.win.role === "tank"
    ? true
    : state.missionIndex >= 1 || objectiveKind(state) === "harvestQuota" || OFFENSIVE_KINDS.has(objectiveKind(state));
  if (needsFactory && !playerBuildings(state, "factory").length && !pending) {
    const factory = buildCommand(state, "factory", yard);
    if (factory) return factory;
  }

  if (!playerBuildings(state, "factory").length && state.tick < 1800 && !pending) {
    const factory = buildCommand(state, "factory", yard);
    if (factory) return factory;
  }

  const defensiveTurretNeeded = power.surplus >= 15 && (threat !== undefined || OFFENSIVE_KINDS.has(objectiveKind(state)));
  if (defensiveTurretNeeded && turretCount < 1 + Math.floor(state.missionIndex / 3) && !pending) {
    const turret = buildCommand(state, "turret", yard);
    if (turret) return turret;
  }
  return undefined;
}

export function planProduction(state: SimState): Command[] {
  const commands: Command[] = [];
  if (objectiveKind(state) === "structureQuota" && structureQuotaBuilding(state)) return commands;
  const support = supportNeed(state);
  const offensive = OFFENSIVE_KINDS.has(objectiveKind(state));
  const role = state.win.role && isUnitAvailable(state.win.role, state.missionIndex)
    && (state.unitsProducedByRole[state.win.role] ?? 0) + queuedUnitCount(state, state.win.role) < (state.win.target ?? Infinity)
    ? state.win.role
    : undefined;
  const producers = [...readyProducers(state, "barracks"), ...readyProducers(state, "factory")]
    .sort((a, b) => {
      const priority = role ?? support;
      const aPriority = priority && producerFor(priority) === a.kind ? 0 : 1;
      const bPriority = priority && producerFor(priority) === b.kind ? 0 : 1;
      return aPriority - bPriority || a.id - b.id;
    });
  let availableCredits = state.credits[0];
  for (const producer of producers) {
    if (productionQueueSize(producer) >= 3) continue;
    if (role && producerFor(role) !== producer.kind && availableCredits < UNIT_STATS[role].cost) continue;
    let desired: UnitKind | undefined;
    if (support && producerFor(support) === producer.kind) {
      desired = support;
    } else if (role && producerFor(role) === producer.kind) {
      desired = role;
    } else if (offensive && producer.kind === "factory") {
      const harvesters = totalUnitCount(state, "harvester") + queuedUnitCount(state, "harvester");
      const wantsExtraHarvester = harvesters < 2 && state.tick < 1200;
      desired = wantsExtraHarvester ? "harvester" : "tank";
    } else if (offensive && producer.kind === "barracks") {
      const antiArmorTarget = 5 + Math.floor(state.missionIndex / 2);
      const antiArmor = totalUnitCount(state, "antiArmor") + queuedUnitCount(state, "antiArmor");
      desired = antiArmor < antiArmorTarget ? "antiArmor" : "infantry";
    } else {
      const combat = targetForProduction(state);
      desired = combat && producerFor(combat) === producer.kind
        ? combat
        : producer.kind === "factory" ? "tank" : "infantry";
    }
    if (!desired || !isUnitAvailable(desired, state.missionIndex)) continue;
    if (availableCredits < UNIT_STATS[desired].cost || powerFor(state, 0) < 0) continue;
    commands.push({ type: "produce", fromId: producer.id, unit: desired });
    availableCredits -= UNIT_STATS[desired].cost;
    if (commands.length >= 2) break;
  }
  return commands;
}

