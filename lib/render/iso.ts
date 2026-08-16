export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export const TILE_W = 64;
export const TILE_H = 32;

export function createCamera(): Camera {
  return { x: 400, y: 80, zoom: 1 };
}

export function tileToScreen(tx: number, ty: number, cam: Camera): { x: number; y: number } {
  return {
    x: (tx - ty) * (TILE_W / 2) * cam.zoom + cam.x,
    y: (tx + ty) * (TILE_H / 2) * cam.zoom + cam.y,
  };
}

export function screenToTile(sx: number, sy: number, cam: Camera): { x: number; y: number } {
  const x = (sx - cam.x) / cam.zoom;
  const y = (sy - cam.y) / cam.zoom;
  const tx = x / (TILE_W / 2);
  const ty = y / (TILE_H / 2);
  return { x: (tx + ty) / 2, y: (ty - tx) / 2 };
}

export function clampZoom(z: number): number {
  return Math.max(0.5, Math.min(2.5, z));
}
