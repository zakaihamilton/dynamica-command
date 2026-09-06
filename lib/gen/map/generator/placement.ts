import type { Vec2 } from "../../../types";
import type { MapCorner } from "./types";

export function startPointForCorner(
  corner: MapCorner,
  width: number,
  height: number,
  xInset: number,
  yInset: number,
): Vec2 {
  return {
    x: corner === "bottomLeft" ? xInset : width - 1 - xInset,
    y: corner === "topRight" ? yInset : height - 1 - yInset,
  };
}

export function clampPoint(point: Vec2, width: number, height: number): Vec2 {
  return {
    x: Math.max(3, Math.min(width - 4, Math.round(point.x))),
    y: Math.max(3, Math.min(height - 4, Math.round(point.y))),
  };
}

export function mapSizeForMission(index: number): number {
  if (index <= 1) return 48;
  if (index <= 3) return 72;
  return 96;
}
