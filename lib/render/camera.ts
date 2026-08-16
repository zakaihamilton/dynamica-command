import type { Camera } from "./iso";
import { clampZoom } from "./iso";

export function panCamera(cam: Camera, dx: number, dy: number): void {
  cam.x += dx;
  cam.y += dy;
}

export function zoomAt(cam: Camera, sx: number, sy: number, delta: number): void {
  const before = cam.zoom;
  cam.zoom = clampZoom(cam.zoom * (delta < 0 ? 1.1 : 0.9));
  const k = cam.zoom / before;
  cam.x = sx - (sx - cam.x) * k;
  cam.y = sy - (sy - cam.y) * k;
}
