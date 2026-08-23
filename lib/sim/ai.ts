import { BUILDING_STATS, UNIT_STATS, footprintOf, isSupportUnit, isUnitAvailable } from "../catalog";
import { TILE_RESOURCE } from "../types";
import type { Entity, MissionDirectorPhase, SimState, UnitKind, Vec2 } from "../types";
import { tryFindPath } from "./pathBudget";
import { BUILDING_PLACEMENT_RADIUS, byId, canPlaceBuilding, closestApproach, distToEntity, findBuildSite, living, nearest, powerFor, spawnBuilding, trySpawnUnit } from "./world";
import { rngFromState } from "../seed/rng";
import { missionDifficulty } from "./difficulty";

const YARD_DEFENSE_RANGE = 14;
const RESOURCE_SCAN_INTERVAL = 24;
const resourcePointCache = new WeakMap<SimState, { tick: number; point?: Vec2 }>();
export const RETREAT_ENTER_HEALTH = 0.35;
export const RETREAT_RECOVER_HEALTH = 0.5;
export const RETREAT_MAX_TICKS = 240;

function tryBuildPower(state: SimState, yardX: number, yardY: number): boolean {
  if (state.credits[1] < BUILDING_STATS.power.cost) return false;
  const spot = findBuildSite(state, "power", yardX + 3, yardY, 12, 1);
  if (!spot) return false;
  spawnBuilding(state, 1, "power", spot.x, spot.y, BUILDING_STATS.power.buildTicks);
  state.credits[1] -= BUILDING_STATS.power.cost;
  return true;
}

function tryBuildRefinery(state: SimState, yardX: number, yardY: number): boolean {
  if (state.credits[1] < BUILDING_STATS.refinery.cost) return false;
  const spot = findBuildSite(state, "refinery", yardX + 3, yardY, 12, 1);
  if (!spot) return false;
  spawnBuilding(state, 1, "refinery", spot.x, spot.y, BUILDING_STATS.refinery.buildTicks);
  state.credits[1] -= BUILDING_STATS.refinery.cost;
  return true;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function directorPhase(state: SimState): MissionDirectorPhase {
  if (state.tutorialStage !== undefined) return "opening";
  return state.runtime?.director?.phase
    ?? (state.tick >= missionDifficulty(state.missionIndex).enemyAssaultEvery ? "pressure" : "opening");
}

function contestedResourcePoint(state: SimState, yard: Entity): Vec2 | undefined {
  const cached = resourcePointCache.get(state);
  if (cached && state.tick - cached.tick < RESOURCE_SCAN_INTERVAL) return cached.point;

  const playerYard = nearest(
    state,
    yard,
    (entity) => entity.owner === 0 && entity.kind === "constructionYard",
  );
  let best: Vec2 | undefined;
  let bestScore = Infinity;
  let fallback: Vec2 | undefined;
  let fallbackDistance = Infinity;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const index = y * state.width + x;
      if (state.tiles[index] !== TILE_RESOURCE || (state.resourceAmount[index] ?? 0) <= 0) continue;
      const point = { x, y };
      const enemyDistance = distance(yard, point);
      if (enemyDistance < 10) continue;
      if (hasBuildingNear(state, "refinery", point, 8)) continue;
      if (enemyDistance < fallbackDistance) {
        fallbackDistance = enemyDistance;
        fallback = point;
      }
      const playerDistance = playerYard ? distance(playerYard, point) : enemyDistance;
      const score = enemyDistance + Math.abs(enemyDistance - playerDistance) * 0.25;
      if (score < bestScore) {
        bestScore = score;
        best = point;
      }
    }
  }
  const point = best ?? fallback;
  resourcePointCache.set(state, { tick: state.tick, point });
  return point;
}

function hasBuildingNear(state: SimState, kind: "power" | "refinery", point: Vec2, radius: number): boolean {
  return living(state).some(
    (entity) => entity.owner === 1 && entity.class === "building" && entity.kind === kind && distance(entity, point) <= radius,
  );
}

