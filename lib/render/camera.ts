import { MAP_SKIRT } from "../gen/map";
import { HEIGHT_STEP, TILE_H, TILE_W, type Camera } from "./iso";
import { cameraViewQuad, screenToGroundTile } from "./iso";

export const PAN_STEP = 10;

export type PanDir = "left" | "right" | "up" | "down";

export type CameraBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type PanAvailability = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

export function cameraPanBounds(
  cam: Pick<Camera, "zoom">,
  mapW: number,
  mapH: number,
  screenW: number,
  screenH: number,
  skirt = MAP_SKIRT,
): CameraBounds {
  const z = cam.zoom;
  const tw = (TILE_W / 2) * z;
  const th = (TILE_H / 2) * z;
  const x0 = -skirt;
  const y0 = -skirt;
  const x1 = mapW + skirt - 1;
  const y1 = mapH + skirt - 1;
  const corners = [
    { x: (x0 - y0) * tw, y: (x0 + y0) * th },
    { x: (x1 - y0) * tw, y: (x1 + y0) * th },
    { x: (x0 - y1) * tw, y: (x0 + y1) * th },
    { x: (x1 - y1) * tw, y: (x1 + y1) * th },
  ];
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const c of corners) {
    left = Math.min(left, c.x);
    right = Math.max(right, c.x);
    top = Math.min(top, c.y);
    bottom = Math.max(bottom, c.y);
  }
  left -= (TILE_W / 2) * z;
  right += (TILE_W / 2) * z;
  bottom += TILE_H * z + 3 * HEIGHT_STEP * z;

  let minX = screenW - right;
  let maxX = -left;
  let minY = screenH - bottom;
  let maxY = -top;
  if (minX > maxX) {
    const cx = (minX + maxX) / 2;
    minX = cx;
    maxX = cx;
  }
  if (minY > maxY) {
    const cy = (minY + maxY) / 2;
    minY = cy;
    maxY = cy;
  }
  return { minX, maxX, minY, maxY };
}

export function clampCamera(cam: Camera, bounds: CameraBounds): void {
  cam.x = Math.max(bounds.minX, Math.min(bounds.maxX, cam.x));
  cam.y = Math.max(bounds.minY, Math.min(bounds.maxY, cam.y));
}

export function canPan(cam: Camera, bounds: CameraBounds, dir: PanDir, epsilon = 0.5): boolean {
  switch (dir) {
    case "left":
      return cam.x < bounds.maxX - epsilon;
    case "right":
      return cam.x > bounds.minX + epsilon;
    case "up":
      return cam.y < bounds.maxY - epsilon;
    case "down":
      return cam.y > bounds.minY + epsilon;
  }
}

export function panAvailability(cam: Camera, bounds: CameraBounds, epsilon = 0.5): PanAvailability {
  return {
    left: canPan(cam, bounds, "left", epsilon),
    right: canPan(cam, bounds, "right", epsilon),
    up: canPan(cam, bounds, "up", epsilon),
    down: canPan(cam, bounds, "down", epsilon),
  };
}

export function panOffset(dir: PanDir, step = PAN_STEP): { dx: number; dy: number } {
  switch (dir) {
    case "left":
      return { dx: step, dy: 0 };
    case "right":
      return { dx: -step, dy: 0 };
    case "up":
      return { dx: 0, dy: step };
    case "down":
      return { dx: 0, dy: -step };
  }
}

export function panCamera(cam: Camera, dx: number, dy: number, bounds?: CameraBounds): void {
  cam.x += dx;
  cam.y += dy;
  if (bounds) clampCamera(cam, bounds);
}

export const EDGE_PAN_BAND = 36;

export function panDirFromPointer(
  x: number,
  y: number,
  width: number,
  height: number,
  band = EDGE_PAN_BAND,
  avail?: PanAvailability,
): PanDir | null {
  if (x < 0 || y < 0 || x > width || y > height) return null;
  const candidates: { dir: PanDir; dist: number }[] = [];
  if (x <= band) candidates.push({ dir: "left", dist: x });
  if (width - x <= band) candidates.push({ dir: "right", dist: width - x });
  if (y <= band) candidates.push({ dir: "up", dist: y });
  if (height - y <= band) candidates.push({ dir: "down", dist: height - y });
  const allowed = avail ? candidates.filter((c) => avail[c.dir]) : candidates;
  if (!allowed.length) return null;
  allowed.sort((a, b) => a.dist - b.dist);
  return allowed[0].dir;
}

export { cameraViewQuad, screenToGroundTile };
