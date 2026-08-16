import type { Entity, SimState } from "../types";
import { fogAt } from "../sim/fog";
import { buildingAt, heightAt } from "../sim/world";
import { TILE_H, tileToScreen, type Camera } from "./iso";
import { pickTile } from "./renderer";

function fogVisible(state: SimState, e: Entity): boolean {
  const tx = Math.round(e.x);
  const ty = Math.round(e.y);
  const fog = fogAt(state, tx, ty);
  if (e.owner === 1 && fog !== 2) return false;
  return true;
}

/** Screen-space pick: vehicles first (harvester/tank sprites sit above the tile diamond). */
export function pickEntity(state: SimState, sx: number, sy: number, cam: Camera): Entity | undefined {
  let bestUnit: Entity | undefined;
  let bestD = Infinity;
  const z = cam.zoom;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit" || !fogVisible(state, e)) continue;
    const elev = heightAt(state, Math.round(e.x), Math.round(e.y));
    const s = tileToScreen(e.x, e.y, cam, elev);
    const bodyX = s.x;
    const bodyY = s.y + (TILE_H / 2) * z - 18 * z;
    const radius = e.kind === "harvester" || e.kind === "tank" ? 42 * z : 30 * z;
    const d = Math.hypot(sx - bodyX, sy - bodyY);
    if (d <= radius && d < bestD) {
      bestD = d;
      bestUnit = e;
    }
  }
  if (bestUnit) return bestUnit;
  const tile = pickTile(state, sx, sy, cam);
  if (!tile) return undefined;
  const b = buildingAt(state, tile.x, tile.y);
  if (b && fogVisible(state, b)) return b;
  return undefined;
}
