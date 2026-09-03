import { HEIGHT_STEP, TILE_H, TILE_W, type Camera } from "@/lib/iso";
import type { CinemaScene } from "./scene";

export type CinemaShot =
  | { type: "actor"; index: number }
  | { type: "building"; index: number };

/** Distinct PIP framings: tanks, harvest, yards, infantry. */
export const CINEMA_SHOTS: readonly CinemaShot[] = [
  { type: "actor", index: 1 },
  { type: "actor", index: 0 },
  { type: "building", index: 5 },
  { type: "actor", index: 2 },
  { type: "actor", index: 3 },
  { type: "building", index: 8 },
];

export const PREVIEW_SHOT_COUNT = CINEMA_SHOTS.length;

export const PIP_ZOOM = 1.5;

export const SHOT_OFFSETS: readonly { x: number; y: number }[] = [
  { x: -5, y: -3 },
  { x: 5, y: 3 },
  { x: -4, y: 4 },
  { x: 4, y: -4 },
  { x: -6, y: 1 },
  { x: 6, y: -1 },
];

export function cinemaShotCamera(
  scene: CinemaScene,
  shotIndex: number,
  w: number,
  h: number,
  t: number,
): Camera {
  const shot = CINEMA_SHOTS[((shotIndex % CINEMA_SHOTS.length) + CINEMA_SHOTS.length) % CINEMA_SHOTS.length]!;
  const focus = shot.type === "actor" ? scene.actors[shot.index]! : scene.buildings[shot.index]!;
  const off = SHOT_OFFSETS[((shotIndex % SHOT_OFFSETS.length) + SHOT_OFFSETS.length) % SHOT_OFFSETS.length]!;

  const tx = scene.combatEpicenter ? scene.combatEpicenter.x : focus.x;
  const ty = scene.combatEpicenter ? scene.combatEpicenter.y : focus.y;

  const hx = Math.min(scene.map.width - 1, Math.max(0, Math.floor(tx)));
  const hy = Math.min(scene.map.height - 1, Math.max(0, Math.floor(ty)));
  const elev = scene.map.heights[hy * scene.map.width + hx] ?? 1;
  const zoom = PIP_ZOOM;
  const panX = Math.sin(t * 0.003) * 1.5;
  const panY = Math.cos(t * 0.0025) * 1.0;

  return {
    zoom,
    x: w / 2 - (tx - ty) * (TILE_W / 2) * zoom + off.x + panX,
    y: h / 2 - (tx + ty) * (TILE_H / 2) * zoom + elev * HEIGHT_STEP * zoom + off.y + panY,
  };
}
