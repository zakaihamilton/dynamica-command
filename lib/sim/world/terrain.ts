import type { SimState } from "../../types";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../../types";
import { buildingAt, heightAt, inBounds, tileAt, unitAt } from "./queries";

export type TerrainAccess = {
  traversable: boolean;
  buildable: boolean;
  label: "Open ground" | "Water" | "Ore field" | "Hard blocker" | "Outside map";
};

/** The shared terrain contract for movement, construction, tooltips, and picking feedback. */
export function terrainAccess(state: SimState, x: number, y: number): TerrainAccess {
  if (!inBounds(state, x, y)) return { traversable: false, buildable: false, label: "Outside map" };
  const tile = tileAt(state, x, y);
  if (tile === TILE_WATER) return { traversable: false, buildable: false, label: "Water" };
  if (tile === TILE_BLOCKED) return { traversable: false, buildable: false, label: "Hard blocker" };
  if (tile === TILE_RESOURCE) return { traversable: true, buildable: false, label: "Ore field" };
  return { traversable: true, buildable: true, label: "Open ground" };
}

/** Terrain and buildings only — other units are handled at move time. */
export function isStaticWalkable(state: SimState, x: number, y: number): boolean {
  if (!terrainAccess(state, x, y).traversable) return false;
  if (buildingAt(state, x, y)) return false;
  return true;
}

export function isWalkable(state: SimState, x: number, y: number): boolean {
  if (!isStaticWalkable(state, x, y)) return false;
  if (unitAt(state, x, y)) return false;
  return true;
}

export function makeUnitOccupancy(state: SimState, ignoreId?: number): Uint8Array {
  const occupancy = new Uint8Array(state.width * state.height);
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit" || e.id === ignoreId) continue;
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    if (!inBounds(state, x, y)) continue;
    occupancy[y * state.width + x] = 1;
  }
  return occupancy;
}

export function canClimb(state: SimState, x0: number, y0: number, x1: number, y1: number): boolean {
  return Math.abs(heightAt(state, x1, y1) - heightAt(state, x0, y0)) <= 1;
}

export function canStep(state: SimState, x0: number, y0: number, x1: number, y1: number): boolean {
  return isWalkable(state, x1, y1) && canClimb(state, x0, y0, x1, y1);
}
