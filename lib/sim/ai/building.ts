import { BUILDING_STATS } from "../../catalog";
import type { Entity, SimState } from "../../types";
import { findBuildSite, living, powerFor, spawnBuilding } from "../world";
import { contestedResourcePoint, forwardRefinerySite, forwardRelaySite, hasBuildingNear } from "./helpers";
import { directorPhase } from "./director";

export function tryBuildPower(state: SimState, yardX: number, yardY: number): boolean {
  if (state.credits[1] < BUILDING_STATS.power.cost) return false;
  const spot = findBuildSite(state, "power", yardX + 3, yardY, 12, 1);
  if (!spot) return false;
  spawnBuilding(state, 1, "power", spot.x, spot.y, BUILDING_STATS.power.buildTicks);
  state.credits[1] -= BUILDING_STATS.power.cost;
  return true;
}

export function tryBuildRefinery(state: SimState, yardX: number, yardY: number): boolean {
  if (state.credits[1] < BUILDING_STATS.refinery.cost) return false;
  const spot = findBuildSite(state, "refinery", yardX + 3, yardY, 12, 1);
  if (!spot) return false;
  spawnBuilding(state, 1, "refinery", spot.x, spot.y, BUILDING_STATS.refinery.buildTicks);
  state.credits[1] -= BUILDING_STATS.refinery.cost;
  return true;
}

export function tryBuildForwardInfrastructure(state: SimState, yard: Entity): boolean {
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

export function tryBuildTurret(state: SimState, yard: Entity, threat: Entity): boolean {
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
