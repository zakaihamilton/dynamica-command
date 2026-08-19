import { BUILDING_STATS, UNIT_STATS, footprintOf } from "../catalog";
import type { Entity, SimState, UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { byId, closestApproach, distToEntity, findBuildSite, living, nearest, powerFor, spawnBuilding, trySpawnUnit } from "./world";
import { rngFromState } from "../seed/rng";
import { missionDifficulty } from "./difficulty";

const YARD_DEFENSE_RANGE = 14;
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

function enemyCombat(state: SimState): Entity[] {
  return living(state).filter((e) => e.owner === 1 && e.class === "unit" && e.kind !== "harvester");
}

function sendHome(state: SimState, unit: Entity, yard: Entity): void {
  unit.attackTarget = undefined;
  unit.idle = false;
  unit.path = findPath(state, unit, closestApproach(state, unit, yard));
}

function assignAttack(state: SimState, unit: Entity, target: Entity): void {
  unit.attackTarget = target.id;
  unit.idle = false;
  unit.path = findPath(state, unit, closestApproach(state, unit, target));
}

function homeGuardCount(missionIndex: number): number {
  return 1 + (missionIndex >= 4 ? 1 : 0);
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
  const harvester = nearest(
    state,
    yard,
    (e) => e.owner === 0 && e.kind === "harvester" && e.hp > 0,
  );
  raiders.forEach((u, index) => {
    if (!retarget && u.attackTarget !== undefined && byId(state, u.attackTarget)) return;
    const target = harvester && index % 2 === 1 ? playerYard : harvester ?? playerYard;
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
  const productionWindow =
    state.tick >= difficulty.enemyProductionStart &&
    (state.tick - difficulty.enemyProductionStart) % difficulty.enemyProductionEvery === 0;
  const powerDeficit = powerFor(state, 1) < 0;
  if (productionWindow || powerDeficit) {
    const factory = enemyBuildings.find((e) => e.kind === "factory" && e.constructing === 0 && !e.producing);
    const barracks = enemyBuildings.find((e) => e.kind === "barracks" && e.constructing === 0 && !e.producing);
    const playerTanks = living(state).filter((entity) => entity.owner === 0 && entity.kind === "tank").length;
    const playerInfantry = living(state).filter((entity) => entity.owner === 0 && entity.kind === "infantry").length;
    const want: UnitKind = playerTanks > playerInfantry ? "antiArmor" : rng.chance(0.4) ? "tank" : "infantry";
    const producer = want === "infantry" || want === "antiArmor" ? barracks : factory;
    const cost = UNIT_STATS[want].cost;
    const power = powerFor(state, 1);
    if (producer && state.credits[1] >= cost && power >= 0) {
      state.credits[1] -= cost;
      producer.producing = { kind: want, remaining: UNIT_STATS[want].buildTicks };
    } else if (power < 0 && tryBuildPower(state, yard.x, yard.y)) {
      // Restore the grid before expanding.
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
  const waveEvery = difficulty.enemyAssaultEvery;
  for (const b of enemyBuildings) {
    if (b.constructing > 0 || b.hp <= 0) continue;
    if (b.hp < b.maxHp) b.repairing = true;
  }

  const threat = nearest(
    state,
    yard,
    (e) => e.owner === 0 && e.class === "unit" && e.kind !== "harvester",
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
      if (distToEntity(u, yard) <= YARD_DEFENSE_RANGE) continue;
      sendHome(state, u, yard);
    }
  }
  state.rngState = rng.state;
}
