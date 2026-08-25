import { BUILDING_STATS } from "../../catalog";
import type { BuildingKind, Entity, SimState } from "../../types";
import { findBuildSite, living, powerFor, spawnBuilding } from "../world";
import { contestedResourcePoint, forwardRefinerySite, forwardRelaySite, hasBuildingNear } from "./helpers";
import { directorPhase } from "./director";

function tryPlaceBuilding(
  state: SimState,
  kind: BuildingKind,
  spot: { x: number; y: number } | null,
): boolean {
  if (!spot) return false;
  const stats = BUILDING_STATS[kind];
  if (state.credits[1] < stats.cost) return false;
  spawnBuilding(state, 1, kind, spot.x, spot.y, stats.buildTicks);
  state.credits[1] -= stats.cost;
  return true;
}

export function tryBuildPower(state: SimState, yardX: number, yardY: number): boolean {
  return tryPlaceBuilding(state, "power", findBuildSite(state, "power", yardX + 3, yardY, 12, 1));
}

export function tryBuildRefinery(state: SimState, yardX: number, yardY: number): boolean {
  return tryPlaceBuilding(state, "refinery", findBuildSite(state, "refinery", yardX + 3, yardY, 12, 1));
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
    return tryPlaceBuilding(state, "power", forwardRelaySite(state, yard, point));
  }

  return tryPlaceBuilding(state, "refinery", forwardRefinerySite(state, yard, point));
}

export function tryBuildTurret(state: SimState, yard: Entity, threat: Entity): boolean {
  const cap = 1 + Math.floor(state.missionIndex / 2);
  const turrets = living(state).filter((e) => e.owner === 1 && e.kind === "turret");
  if (turrets.length >= cap) return false;
  if (turrets.some((e) => e.constructing > 0)) return false;
  const spot = findBuildSite(state, "turret", threat.x, threat.y, 12, 1)
    ?? findBuildSite(state, "turret", yard.x, yard.y, 12, 1);
  return tryPlaceBuilding(state, "turret", spot);
}
