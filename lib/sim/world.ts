export { at, inBounds, tileAt, heightAt, groundHeight, occupies, unitAt, buildingAt, living, byId, dist, distToEntity } from "./world/queries";
export { terrainAccess, isStaticWalkable, isWalkable, makeUnitOccupancy, canClimb, canStep } from "./world/terrain";
export type { TerrainAccess } from "./world/terrain";
export { BUILDING_PLACEMENT_RADIUS, footprintFlat, canPlaceBuilding, findBuildSite, openTileNear, frontTileNear } from "./world/building";
export { nextEntityId, makeUnit, makeBuilding, closestApproach, nearest, powerBreakdown, powerFor, spawnUnit, trySpawnUnit, spawnBuilding, spawnBuildingAt, emptyRoleCounts } from "./world/spawn";
export { compactDestroyedEntities, compactedState } from "./world/lifecycle";
