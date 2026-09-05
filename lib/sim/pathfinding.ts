import { footprintOf } from "../catalog";
import { isBuildingEntity, type Entity, type SimState, type Vec2 } from "../types";
import { inBounds, makeUnitOccupancy, staticNavigationFor } from "./world";

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
  open: MinHeap;
};

type StaticPathCache = {
  revision: number;
  paths: Map<string, PathSearchResult>;
};

const searchBuffers = new WeakMap<SimState, SearchBuffers>();
const staticPathCache = new WeakMap<SimState, StaticPathCache>();
const sharedStaticPaths = new Map<string, PathSearchResult>();
const SHARED_STATIC_PATH_LIMIT = 4096;

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
  private xs = new Float64Array(64);
  private ys = new Float64Array(64);
  private gs = new Float64Array(64);
  private fs = new Float64Array(64);
  private seqs = new Float64Array(64);
  private size = 0;
  x = 0;
  y = 0;
  g = 0;
  f = 0;
  seq = 0;

  get length(): number {
    return this.size;
  }

  clear(): void {
    this.size = 0;
  }

  push(x: number, y: number, g: number, f: number, seq: number): void {
    const index = this.size;
    this.ensureCapacity(index + 1);
    this.xs[index] = x;
    this.ys[index] = y;
    this.gs[index] = g;
    this.fs[index] = f;
    this.seqs[index] = seq;
    this.size = index + 1;
    this.up(index);
  }

  pop(): boolean {
    const n = this.size;
    if (!n) return false;
    this.x = this.xs[0]!;
    this.y = this.ys[0]!;
    this.g = this.gs[0]!;
    this.f = this.fs[0]!;
    this.seq = this.seqs[0]!;
    const last = n - 1;
    if (last > 0) {
      this.xs[0] = this.xs[last]!;
      this.ys[0] = this.ys[last]!;
      this.gs[0] = this.gs[last]!;
      this.fs[0] = this.fs[last]!;
      this.seqs[0] = this.seqs[last]!;
    }
    this.size = last;
    if (last > 0) this.down(0);
    return true;
  }

  private less(i: number, j: number): boolean {
    const a = this.fs[i]!;
    const b = this.fs[j]!;
    if (a !== b) return a < b;
    return this.seqs[i]! < this.seqs[j]!;
  }

  private swap(i: number, j: number): void {
    let value = this.xs[i]!;
    this.xs[i] = this.xs[j]!;
    this.xs[j] = value;
    value = this.ys[i]!;
    this.ys[i] = this.ys[j]!;
    this.ys[j] = value;
    value = this.gs[i]!;
    this.gs[i] = this.gs[j]!;
    this.gs[j] = value;
    value = this.fs[i]!;
    this.fs[i] = this.fs[j]!;
    this.fs[j] = value;
    value = this.seqs[i]!;
    this.seqs[i] = this.seqs[j]!;
    this.seqs[j] = value;
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
    const n = this.size;
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

  private ensureCapacity(required: number): void {
    if (required <= this.fs.length) return;
    const capacity = Math.max(required, this.fs.length * 2);
    const xs = new Float64Array(capacity);
    const ys = new Float64Array(capacity);
    const gs = new Float64Array(capacity);
    const fs = new Float64Array(capacity);
    const seqs = new Float64Array(capacity);
    xs.set(this.xs);
    ys.set(this.ys);
    gs.set(this.gs);
    fs.set(this.fs);
    seqs.set(this.seqs);
    this.xs = xs;
    this.ys = ys;
    this.gs = gs;
    this.fs = fs;
    this.seqs = seqs;
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
  const w = state.width;
  if (sx === gx && sy === gy) return { path: [], status: "complete" };
  if (!inBounds(state, gx, gy)) return { path: [], status: "unreachable" };

  const ignoreId = ignoreIdOf(from, opts);
  const avoidUnits = opts?.avoidUnits === true;
  const maxNodes = Math.min(opts?.maxNodes ?? PATH_MAX_NODES, PATH_MAX_NODES, w * state.height);
  const navigationRevision = state.navigationRevision ?? 0;
  const target = to as Entity;
  const targetFootprint = isBuildingEntity(target) ? footprintOf(target.kind) : undefined;
  const navigation = staticNavigationFor(state);
  const cacheKey = !avoidUnits
    ? `${sx},${sy}:${gx},${gy}:${maxNodes}:${targetFootprint?.w ?? 0},${targetFootprint?.h ?? 0}`
    : undefined;
  if (cacheKey) {
    const sharedKey = `${navigation.geometryKey}:${cacheKey}`;
    const shared = sharedStaticPaths.get(sharedKey);
    if (shared) {
      sharedStaticPaths.delete(sharedKey);
      sharedStaticPaths.set(sharedKey, shared);
      return { path: shared.path.slice(), status: shared.status };
    }
    const cache = staticPathCache.get(state);
    if (cache?.revision === navigationRevision) {
      const cached = cache.paths.get(cacheKey);
      if (cached) return { path: cached.path.slice(), status: cached.status };
    }
  }
  const occupancy = avoidUnits
    ? (opts?.occupancy ?? makeUnitOccupancy(state, ignoreId))
    : undefined;
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
  const goalOk = (x: number, y: number) => {
    if (targetFootprint) {
      const inside = x >= gx && x < gx + targetFootprint.w && y >= gy && y < gy + targetFootprint.h;
      return !inside
        && x >= gx - 1
        && x <= gx + targetFootprint.w
        && y >= gy - 1
        && y <= gy + targetFootprint.h;
    }
    return walkableGoal ? x === gx && y === gy : Math.max(Math.abs(x - gx), Math.abs(y - gy)) === 1;
  };

  const key = (x: number, y: number) => y * w + x;
  const buffers = buffersFor(state, w * state.height);
  const open = buffers.open;
  open.clear();
  let seq = 0;
  open.push(sx, sy, 0, heuristic(sx, sy, gx, gy), seq++);
  const generation = nextGeneration(buffers);
  buffers.stamps[startKey] = generation;
  buffers.gScore[startKey] = 0;
  let explored = 0;
  let bestKey = -1;
  let bestH = Infinity;

  while (open.length && explored < maxNodes) {
    open.pop();
    const currentX = open.x;
    const currentY = open.y;
    const currentG = open.g;
    const currentKey = key(currentX, currentY);
    if (currentG > (buffers.gScore[currentKey] ?? Infinity)) continue;
    explored++;
    const h = heuristic(currentX, currentY, gx, gy);
    if (h < bestH && !(currentX === sx && currentY === sy)) {
      bestH = h;
      bestKey = currentKey;
    }
    if (goalOk(currentX, currentY) && !(currentX === sx && currentY === sy && !walkableGoal)) {
      if (currentX === sx && currentY === sy) continue;
      return cacheStaticPath(state, navigation.geometryKey, cacheKey, navigationRevision, { path: reconstruct(buffers.parent, currentKey, startKey, w), status: "complete" });
    }
    for (const d of PATH_DIRS) {
      const nx = currentX + d.x;
      const ny = currentY + d.y;
      if (!inBounds(state, nx, ny)) continue;
      if (!passable(nx, ny)) continue;
      if (!canClimbLocal(currentX, currentY, nx, ny)) continue;
      if (diagonalCornerBlockedLocal(navigation, currentX, currentY, nx, ny)) continue;
      const step = d.x !== 0 && d.y !== 0 ? 1.414 : 1;
      const tentative = currentG + step;
      const k = key(nx, ny);
      if (tentative >= (buffers.stamps[k] === generation ? buffers.gScore[k] : Infinity)) continue;
      buffers.stamps[k] = generation;
      buffers.gScore[k] = tentative;
      buffers.parent[k] = currentKey;
      open.push(nx, ny, tentative, tentative + heuristic(nx, ny, gx, gy), seq++);
    }
  }
  const capped = explored >= maxNodes && open.length > 0;
  if (capped && bestKey < 0) return cacheStaticPath(state, navigation.geometryKey, cacheKey, navigationRevision, { path: [], status: "partial" });
  if (bestKey >= 0) {
    return cacheStaticPath(state, navigation.geometryKey, cacheKey, navigationRevision, {
      path: reconstruct(buffers.parent, bestKey, startKey, w),
      status: capped ? "partial" : "unreachable",
    });
  }
  return cacheStaticPath(state, navigation.geometryKey, cacheKey, navigationRevision, { path: [], status: "unreachable" });
}

function cacheStaticPath(
  state: SimState,
  geometryKey: string,
  key: string | undefined,
  revision: number,
  result: PathSearchResult,
): PathSearchResult {
  if (!key) return result;
  const sharedKey = `${geometryKey}:${key}`;
  sharedStaticPaths.set(sharedKey, { path: result.path.slice(), status: result.status });
  while (sharedStaticPaths.size > SHARED_STATIC_PATH_LIMIT) {
    const first = sharedStaticPaths.keys().next().value as string | undefined;
    if (first === undefined) break;
    sharedStaticPaths.delete(first);
  }
  let cache = staticPathCache.get(state);
  if (!cache || cache.revision !== revision) {
    cache = { revision, paths: new Map() };
    staticPathCache.set(state, cache);
  }
  // Keep a private copy because callers consume paths with shift/unshift.
  cache.paths.set(key, { path: result.path.slice(), status: result.status });
  return result;
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
    open: new MinHeap(),
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