function forwardRelaySite(state: SimState, yard: Entity, point: Vec2): Vec2 | undefined {
  const dx = point.x - yard.x;
  const dy = point.y - yard.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return undefined;
  const direction = { x: dx / length, y: dy / length };
  const minimumForwardDistance = BUILDING_PLACEMENT_RADIUS / 2;

  for (let retreat = 0; retreat <= Math.ceil(length); retreat += 1) {
    const desired = {
      x: Math.round(point.x - direction.x * retreat),
      y: Math.round(point.y - direction.y * retreat),
    };
    const spot = findBuildSite(state, "power", desired.x, desired.y, 4, 1);
    if (!spot || distance(spot, yard) < minimumForwardDistance) continue;
    return spot;
  }
  return undefined;
}

function forwardRefinerySite(state: SimState, yard: Entity, point: Vec2): Vec2 | undefined {
  const cx = Math.round(point.x);
  const cy = Math.round(point.y);
  for (let radius = 0; radius <= 10; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (radius > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const spot = { x: cx + dx, y: cy + dy };
        if (distance(spot, yard) < 10) continue;
        if (canPlaceBuilding(state, "refinery", spot.x, spot.y, 1)) return spot;
      }
    }
  }
  return undefined;
}

function tryBuildForwardInfrastructure(state: SimState, yard: Entity): boolean {
  if (directorPhase(state) === "opening" || powerFor(state, 1) < 0) return false;
  const point = contestedResourcePoint(state, yard);
  if (!point) return false;

  const refineries = living(state).filter(
    (entity) => entity.owner === 1 && entity.class === "building" && entity.kind === "refinery",
  );
  if (refineries.length >= 2 || hasBuildingNear(state, "refinery", point, 8)) return false;

  if (!hasBuildingNear(state, "power", point, 8)) {
    if (state.credits[1] < BUILDING_STATS.power.cost) return false;
    const spot = forwardRelaySite(state, yard, point);
    if (!spot) return false;
    spawnBuilding(state, 1, "power", spot.x, spot.y, BUILDING_STATS.power.buildTicks);
    state.credits[1] -= BUILDING_STATS.power.cost;
    return true;
  }

  if (state.credits[1] < BUILDING_STATS.refinery.cost) return false;
  const spot = forwardRefinerySite(state, yard, point);
  if (!spot) return false;
  spawnBuilding(state, 1, "refinery", spot.x, spot.y, BUILDING_STATS.refinery.buildTicks);
  state.credits[1] -= BUILDING_STATS.refinery.cost;
  return true;
}

function queueUnit(state: SimState, producer: Entity, kind: UnitKind): boolean {
  const cost = UNIT_STATS[kind].cost;
  if (state.credits[1] < cost || powerFor(state, 1) < 0) return false;
  state.credits[1] -= cost;
  producer.producing = { kind, remaining: UNIT_STATS[kind].buildTicks };
  return true;
}

function enemyCombat(state: SimState): Entity[] {
  return living(state).filter((e) => e.owner === 1 && e.class === "unit" && e.kind !== "harvester" && !isSupportUnit(e.kind as UnitKind));
}

function sendHome(state: SimState, unit: Entity, yard: Entity): void {
  unit.attackTarget = undefined;
  unit.orderMode = "move";
  unit.orderDestination = { x: yard.x, y: yard.y };
  unit.idle = false;
  const path = tryFindPath(state, unit, closestApproach(state, unit, yard));
  if (path !== undefined) unit.path = path;
}

function assignAttack(state: SimState, unit: Entity, target: Entity): void {
  unit.attackTarget = target.id;
  unit.orderMode = "attack";
  unit.orderDestination = { x: target.x, y: target.y };
  unit.idle = false;
  const path = tryFindPath(state, unit, closestApproach(state, unit, target));
  if (path !== undefined) unit.path = path;
}

function assignMove(state: SimState, unit: Entity, destination: { x: number; y: number }): void {
  unit.attackTarget = undefined;
  unit.orderMode = "move";
  unit.orderDestination = { x: destination.x, y: destination.y };
  unit.idle = false;
  const path = tryFindPath(state, unit, destination);
  if (path !== undefined) unit.path = path;
}

function scenarioAssaultTarget(state: SimState, from: Entity): Entity | undefined {
  const runtime = state.runtime;
  if (!runtime) return undefined;
  const candidates = runtime.targetIds
    .map((id) => byId(state, id))
    .filter((entity): entity is Entity => {
      if (!entity || entity.hp <= 0 || entity.owner !== 0) return false;
      if (runtime.kind === "escort") return runtime.convoyStartTick === undefined && entity.scenarioRole === "convoy";
      if (runtime.kind === "extraction") return entity.scenarioRole === "cargo" && !entity.neutral && !runtime.extractedIds?.includes(entity.id);
      if (runtime.kind === "rescue") return entity.scenarioRole === "stranded" && !entity.neutral;
      return false;
    });
  const sorted = candidates.sort((a, b) => distToEntity(from, a) - distToEntity(from, b) || a.id - b.id);
  return sorted.length ? sorted[from.id % sorted.length] : undefined;
}

