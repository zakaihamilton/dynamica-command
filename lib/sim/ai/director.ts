import { BUILDING_STATS, UNIT_STATS, footprintOf, isSupportUnit, isUnitAvailable } from "../../catalog";
import { isUnitEntity, type Entity, type MissionDirectorPhase, type SimState, type UnitKind } from "../../types";
import { rngFromState } from "../../seed/rng";
import { missionDifficulty } from "../difficulty";
import { profileContractFor, resolveMissionProfile } from "../../gen/profile";
import { byId, closestApproach, distToEntity, findBuildSite, living, nearest, powerFor, spawnBuilding, trySpawnUnit } from "../world";
import { tryBuildForwardInfrastructure, tryBuildPower, tryBuildRefinery, tryBuildTurret } from "./building";
import { assignAttack, assignAssault, assignMove, enemyCombat, sendHome } from "./combat";
import { contestedResourcePoint, distance, queueUnit, shouldAutoRepair, shouldRetreat } from "./helpers";

const YARD_DEFENSE_RANGE = 14;

export function directorPhase(state: SimState): MissionDirectorPhase {
  if (state.tutorialStage !== undefined) return "opening";
  return state.runtime?.director?.phase
    ?? (state.tick >= missionDifficulty(state.missionIndex).enemyAssaultEvery ? "pressure" : "opening");
}

export function homeGuardCount(missionIndex: number): number {
  return 1 + (missionIndex >= 4 ? 1 : 0);
}

export function guardScenarioObjectives(state: SimState, units: Entity[]): void {
  const runtime = state.runtime;
  if (!runtime || (runtime.kind !== "sabotage" && runtime.kind !== "destroyMarked")) return;
  const targets = runtime.targetIds
    .map((id) => byId(state, id))
    .filter((entity): entity is Entity => !!entity && entity.hp > 0 && entity.owner === 1);
  if (!targets.length || !units.length) return;
  // Assign each guard at most one objective. If there are more targets than
  // guards, repeatedly assigning the same unit would make it flip between
  // perimeter tiles every tick.
  targets.slice(0, units.length).forEach((target, index) => {
    const guard = units[index % units.length]!;
    if (guard.attackTarget !== undefined) return;
    // Keep the selected perimeter tile stable while the guard approaches the
    // same building. Recomputing the nearest tile from a sub-tile position
    // can alternate between two equally close tiles at the midpoint.
    if (guard.scenarioGuardTargetId === target.id && guard.orderMode === "move") return;
    guard.scenarioGuardTargetId = target.id;
    assignMove(state, guard, closestApproach(state, guard, target));
  });
}

export function guardResourceLane(state: SimState, units: Entity[], yard: Entity): void {
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
  const profile = state.runtime?.director
    ? resolveMissionProfile(state.seed, state.missionIndex, state.win.kind)
    : undefined;
  const profileContract = profile ? profileContractFor(profile) : undefined;
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
      (entity) => entity.owner === 1 && isUnitEntity(entity) && !isSupportUnit(entity.kind) &&
        UNIT_STATS[entity.kind].domain === "human" && entity.hp < entity.maxHp,
    );
    const woundedVehicles = living(state).some(
      (entity) => entity.owner === 1 && isUnitEntity(entity) && !isSupportUnit(entity.kind) &&
        UNIT_STATS[entity.kind].domain === "vehicle" && entity.hp < entity.maxHp,
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
  const waveEvery = Math.max(240, difficulty.enemyAssaultEvery + (profileContract?.assaultEveryOffset ?? 0));
  for (const b of enemyBuildings) {
    if (b.constructing > 0 || b.hp <= 0) continue;
    if (b.hp < b.maxHp && shouldAutoRepair(state, b)) b.repairing = true;
    else if (!shouldAutoRepair(state, b)) b.repairing = false;
  }

  const threat = nearest(
    state,
    yard,
    (e) => e.owner === 0 && isUnitEntity(e) && e.kind !== "harvester" && !isSupportUnit(e.kind) && (
      (!e.neutral || e.scenarioRole === "convoy")
    ) && !(
      e.scenarioRole === "convoy" && state.runtime?.convoyStartTick !== undefined
    ),
  );
  const units = enemyCombat(state);
  const averageHealth = units.length ? units.reduce((sum, unit) => sum + unit.hp / unit.maxHp, 0) / units.length : 1;
  if (shouldRetreat(state, averageHealth)) state.aiState = "retreat";
  else if (threat && distToEntity(yard, threat) <= YARD_DEFENSE_RANGE) state.aiState = "defense";
  else if (playerYard && state.tick >= waveEvery) state.aiState = "assault";
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
      // Combat acquires targets before the director runs. Do not replace an
      // active attack with a return-to-base route on the same tick.
      if (u.attackTarget !== undefined) continue;
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
