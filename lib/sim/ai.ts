import { BUILDING_STATS, UNIT_STATS, footprintOf } from "../catalog";
import type { SimState, UnitKind } from "../types";
import { findPath } from "./pathfinding";
import { closestApproach, findBuildSite, living, nearest, powerFor, spawnBuilding, spawnUnit } from "./world";
import { rngFromState } from "../seed/rng";

export function tickAi(state: SimState): void {
  if (state.result !== "playing") return;
  const rng = rngFromState(state.rngState);
  const enemyBuildings = living(state).filter((e) => e.owner === 1 && e.class === "building");
  const yard = enemyBuildings.find((e) => e.kind === "constructionYard");
  if (!yard) {
    state.rngState = rng.state;
    return;
  }

  const missionScale = 1 + state.missionIndex * 0.12;
  const produceEvery = Math.max(48, Math.round(96 / missionScale));
  if (state.tick > 0 && state.tick % produceEvery === 0) {
    const factory = enemyBuildings.find((e) => e.kind === "factory" && e.constructing === 0 && !e.producing);
    const barracks = enemyBuildings.find((e) => e.kind === "barracks" && e.constructing === 0 && !e.producing);
    const want: UnitKind = rng.chance(0.4) ? "tank" : rng.chance(0.5) ? "antiArmor" : "infantry";
    const producer = want === "infantry" || want === "antiArmor" ? barracks : factory;
    const cost = UNIT_STATS[want].cost;
    if (producer && state.credits[1] >= cost && powerFor(state, 1) >= 0) {
      state.credits[1] -= cost;
      producer.producing = { kind: want, remaining: UNIT_STATS[want].buildTicks };
    } else if (state.credits[1] >= BUILDING_STATS.barracks.cost && !barracks) {
      const spot = findBuildSite(state, "barracks", yard.x - 3, yard.y);
      if (spot) {
        state.credits[1] -= BUILDING_STATS.barracks.cost;
        spawnBuilding(state, 1, "barracks", spot.x, spot.y, BUILDING_STATS.barracks.buildTicks);
      }
    } else if (state.credits[1] >= BUILDING_STATS.factory.cost && !factory) {
      const spot = findBuildSite(state, "factory", yard.x, yard.y - 3);
      if (spot) {
        state.credits[1] -= BUILDING_STATS.factory.cost;
        spawnBuilding(state, 1, "factory", spot.x, spot.y, BUILDING_STATS.factory.buildTicks);
      }
    } else if (state.credits[1] >= BUILDING_STATS.power.cost && powerFor(state, 1) < 20) {
      const spot = findBuildSite(state, "power", yard.x + 3, yard.y);
      if (spot) {
        spawnBuilding(state, 1, "power", spot.x, spot.y, BUILDING_STATS.power.buildTicks);
        state.credits[1] -= BUILDING_STATS.power.cost;
      }
    }
  }

  if (state.win.kind === "holdTheLine" && state.tick > 0 && state.tick % Math.max(240, 420 - state.missionIndex * 24) === 0) {
    const fp = footprintOf("constructionYard");
    const spot = { x: yard.x - 1, y: yard.y + fp.h };
    spawnUnit(state, 1, rng.chance(0.45) ? "tank" : "infantry", spot.x, spot.y);
    if (state.missionIndex >= 4) {
      spawnUnit(state, 1, "infantry", spot.x, spot.y + 1);
    }
  }

  const playerYard = nearest(
    state,
    yard,
    (e) => e.owner === 0 && e.kind === "constructionYard",
  );
  const waveEvery = Math.max(240, 480 - state.missionIndex * 30);
  if (playerYard && state.tick > 0 && state.tick % waveEvery === 0) {
    for (const u of living(state)) {
      if (u.owner !== 1 || u.class !== "unit" || u.kind === "harvester") continue;
      if (u.attackTarget) continue;
      u.attackTarget = playerYard.id;
      u.path = findPath(state, u, closestApproach(state, u, playerYard));
    }
  }
  state.rngState = rng.state;
}