function guardScenarioObjectives(state: SimState, units: Entity[]): void {
  const runtime = state.runtime;
  if (!runtime || (runtime.kind !== "sabotage" && runtime.kind !== "destroyMarked")) return;
  const targets = runtime.targetIds
    .map((id) => byId(state, id))
    .filter((entity): entity is Entity => !!entity && entity.hp > 0 && entity.owner === 1);
  if (!targets.length || !units.length) return;
  targets.forEach((target, index) => {
    const guard = units[index % units.length]!;
    if (guard.attackTarget === undefined) assignMove(state, guard, closestApproach(state, guard, target));
  });
}

function guardResourceLane(state: SimState, units: Entity[], yard: Entity): void {
  if (directorPhase(state) === "opening") return;
  const point = contestedResourcePoint(state, yard);
  const guardIndex = homeGuardCount(state.missionIndex);
  if (!point || units.length <= guardIndex) return;

  const guard = [...units]
    .sort((a, b) => distToEntity(a, yard) - distToEntity(b, yard) || a.id - b.id)[guardIndex];
  if (!guard || guard.attackTarget !== undefined) return;
  if (guard.orderDestination && distance(guard.orderDestination, point) < 2 && guard.orderMode === "move") return;
  assignMove(state, guard, point);
}

function homeGuardCount(missionIndex: number): number {
  return 1 + (missionIndex >= 4 ? 1 : 0);
}

function shouldAutoRepair(state: SimState, building: Entity): boolean {
  if (building.marked || building.kind === "objective") return false;
  if (state.win.kind === "razeAll" || state.win.kind === "annihilate") return false;
  if (state.win.kind === "decapitate" && building.kind === "constructionYard") return false;
  return true;
}

function shouldRetreat(state: SimState, averageHealth: number): boolean {
  if (averageHealth >= RETREAT_RECOVER_HEALTH) {
    state.aiRetreatLocked = undefined;
    state.aiRetreatTick = undefined;
  }
  if (state.aiRetreatLocked) return false;

  const holding = state.aiState === "retreat" && averageHealth < RETREAT_RECOVER_HEALTH;
  const entering = averageHealth < RETREAT_ENTER_HEALTH;
  if (!holding && !entering) {
    state.aiRetreatTick = undefined;
    return false;
  }
  if (state.aiRetreatTick === undefined) state.aiRetreatTick = state.tick;
  if (state.tick - state.aiRetreatTick >= RETREAT_MAX_TICKS) {
    state.aiRetreatLocked = true;
    state.aiRetreatTick = undefined;
    return false;
  }
  return true;
}

function tryBuildTurret(state: SimState, yard: Entity, threat: Entity): boolean {
  if (state.credits[1] < BUILDING_STATS.turret.cost) return false;
  const cap = 1 + Math.floor(state.missionIndex / 2);
  const turrets = living(state).filter((e) => e.owner === 1 && e.kind === "turret");
  if (turrets.length >= cap) return false;
  if (turrets.some((e) => e.constructing > 0)) return false;
  const spot = findBuildSite(state, "turret", threat.x, threat.y, 12, 1)
    ?? findBuildSite(state, "turret", yard.x, yard.y, 12, 1);
  if (!spot) return false;
  spawnBuilding(state, 1, "turret", spot.x, spot.y, BUILDING_STATS.turret.buildTicks);
  state.credits[1] -= BUILDING_STATS.turret.cost;
  return true;
}

