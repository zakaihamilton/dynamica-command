import type { Facing } from "./types";

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export const TILE_W = 64;
export const TILE_H = 32;
// Restore readable cliff depth so plateaus and ridges separate from plains.
export const HEIGHT_STEP = 22;

/** Convert tile coordinate delta to screen direction angle in radians [-pi, pi]. */
export function isoHeadingAngle(dx: number, dy: number): number {
  const sdx = (dx - dy) * (TILE_W / 2);
  const sdy = (dx + dy) * (TILE_H / 2);
  return Math.atan2(sdy, sdx);
}

/** Convert tile coordinate delta to the correct 8-way screen-isometric Facing. */
export function toIsometricFacing(dx: number, dy: number): Facing {
  const sdx = (dx - dy) * 2;
  const sdy = dx + dy;
  if (Math.abs(sdx) < 0.0001 && Math.abs(sdy) < 0.0001) return 0;
  const angle = Math.atan2(sdy, sdx);
  return ((Math.round((angle / (Math.PI * 2)) * 8) + 8) % 8) as Facing;
}

export function createCamera(): Camera {
  return { x: 400, y: 80, zoom: 1 };
}

export function tileToScreen(tx: number, ty: number, cam: Camera, elev = 0): { x: number; y: number } {
  return {
    x: (tx - ty) * (TILE_W / 2) * cam.zoom + cam.x,
    y: (tx + ty) * (TILE_H / 2) * cam.zoom + cam.y - elev * HEIGHT_STEP * cam.zoom,
  };
}

export function screenToTile(sx: number, sy: number, cam: Camera): { x: number; y: number } {
  const x = (sx - cam.x) / cam.zoom;
  const y = (sy - cam.y) / cam.zoom;
  const tx = x / (TILE_W / 2);
  const ty = y / (TILE_H / 2);
  return { x: (tx + ty) / 2, y: (ty - tx) / 2 };
}

export function screenToGroundTile(sx: number, sy: number, cam: Camera): { x: number; y: number } {
  return screenToTile(sx, sy - (TILE_H / 2) * cam.zoom, cam);
}

export function cameraViewQuad(
  cam: Camera,
  screenW: number,
  screenH: number,
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  return [
    screenToGroundTile(0, 0, cam),
    screenToGroundTile(screenW, 0, cam),
    screenToGroundTile(screenW, screenH, cam),
    screenToGroundTile(0, screenH, cam),
  ];
}

export function expandIsoDiamond(
  x: number,
  y: number,
  w: number,
  h: number,
  overlap: number,
): { x: number; y: number; w: number; h: number } {
  const nw = w * overlap;
  const nh = h * overlap;
  return { x, y: y - (nh - h) * 0.5, w: nw, h: nh };
}

/** Affine matrix mapping atlas cell (0,0)-(sw,sh) onto an isometric diamond. */
export function isoAtlasTransform(
  sx: number,
  sy: number,
  tw: number,
  th: number,
  sw: number,
  sh: number,
): [number, number, number, number, number, number] {
  return [tw / (2 * sw), th / (2 * sw), -tw / (2 * sh), th / (2 * sh), sx, sy];
}
