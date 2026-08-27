import type { SimState, Vec2 } from "../types";
import { inBounds, staticNavigationFor } from "./world";
import { PATH_DIRS } from "./pathfinding";

const UNREACHABLE = -1;

/**
 * A reverse-traversed distance field. Every cell points toward a lower
 * distance, so a whole group can share one terrain search.
 */
export type FlowField = {
  goal: Vec2;
  revision: number;
  width: number;
  height: number;
  distance: Int32Array;
};

const fieldsByState = new WeakMap<SimState, Map<string, FlowField>>();

export function flowFieldFor(state: SimState, requestedGoal: Vec2): FlowField {
  const revision = state.navigationRevision ?? 0;
  const goal = { x: Math.round(requestedGoal.x), y: Math.round(requestedGoal.y) };
  const key = `${revision}:${goal.x}:${goal.y}`;
  let fields = fieldsByState.get(state);
  if (!fields) {
    fields = new Map();
    fieldsByState.set(state, fields);
  }
  const cached = fields.get(key);
  if (cached) return cached;

  const field = buildFlowField(state, goal, revision);
  fields.set(key, field);
  return field;
}

export function flowFieldCacheSize(state: SimState): number {
  return fieldsByState.get(state)?.size ?? 0;
}

export function flowStep(field: FlowField, x: number, y: number): Vec2 | undefined {
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (cx < 0 || cy < 0 || cx >= field.width || cy >= field.height) return undefined;
  const currentDistance = field.distance[cy * field.width + cx] ?? UNREACHABLE;
  if (currentDistance <= 0) return undefined;

  let best: Vec2 | undefined;
  let bestDistance = currentDistance;
  for (const direction of PATH_DIRS) {
    const nx = cx + direction.x;
    const ny = cy + direction.y;
    if (nx < 0 || ny < 0 || nx >= field.width || ny >= field.height) continue;
    const distance = field.distance[ny * field.width + nx] ?? UNREACHABLE;
    if (distance >= 0 && distance < bestDistance) {
      bestDistance = distance;
      best = { x: nx, y: ny };
    }
  }
  return best;
}

function buildFlowField(state: SimState, requestedGoal: Vec2, revision: number): FlowField {
  const width = state.width;
  const height = state.height;
  const distance = new Int32Array(width * height);
  distance.fill(UNREACHABLE);
  const navigation = staticNavigationFor(state);
  const passable = (x: number, y: number) => inBounds(state, x, y) && navigation.walkable[y * width + x] === 1;
  const canClimbLocal = (x0: number, y0: number, x1: number, y1: number) =>
    Math.abs(navigation.heights[y1 * width + x1]! - navigation.heights[y0 * width + x0]!) <= 1;
  const origin = flowOrigin(state, requestedGoal, passable);
  if (!origin) return { goal: requestedGoal, revision, width, height, distance };

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const originKey = origin.y * width + origin.x;
  distance[originKey] = 0;
  queue[tail++] = originKey;

  while (head < tail) {
    const currentKey = queue[head++]!;
    const currentX = currentKey % width;
    const currentY = Math.floor(currentKey / width);
    const nextDistance = (distance[currentKey] ?? 0) + 1;
    for (const direction of PATH_DIRS) {
      const nx = currentX + direction.x;
      const ny = currentY + direction.y;
      if (!passable(nx, ny)) continue;
      if (!canClimbLocal(nx, ny, currentX, currentY)) continue;
      if (diagonalCornerBlockedLocal(navigation, passable, nx, ny, currentX, currentY)) continue;
      const nextKey = ny * width + nx;
      if ((distance[nextKey] ?? UNREACHABLE) !== UNREACHABLE) continue;
      distance[nextKey] = nextDistance;
      queue[tail++] = nextKey;
    }
  }

  return { goal: origin, revision, width, height, distance };
}

function flowOrigin(state: SimState, requestedGoal: Vec2, passable: (x: number, y: number) => boolean): Vec2 | undefined {
  const x = Math.round(requestedGoal.x);
  const y = Math.round(requestedGoal.y);
  if (!inBounds(state, x, y)) return undefined;
  if (passable(x, y)) return { x, y };
  // Match A*'s blocked-goal contract: a neighboring walkable tile is a valid
  // destination, with stable direction ordering for deterministic replays.
  for (const direction of PATH_DIRS) {
    const nx = x + direction.x;
    const ny = y + direction.y;
    if (passable(nx, ny)) return { x: nx, y: ny };
  }
  return undefined;
}

function diagonalCornerBlockedLocal(
  navigation: ReturnType<typeof staticNavigationFor>,
  passable: (x: number, y: number) => boolean,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 || dy === 0) return false;
  const width = navigation.width;
  if (!passable(x0 + dx, y0) || Math.abs(navigation.heights[y0 * width + (x0 + dx)]! - navigation.heights[y0 * width + x0]!) > 1) return true;
  if (!passable(x0, y0 + dy) || Math.abs(navigation.heights[(y0 + dy) * width + x0]! - navigation.heights[y0 * width + x0]!) > 1) return true;
  return false;
}
