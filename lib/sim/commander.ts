import {
  BUILDING_STATS,
  UNIT_STATS,
  isSupportUnit,
  isUnitAvailable,
  producerFor,
  productionQueueSize,
} from "../catalog";
import { inObjectiveZone } from "../types";
import type { BuildingKind, Command, Entity, MissionKind, SimState, UnitKind } from "../types";
import {
  canPlaceBuilding,
  distToEntity,
  findBuildSite,
  living,
  powerBreakdown,
  powerFor,
} from "./world";

const COMMANDER_CADENCE = 24;
const COMBAT_ORDER_REFRESH = 96;
const BUILDING_RESERVE = 180;
const YARD_THREAT_RADIUS = 18;
const OFFENSIVE_KINDS = new Set<MissionKind>([
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

function playerBuildings(state: SimState, kind?: BuildingKind): Entity[] {
  return living(state).filter(
    (entity) => entity.owner === 0 && entity.class === "building" && (kind === undefined || entity.kind === kind),
  );
}

function playerUnits(state: SimState, predicate?: (entity: Entity) => boolean): Entity[] {
  return living(state).filter(
    (entity) => entity.owner === 0 && entity.class === "unit" && !entity.neutral && (!predicate || predicate(entity)),
  );
}

function enemyEntities(state: SimState): Entity[] {
  return living(state).filter((entity) => entity.owner === 1);
}

function combatUnits(state: SimState): Entity[] {
  return playerUnits(
    state,
    (entity) => entity.kind !== "harvester" && !isSupportUnit(entity.kind as UnitKind),
  );
}

function readyProducers(state: SimState, kind: BuildingKind): Entity[] {
  return playerBuildings(state, kind).filter((entity) => entity.constructing === 0);
}

function queuedUnitCount(state: SimState, kind: UnitKind): number {
  return playerBuildings(state).reduce((count, producer) => {
    const active = producer.producing?.kind === kind ? 1 : 0;
    const queued = producer.queue?.filter((item) => item === kind).length ?? 0;
    return count + active + queued;
  }, 0);
}

function totalUnitCount(state: SimState, kind: UnitKind): number {
  return playerUnits(state, (entity) => entity.kind === kind).length;
}

function completedOrBuilding(state: SimState, kind: BuildingKind): number {
  return playerBuildings(state, kind).length;
}

function combatValue(entity: Entity): number {
  if (entity.kind === "tank") return 4;
  if (entity.kind === "antiArmor") return 3;
  if (entity.kind === "infantry") return 1;
  return 0;
}

function isCombatEntity(entity: Entity): boolean {
  return entity.class === "unit" && entity.kind !== "harvester" && !isSupportUnit(entity.kind as UnitKind);
}

function objectiveKind(state: SimState): MissionKind {
  return state.win.kind;
}

function targetForProduction(state: SimState): UnitKind | undefined {
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

function supportNeed(state: SimState): UnitKind | undefined {
  if (state.missionIndex < 2) return undefined;
  const humansWounded = playerUnits(
    state,
    (entity) => !isSupportUnit(entity.kind as UnitKind) && UNIT_STATS[entity.kind as UnitKind].domain === "human" && entity.hp < entity.maxHp,
  ).length > 0;
  const vehiclesWounded = playerUnits(
    state,
    (entity) => !isSupportUnit(entity.kind as UnitKind) && UNIT_STATS[entity.kind as UnitKind].domain === "vehicle" && entity.hp < entity.maxHp,
  ).length > 0;
  if (humansWounded && totalUnitCount(state, "medic") + queuedUnitCount(state, "medic") === 0) return "medic";
  if (vehiclesWounded && totalUnitCount(state, "repairTruck") + queuedUnitCount(state, "repairTruck") === 0) return "repairTruck";
  return undefined;
}

function missingStructureQuota(state: SimState): BuildingKind | undefined {
  if (objectiveKind(state) !== "structureQuota" || !state.win.building) return undefined;
  const built = state.buildingsCompletedByKind[state.win.building] ?? 0;
  const constructing = playerBuildings(state, state.win.building).filter((entity) => entity.constructing > 0).length;
  return built + constructing < (state.win.target ?? Infinity) ? state.win.building : undefined;
}

function buildCommand(state: SimState, kind: BuildingKind, near: Entity): Command | undefined {
  const cost = BUILDING_STATS[kind].cost;
  if (state.credits[0] < cost + BUILDING_RESERVE) return undefined;
  const site = findBuildSite(state, kind, near.x + 3, near.y, 14, 0);
  if (!site || !canPlaceBuilding(state, kind, site.x, site.y, 0)) return undefined;
  return { type: "build", building: kind, x: site.x, y: site.y };
}

function planBuilding(state: SimState, yard: Entity): Command | undefined {
  const power = powerBreakdown(state, 0);
  const pending = playerBuildings(state).some((entity) => entity.constructing > 0);
  if (power.surplus < 15 && !playerBuildings(state, "power").some((entity) => entity.constructing > 0)) {
    const powerBuild = buildCommand(state, "power", yard);
    if (powerBuild) return powerBuild;
  }

  const objectiveBuilding = missingStructureQuota(state);
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

  const threat = enemyEntities(state).find(
    (entity) => entity.class === "unit" && entity.kind !== "harvester" && distToEntity(yard, entity) <= YARD_THREAT_RADIUS,
  );
  const turretCount = completedOrBuilding(state, "turret");
  const defensiveTurretNeeded = threat !== undefined || OFFENSIVE_KINDS.has(objectiveKind(state));
  if (defensiveTurretNeeded && turretCount < 1 + Math.floor(state.missionIndex / 3) && !pending) {
    const turret = buildCommand(state, "turret", yard);
    if (turret) return turret;
  }

  const factoryLimit = OFFENSIVE_KINDS.has(objectiveKind(state)) ? 2 : 1;
  if (playerBuildings(state, "factory").length < factoryLimit && state.tick < 1800 && !pending) {
    const factory = buildCommand(state, "factory", yard);
    if (factory) return factory;
  }
  return undefined;
}

function planProduction(state: SimState): Command[] {
  const commands: Command[] = [];
  const support = supportNeed(state);
  const offensive = OFFENSIVE_KINDS.has(objectiveKind(state));
  const role = state.win.role && isUnitAvailable(state.win.role, state.missionIndex)
    && (state.unitsProducedByRole[state.win.role] ?? 0) + queuedUnitCount(state, state.win.role) < (state.win.target ?? Infinity)
    ? state.win.role
    : undefined;
  const producers = [...readyProducers(state, "barracks"), ...readyProducers(state, "factory")];
  let availableCredits = state.credits[0];
  for (const producer of producers) {
    if (productionQueueSize(producer) >= 3) continue;
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

function objectiveEntity(state: SimState): Entity | undefined {
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

function defensiveThreat(state: SimState, yard: Entity): Entity | undefined {
  return enemyEntities(state)
    .filter((entity) => isCombatEntity(entity))
    .sort((a, b) => distToEntity(yard, a) - distToEntity(yard, b) || a.id - b.id)
    .find((entity) => distToEntity(yard, entity) <= YARD_THREAT_RADIUS);
}

function scenarioThreat(state: SimState): Entity | undefined {
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

function assaultReady(state: SimState, target: Entity, combat: Entity[]): boolean {
  if (!OFFENSIVE_KINDS.has(objectiveKind(state)) || target.owner !== 1) return true;
  const minimumUnits = objectiveKind(state) === "annihilate" || objectiveKind(state) === "razeAll"
    ? 8 + state.missionIndex
    : 5 + Math.floor(state.missionIndex / 2);
  if (combat.length < minimumUnits) return false;

  const playerStrength = combat.reduce((sum, entity) => sum + combatValue(entity), 0);
  const enemyStrength = enemyEntities(state)
    .filter((entity) => isCombatEntity(entity) && distToEntity(target, entity) <= 22)
    .reduce((sum, entity) => sum + combatValue(entity), 0);
  if (enemyStrength === 0 || playerStrength >= enemyStrength * 0.5) return true;

  // A deadline turns the final 60% of a scenario into an intentional commit window.
  const deadline = state.runtime?.deadline ?? state.win.ticks;
  return deadline !== undefined && state.tick >= deadline * 0.4;
}

function orderKey(command: Command): string {
  if (command.type === "attack") return `attack:${command.targetId}`;
  if (command.type === "move" || command.type === "attackMove") return `${command.type}:${command.x}:${command.y}`;
  return command.type;
}

/**
 * A deterministic, intentionally conservative commander for balance and regression runs.
 * It uses only public simulation state and the same commands available to a player.
 */
export class CompetentCommander {
  private lastCombatOrder = "";
  private lastCombatOrderTick = Number.NEGATIVE_INFINITY;
  private metrics: CommanderMetrics = { plans: 0, commands: 0, commandsByType: {} };

  plan(state: SimState): Command[] {
    if (state.result !== "playing" || state.tutorialStage !== undefined || state.tick % COMMANDER_CADENCE !== 0) return [];
    const yard = playerBuildings(state, "constructionYard")[0];
    if (!yard) return [];

    this.metrics.plans += 1;
    const commands: Command[] = [];
    const building = planBuilding(state, yard);
    if (building) commands.push(building);
    if (!building) commands.push(...planProduction(state));

    const threat = defensiveThreat(state, yard) ?? scenarioThreat(state);
    const objective = objectiveEntity(state);
    const extractionCargo = objectiveKind(state) === "extraction"
      ? (state.runtime?.targetIds ?? []).map((id) => state.entities.find((entity) => entity.id === id && entity.hp > 0)).filter((entity): entity is Entity => !!entity && !entity.neutral && !inObjectiveZone(entity.x, entity.y, state.runtime?.zone))
      : [];
    const extractionCargoIds = new Set(extractionCargo.map((entity) => entity.id));
    const extractionEscortTarget = [...extractionCargo]
      .sort((a, b) => distToEntity(b, yard) - distToEntity(a, yard) || a.id - b.id)[0];
    const combat = combatUnits(state);
    const objectiveCombat = objectiveKind(state) === "extraction"
      ? combat.filter((entity) => !extractionCargoIds.has(entity.id))
      : combat;
    const scenarioObjective = ["escort", "rescue", "extraction"].includes(objectiveKind(state)) && (
      objective?.neutral === true || extractionCargo.length > 0
    );

    if (extractionCargo.length) {
      commands.push({ type: "move", unitIds: extractionCargo.map((entity) => entity.id), x: yard.x, y: yard.y, formation: "line" });
    }

    if (combat.length) {
      const combatCommands: Command[] = [];
      const offensiveObjective = objective && objective.owner === 1 && OFFENSIVE_KINDS.has(objectiveKind(state));
      const defenderLimit = Math.min(4, Math.max(2, Math.floor(combat.length / 3)));
      const reservedDefenders = scenarioObjective ? Math.min(defenderLimit, Math.max(0, objectiveCombat.length - 1)) : defenderLimit;
      const defenders = (threat || offensiveObjective || scenarioObjective)
        ? [...objectiveCombat]
          .sort((a, b) => distToEntity(a, yard) - distToEntity(b, yard) || a.id - b.id)
          .slice(0, reservedDefenders)
        : [];
      const defenderIds = new Set(defenders.map((entity) => entity.id));
      const assaultForce = offensiveObjective || scenarioObjective
        ? objectiveCombat.filter((entity) => !defenderIds.has(entity.id))
        : combat;

      if (offensiveObjective && objective) {
        if (assaultReady(state, objective, combat) && assaultForce.length) {
          if (defenders.length) {
            combatCommands.push(threat
              ? { type: "attack", unitIds: defenders.map((entity) => entity.id), targetId: threat.id }
              : { type: "move", unitIds: defenders.map((entity) => entity.id), x: yard.x, y: yard.y, formation: "line" });
          }
          combatCommands.push({ type: "attack", unitIds: assaultForce.map((entity) => entity.id), targetId: objective.id });
        } else if (threat) {
          combatCommands.push({ type: "attack", unitIds: combat.map((entity) => entity.id), targetId: threat.id });
        } else {
          combatCommands.push({ type: "move", unitIds: combat.map((entity) => entity.id), x: yard.x, y: yard.y, formation: "line" });
        }
      } else if (threat) {
        if (objectiveKind(state) === "extraction" && extractionEscortTarget && objectiveCombat.length) {
          combatCommands.push({ type: "attackMove", unitIds: objectiveCombat.map((entity) => entity.id), x: extractionEscortTarget.x, y: extractionEscortTarget.y, formation: "wedge" });
        } else {
          combatCommands.push({ type: "attack", unitIds: combat.map((entity) => entity.id), targetId: threat.id });
        }
      } else {
        const force = scenarioObjective ? assaultForce : combat;
        const extractionRecovery = objectiveKind(state) === "extraction" && extractionCargo.length > 0 && objective?.neutral !== true;
        if (scenarioObjective && defenders.length) {
          combatCommands.push({ type: "move", unitIds: defenders.map((entity) => entity.id), x: yard.x, y: yard.y, formation: "line" });
        }
        if (force.length && extractionRecovery) {
          const needsCargoEscort = extractionEscortTarget !== undefined && force.some((entity) => distToEntity(entity, extractionEscortTarget) > 6);
          const recoveryDestination = needsCargoEscort ? extractionEscortTarget : yard;
          combatCommands.push({ type: "attackMove", unitIds: force.map((entity) => entity.id), x: recoveryDestination.x, y: recoveryDestination.y, formation: "line" });
        } else if (force.length && objective && (objective.neutral || objective.class === "unit" && objective.owner === 0)) {
          const escortDestination = objectiveKind(state) === "escort" && state.runtime?.zone
            ? state.runtime.zone
            : { x: objective.x, y: objective.y };
          if (objectiveKind(state) === "escort") {
            combatCommands.push({ type: "attackMove", unitIds: force.map((entity) => entity.id), x: escortDestination.x, y: escortDestination.y, formation: "wedge" });
          } else {
            combatCommands.push({ type: "move", unitIds: force.map((entity) => entity.id), x: objective.x, y: objective.y, formation: "wedge" });
          }
        } else if (force.length && ["harvestQuota", "forceQuota", "structureQuota", "holdTheLine"].includes(objectiveKind(state))) {
          combatCommands.push({ type: "move", unitIds: force.map((entity) => entity.id), x: yard.x, y: yard.y, formation: "line" });
        }
      }

      if (combatCommands.length) {
        const key = combatCommands
          .map((command) => `${orderKey(command)}:${"unitIds" in command ? command.unitIds.join(",") : ""}`)
          .join("|");
        if (key !== this.lastCombatOrder || state.tick - this.lastCombatOrderTick >= COMBAT_ORDER_REFRESH) {
          commands.push(...combatCommands);
          this.lastCombatOrder = key;
          this.lastCombatOrderTick = state.tick;
        }
      }
    }

    this.metrics.commands += commands.length;
    for (const command of commands) {
      this.metrics.commandsByType[command.type] = (this.metrics.commandsByType[command.type] ?? 0) + 1;
    }
    return commands;
  }

  getMetrics(): CommanderMetrics {
    return {
      plans: this.metrics.plans,
      commands: this.metrics.commands,
      commandsByType: { ...this.metrics.commandsByType },
    };
  }
}

export function commanderCadence(): number {
  return COMMANDER_CADENCE;
}
