import type { Entity, SimState, Vec2 } from "../types";
import { inBounds, makeUnitOccupancy, staticNavigationFor } from "./world";

type Node = { x: number; y: number; g: number; f: number; px: number; py: number; seq: number };

export type PathSearchStatus = "complete" | "partial" | "unreachable";

export type PathSearchResult = {
  path: Vec2[];
  status: PathSearchStatus;
};

export const PATH_MAX_NODES = 4096;

/** Persist only the states that need another search or must stay blocked. */
export function routePendingFor(status: PathSearchStatus): boolean | undefined {
  if (status === "partial") return true;
  if (status === "unreachable") return false;
  return undefined;
}

type SearchBuffers = {
  stamps: Uint32Array;
  gScore: Float64Array;
  parent: Int32Array;
  generation: number;
};

const searchBuffers = new WeakMap<SimState, SearchBuffers>();

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

export type FindPathOptions = {
  maxNodes?: number;
  avoidUnits?: boolean;
  ignoreId?: number;
  occupancy?: Uint8Array;
};

class MinHeap {
  private items: Node[] = [];

  get length(): number {
    return this.items.length;
  }

  push(node: Node): void {
    this.items.push(node);
    this.up(this.items.length - 1);
  }

  pop(): Node | undefined {
    const items = this.items;
    if (!items.length) return undefined;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      this.down(0);
    }
    return top;
  }

  private less(i: number, j: number): boolean {
    const a = this.items[i]!;
    const b = this.items[j]!;
    if (a.f !== b.f) return a.f < b.f;
    return a.seq < b.seq;
  }

  private swap(i: number, j: number): void {
    const items = this.items;
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }

  private up(index: number): void {
    let i = index;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  private down(index: number): void {
    const n = this.items.length;
    let i = index;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let best = i;
      if (l < n && this.less(l, best)) best = l;
      if (r < n && this.less(r, best)) best = r;
      if (best === i) break;
      this.swap(i, best);
      i = best;
    }
  }
}

function ignoreIdOf(from: Vec2, opts?: FindPathOptions): number | undefined {
  if (opts?.ignoreId !== undefined) return opts.ignoreId;
  const maybe = from as Vec2 & Partial<Entity>;
  return typeof maybe.id === "number" ? maybe.id : undefined;
}

function occupancyAt(occupancy: Uint8Array, w: number, x: number, y: number): boolean {
  return occupancy[y * w + x] === 1;
}

export function diagonalCornerBlocked(state: SimState, x0: number, y0: number, x1: number, y1: number): boolean {
  const navigation = staticNavigationFor(state);
  return diagonalCornerBlockedLocal(navigation, x0, y0, x1, y1);
}

export function findPath(
  state: SimState,
  from: Vec2,
  to: Vec2,
  opts?: FindPathOptions,
): Vec2[] {
  return findPathDetailed(state, from, to, opts).path;
}

