import type { SimState, Vec2 } from "../../types";
import { staticNavigationFor } from "../world";

export const PATH_MAX_NODES = 4096;

export const PATH_DIRS: Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

export function inBoundsNavigation(navigation: ReturnType<typeof staticNavigationFor>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < navigation.width && y < navigation.height;
}

export function diagonalCornerBlockedLocal(
  navigation: ReturnType<typeof staticNavigationFor>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 || dy === 0) return false;
  const width = navigation.width;
  if (!inBoundsNavigation(navigation, x0 + dx, y0) || navigation.walkable[y0 * width + x0 + dx] !== 1) return true;
  if (Math.abs(navigation.heights[y0 * width + x0 + dx]! - navigation.heights[y0 * width + x0]!) > 1) return true;
  if (!inBoundsNavigation(navigation, x0, y0 + dy) || navigation.walkable[(y0 + dy) * width + x0] !== 1) return true;
  if (Math.abs(navigation.heights[(y0 + dy) * width + x0]! - navigation.heights[y0 * width + x0]!) > 1) return true;
  return false;
}

export function diagonalCornerBlocked(state: SimState, x0: number, y0: number, x1: number, y1: number): boolean {
  const navigation = staticNavigationFor(state);
  return diagonalCornerBlockedLocal(navigation, x0, y0, x1, y1);
}
