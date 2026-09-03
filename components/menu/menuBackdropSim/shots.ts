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

export function cinemaShotCamera(
  scene: CinemaScene,
  shotIndex: number,
  w: number,
  h: number,
  t: number,
): Camera {
  const shot = CINEMA_SHOTS[((shotIndex % CINEMA_SHOTS.length) + CINEMA_SHOTS.length) % CINEMA_SHOTS.length]!;
  const focus = shot.type === "actor" ? scene.actors[shot.index]! : scene.buildings[shot.index]!;
  let tx = focus.x;
  let ty = focus.y;
  if (t > 0 && scene.combatEpicenter) {
    const blend = Math.min(0.85, t * 0.025);
    tx = tx + (scene.combatEpicenter.x - tx) * blend;
    ty = ty + (scene.combatEpicenter.y - ty) * blend;
  }
  const elev = scene.map.heights[Math.floor(ty) * scene.map.width + Math.floor(tx)] ?? 1;
  const zoom = PIP_ZOOM;
  const driftX = Math.sin(t * 0.012) * 10;
  const driftY = Math.cos(t * 0.01) * 6;
  return {
    zoom,
    x: w / 2 - (tx - ty) * (TILE_W / 2) * zoom + driftX,
    y: h / 2 - (tx + ty) * (TILE_H / 2) * zoom + elev * HEIGHT_STEP * zoom + driftY,
  };
}