function assignAssault(
  state: SimState,
  units: Entity[],
  yard: Entity,
  playerYard: Entity,
  retarget: boolean,
): void {
  const guards = homeGuardCount(state.missionIndex);
  const sorted = [...units].sort((a, b) => distToEntity(a, yard) - distToEntity(b, yard) || a.id - b.id);
  const raiders = sorted.slice(guards);
  const resourcePoint = contestedResourcePoint(state, yard);
  const laneHarvester = resourcePoint
    ? nearest(state, resourcePoint, (e) => e.owner === 0 && e.kind === "harvester" && e.hp > 0)
    : undefined;
  const harvester = laneHarvester && resourcePoint && distToEntity(resourcePoint, laneHarvester) <= 12
    ? laneHarvester
    : nearest(state, yard, (e) => e.owner === 0 && e.kind === "harvester" && e.hp > 0);
  raiders.forEach((u, index) => {
    if (!retarget && u.attackTarget !== undefined && byId(state, u.attackTarget)) return;
    const objectiveTarget = scenarioAssaultTarget(state, u);
    const target = objectiveTarget ?? (harvester && index % 2 === 1 ? playerYard : harvester ?? playerYard);
    assignAttack(state, u, target);
  });
}

export function tickAi(state: SimState): void {
  if (state.result !== "playing") return;
  const rng = rngFromState(state.rngState);
  const enemyBuildings = living(state).filter((e) => e.owner === 1 && e.class === "building");
  const yard = enemyBuildings.find((e) => e.kind === "constructionYard");
  if (!yard) {
    state.aiState = "retreat";
    state.rngState = rng.state;
    return;
  }

  const difficulty = missionDifficulty(state.missionIndex);
  const escortStaging = state.runtime?.kind === "escort" && state.runtime.convoyStartTick !== undefined;
  const phase = directorPhase(state);
  const productionWindow =
    state.tick >= difficulty.enemyProductionStart &&
    (state.tick - difficulty.enemyProductionStart) % difficulty.enemyProductionEvery === 0;
  const powerDeficit = powerFor(state, 1) < 0;
  if (productionWindow || powerDeficit) {
    const factory = enemyBuildings.find((e) => e.kind === "factory" && e.constructing === 0 && !e.producing);
    const barracks = enemyBuildings.find((e) => e.kind === "barracks" && e.constructing === 0 && !e.producing);
    const hasRefinery = enemyBuildings.some((e) => e.kind === "refinery");
    const hasHarvester = living(state).some((e) => e.owner === 1 && e.kind === "harvester");
    const playerTanks = living(state).filter((entity) => entity.owner === 0 && entity.kind === "tank").length;
    const playerInfantry = living(state).filter((entity) => entity.owner === 0 && entity.kind === "infantry").length;
    const want: UnitKind = playerTanks > playerInfantry ? "antiArmor" : rng.chance(0.4) ? "tank" : "infantry";
    const producer = want === "infantry" || want === "antiArmor" ? barracks : factory;
    const woundedHumans = living(state).some(
      (entity) => entity.owner === 1 && entity.class === "unit" && !isSupportUnit(entity.kind as UnitKind) &&
        UNIT_STATS[entity.kind as UnitKind].domain === "human" && entity.hp < entity.maxHp,
    );
    const woundedVehicles = living(state).some(
      (entity) => entity.owner === 1 && entity.class === "unit" && !isSupportUnit(entity.kind as UnitKind) &&
        UNIT_STATS[entity.kind as UnitKind].domain === "vehicle" && entity.hp < entity.maxHp,
    );
    const medicCount = living(state).filter((entity) => entity.owner === 1 && entity.kind === "medic").length;
    const repairTruckCount = living(state).filter((entity) => entity.owner === 1 && entity.kind === "repairTruck").length;
    const supportWant = state.missionIndex >= 2 && (
      woundedHumans && medicCount === 0 ? "medic" :
      woundedVehicles && repairTruckCount === 0 ? "repairTruck" :
      undefined
    );
    const supportProducer = supportWant === "medic" ? barracks : supportWant === "repairTruck" ? factory : undefined;
    const power = powerFor(state, 1);
    if (power < 0 && tryBuildPower(state, yard.x, yard.y)) {
      // Restore the grid before expanding.
    } else if (phase !== "opening" && tryBuildForwardInfrastructure(state, yard)) {
      // Contest a remote resource lane before committing to another assault wave.
    } else if (!hasRefinery && tryBuildRefinery(state, yard.x, yard.y)) {
      // Keep ore income before spending on combat.
    } else if (!hasHarvester && factory && queueUnit(state, factory, "harvester")) {
      // Replace a lost harvester before more combat units.
    } else if (supportWant && supportProducer && isUnitAvailable(supportWant, state.missionIndex) && queueUnit(state, supportProducer, supportWant)) {
      // Add one support unit when the army has a matching damaged domain.
    } else if (producer && queueUnit(state, producer, want)) {
      // Counter-produce against the player mix.
    } else if (state.credits[1] >= BUILDING_STATS.barracks.cost && !barracks) {
      const spot = findBuildSite(state, "barracks", yard.x - 3, yard.y, 12, 1);
      if (spot) {
        state.credits[1] -= BUILDING_STATS.barracks.cost;
        spawnBuilding(state, 1, "barracks", spot.x, spot.y, BUILDING_STATS.barracks.buildTicks);
      }
    } else if (state.credits[1] >= BUILDING_STATS.factory.cost && !factory) {
      const spot = findBuildSite(state, "factory", yard.x, yard.y - 3, 12, 1);
      if (spot) {
        state.credits[1] -= BUILDING_STATS.factory.cost;
        spawnBuilding(state, 1, "factory", spot.x, spot.y, BUILDING_STATS.factory.buildTicks);
      }
    } else if (power < 20) {
      tryBuildPower(state, yard.x, yard.y);
    }
  }

  if (escortStaging) {
    for (const unit of enemyCombat(state)) {
      unit.attackTarget = undefined;
      unit.path = [];
      unit.orderMode = undefined;
      unit.orderDestination = undefined;
      unit.idle = true;
    }
    state.aiState = "economy";
    state.rngState = rng.state;
    return;
  }

  if (state.win.kind === "holdTheLine" && state.tick > 0 && state.tick % difficulty.enemyAssaultEvery === 0) {
    const fp = footprintOf("constructionYard");
    const spot = { x: yard.x - 1, y: yard.y + fp.h };
    trySpawnUnit(state, 1, rng.chance(0.45) ? "tank" : "infantry", spot.x, spot.y);
    if (state.missionIndex >= 4) {
      trySpawnUnit(state, 1, "infantry", spot.x, spot.y + 1);
    }
  }

  const playerYard = nearest(
    state,
    yard,
    (e) => e.owner === 0 && e.kind === "constructionYard",
  );
  const waveEvery = difficulty.enemyAssaultEvery;
  for (const b of enemyBuildings) {
    if (b.constructing > 0 || b.hp <= 0) continue;
    if (b.hp < b.maxHp && shouldAutoRepair(state, b)) b.repairing = true;
    else if (!shouldAutoRepair(state, b)) b.repairing = false;
  }

  const threat = nearest(
    state,
    yard,
    (e) => e.owner === 0 && e.class === "unit" && e.kind !== "harvester" && !isSupportUnit(e.kind as UnitKind) && (
      !e.neutral || e.scenarioRole === "convoy"
    ) && !(
      e.scenarioRole === "convoy" && state.runtime?.convoyStartTick !== undefined
    ),
  );
  const units = enemyCombat(state);
  const averageHealth = units.length ? units.reduce((sum, unit) => sum + unit.hp / unit.maxHp, 0) / units.length : 1;
  if (shouldRetreat(state, averageHealth)) state.aiState = "retreat";
  else if (threat && distToEntity(yard, threat) <= YARD_DEFENSE_RANGE) state.aiState = "defense";
  else if (playerYard && state.tick >= waveEvery && !(
    state.runtime?.kind === "escort" && state.runtime.convoyStartTick !== undefined
  )) state.aiState = "assault";
  else if (units.length > 0 && state.tick % 180 === 0) state.aiState = "regroup";
  else state.aiState = "economy";

  if (state.aiState === "defense" && threat && distToEntity(yard, threat) <= YARD_DEFENSE_RANGE) {
    tryBuildTurret(state, yard, threat);
    for (const u of units) {
      if (u.attackTarget) continue;
      assignAttack(state, u, threat);
    }
  } else if (state.aiState === "assault" && playerYard && state.tick > 0) {
    assignAssault(state, units, yard, playerYard, state.tick % waveEvery === 0);
  } else if (state.aiState === "retreat") {
    for (const u of units) sendHome(state, u, yard);
  } else if (state.aiState === "economy" || state.aiState === "regroup") {
    for (const u of units) {
      if (distToEntity(u, yard) <= YARD_DEFENSE_RANGE) continue;
      sendHome(state, u, yard);
    }
    guardScenarioObjectives(state, units);
    if (!state.runtime || (state.runtime.kind !== "sabotage" && state.runtime.kind !== "destroyMarked")) {
      guardResourceLane(state, units, yard);
    }
  }
  state.rngState = rng.state;
}