export function findPathDetailed(
  state: SimState,
  from: Vec2,
  to: Vec2,
  opts?: FindPathOptions,
): PathSearchResult {
  const sx = Math.round(from.x);
  const sy = Math.round(from.y);
  const gx = Math.round(to.x);
  const gy = Math.round(to.y);
  if (sx === gx && sy === gy) return { path: [], status: "complete" };
  if (!inBounds(state, gx, gy)) return { path: [], status: "unreachable" };

  const ignoreId = ignoreIdOf(from, opts);
  const avoidUnits = opts?.avoidUnits === true;
  const occupancy = avoidUnits
    ? (opts?.occupancy ?? makeUnitOccupancy(state, ignoreId))
    : undefined;
  const w = state.width;
  const navigation = staticNavigationFor(state);
  const canClimbLocal = (x0: number, y0: number, x1: number, y1: number) =>
    Math.abs(navigation.heights[y1 * w + x1]! - navigation.heights[y0 * w + x0]!) <= 1;
  const startKey = sy * w + sx;
  const unitBlocked = (x: number, y: number) => {
    if (!avoidUnits || !occupancy) return false;
    const k = y * w + x;
    if (k === startKey) return false;
    return occupancyAt(occupancy, w, x, y);
  };
  const passable = (x: number, y: number) => inBounds(state, x, y) && navigation.walkable[y * w + x] === 1 && !unitBlocked(x, y);

  const walkableGoal = passable(gx, gy);
  const goalOk = (x: number, y: number) =>
    walkableGoal ? x === gx && y === gy : Math.max(Math.abs(x - gx), Math.abs(y - gy)) === 1;

  const maxNodes = Math.min(opts?.maxNodes ?? PATH_MAX_NODES, PATH_MAX_NODES, w * state.height);
  const key = (x: number, y: number) => y * w + x;
  const open = new MinHeap();
  let seq = 0;
  open.push({ x: sx, y: sy, g: 0, f: heuristic(sx, sy, gx, gy), px: -1, py: -1, seq: seq++ });
  const buffers = buffersFor(state, w * state.height);
  const generation = nextGeneration(buffers);
  buffers.stamps[startKey] = generation;
  buffers.gScore[startKey] = 0;
  let explored = 0;
  let bestKey = -1;
  let bestH = Infinity;

  while (open.length && explored < maxNodes) {
    const current = open.pop()!;
    const currentKey = key(current.x, current.y);
    if (current.g > (buffers.gScore[currentKey] ?? Infinity)) continue;
    explored++;
    const h = heuristic(current.x, current.y, gx, gy);
    if (h < bestH && !(current.x === sx && current.y === sy)) {
      bestH = h;
      bestKey = currentKey;
    }
    if (goalOk(current.x, current.y) && !(current.x === sx && current.y === sy && !walkableGoal)) {
      if (current.x === sx && current.y === sy) continue;
      return { path: reconstruct(buffers.parent, currentKey, startKey, w), status: "complete" };
    }
    for (const d of PATH_DIRS) {
      const nx = current.x + d.x;
      const ny = current.y + d.y;
      if (!inBounds(state, nx, ny)) continue;
      if (!passable(nx, ny)) continue;
      if (!canClimbLocal(current.x, current.y, nx, ny)) continue;
      if (diagonalCornerBlockedLocal(navigation, current.x, current.y, nx, ny)) continue;
      const step = d.x !== 0 && d.y !== 0 ? 1.414 : 1;
      const tentative = current.g + step;
      const k = key(nx, ny);
      if (tentative >= (buffers.stamps[k] === generation ? buffers.gScore[k] : Infinity)) continue;
      buffers.stamps[k] = generation;
      buffers.gScore[k] = tentative;
      buffers.parent[k] = currentKey;
      open.push({
        x: nx,
        y: ny,
        g: tentative,
        f: tentative + heuristic(nx, ny, gx, gy),
        px: current.x,
        py: current.y,
        seq: seq++,
      });
    }
  }
  const capped = explored >= maxNodes && open.length > 0;
  if (capped && bestKey < 0) return { path: [], status: "partial" };
  if (bestKey >= 0) {
    return {
      path: reconstruct(buffers.parent, bestKey, startKey, w),
      status: capped ? "partial" : "unreachable",
    };
  }
  return { path: [], status: "unreachable" };
}

function diagonalCornerBlockedLocal(
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

function inBoundsNavigation(navigation: ReturnType<typeof staticNavigationFor>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < navigation.width && y < navigation.height;
}

function heuristic(x: number, y: number, gx: number, gy: number): number {
  const dx = Math.abs(x - gx);
  const dy = Math.abs(y - gy);
  return dx + dy + (1.414 - 2) * Math.min(dx, dy);
}

function buffersFor(state: SimState, size: number): SearchBuffers {
  const existing = searchBuffers.get(state);
  if (existing && existing.stamps.length === size) return existing;
  const created: SearchBuffers = {
    stamps: new Uint32Array(size),
    gScore: new Float64Array(size),
    parent: new Int32Array(size),
    generation: 0,
  };
  searchBuffers.set(state, created);
  return created;
}

function nextGeneration(buffers: SearchBuffers): number {
  buffers.generation += 1;
  if (buffers.generation === 0xffffffff) {
    buffers.stamps.fill(0);
    buffers.generation = 1;
  }
  return buffers.generation;
}

function reconstruct(parent: Int32Array, endKey: number, startKey: number, w: number): Vec2[] {
  const path: Vec2[] = [];
  let cur = endKey;
  while (cur !== startKey && cur >= 0) {
    const x = cur % w;
    const y = Math.floor(cur / w);
    path.push({ x, y });
    cur = parent[cur] ?? -1;
  }
  path.reverse();
  return path;
}

export function stepAlongPath(
  e: { x: number; y: number; path: Vec2[] },
  speed: number,
  canEnter?: (x: number, y: number) => boolean,
): void {
  if (!e.path.length) return;
  const target = e.path[0]!;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d <= speed || d < 0.05) {
    if (canEnter && !canEnter(target.x, target.y)) return;
    e.x = target.x;
    e.y = target.y;
    e.path.shift();
    return;
  }
  e.x += (dx / d) * speed;
  e.y += (dy / d) * speed;
}
