import { footprintOf } from "../../catalog";
import type { BuildingKind, Entity, SimState, TileKind, Vec2 } from "../../types";

export function at(state: SimState, x: number, y: number): number {
  return y * state.width + x;
}

export function inBounds(state: SimState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function tileAt(state: SimState, x: number, y: number): TileKind {
  if (!inBounds(state, x, y)) return 1;
  return state.tiles[at(state, x, y)] as TileKind;
}

export function heightAt(state: SimState, x: number, y: number): number {
  if (!inBounds(state, x, y)) return 0;
  return state.heights[at(state, x, y)] ?? 1;
}

function heightAtClamped(state: SimState, x: number, y: number): number {
  const cx = Math.max(0, Math.min(state.width - 1, Math.floor(x)));
  const cy = Math.max(0, Math.min(state.height - 1, Math.floor(y)));
  return state.heights[cy * state.width + cx] ?? 1;
}

/** Bilinear sample so moving units ride slopes instead of snapping tile to tile. */
export function groundHeight(state: SimState, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const h00 = heightAtClamped(state, x0, y0);
  const h10 = heightAtClamped(state, x0 + 1, y0);
  const h01 = heightAtClamped(state, x0, y0 + 1);
  const h11 = heightAtClamped(state, x0 + 1, y0 + 1);
  return h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;
}

export function occupies(e: Entity, x: number, y: number): boolean {
  if (e.hp <= 0) return false;
  if (e.class !== "building") {
    return Math.round(e.x) === x && Math.round(e.y) === y;
  }
  const fp = footprintOf(e.kind as BuildingKind);
  return x >= e.x && x < e.x + fp.w && y >= e.y && y < e.y + fp.h;
}

export function unitAt(state: SimState, x: number, y: number): Entity | undefined {
  return state.entities.find(
    (e) => e.hp > 0 && e.class === "unit" && Math.round(e.x) === x && Math.round(e.y) === y,
  );
}

export function buildingAt(state: SimState, x: number, y: number): Entity | undefined {
  return state.entities.find((e) => e.class === "building" && occupies(e, x, y));
}

export function living(state: SimState): Entity[] {
  return state.entities.filter((e) => e.hp > 0);
}

export function byId(state: SimState, id: number): Entity | undefined {
  return state.entities.find((e) => e.id === id && e.hp > 0);
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distToEntity(from: Vec2, e: Entity): number {
  if (e.class !== "building") return Math.hypot(from.x - e.x, from.y - e.y);
  const fp = footprintOf(e.kind as BuildingKind);
  let best = Infinity;
  for (let oy = 0; oy < fp.h; oy++) {
    for (let ox = 0; ox < fp.w; ox++) {
      const d = Math.hypot(from.x - (e.x + ox), from.y - (e.y + oy));
      if (d < best) best = d;
    }
  }
  return best;
}
