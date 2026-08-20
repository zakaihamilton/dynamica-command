import { createRng, type Rng } from "../seed/rng";
import {
  SURFACE_CONCRETE,
  SURFACE_NONE,
  SURFACE_ROAD,
  TILE_BLOCKED,
  TILE_CLEAR,
  TILE_RESOURCE,
  TILE_WATER,
  type BiomeName,
  type MissionDef,
  type SurfaceKind,
  type Vec2,
  type WinCategory,
} from "../types";

export type GeneratedMap = {
  width: number;
  height: number;
  tiles: number[];
  heights: number[];
  surfaces: SurfaceKind[];
  biome: BiomeName;
  resourceAmount: number[];
  playerStart: Vec2;
  enemyStart: Vec2;
  markedSpots: Vec2[];
};

function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

function hashNoise(x: number, y: number, salt: number): number {
  let n = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + salt, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const v00 = hashNoise(x0, y0, salt);
  const v10 = hashNoise(x0 + 1, y0, salt);
  const v01 = hashNoise(x0, y0 + 1, salt);
  const v11 = hashNoise(x0 + 1, y0 + 1, salt);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fy;
}

function fbm(x: number, y: number, salt: number): number {
  return (
    valueNoise(x / 8, y / 8, salt) * 0.55 +
    valueNoise(x / 4, y / 4, salt + 17) * 0.3 +
    valueNoise(x / 2, y / 2, salt + 31) * 0.15
  );
}

function warpedFbm(x: number, y: number, salt: number): number {
  const wx = (valueNoise(x / 10, y / 10, salt + 401) - 0.5) * 6;
  const wy = (valueNoise(x / 10, y / 10, salt + 419) - 0.5) * 6;
  return fbm(x + wx, y + wy, salt);
}

function meanderingRoute(a: Vec2, b: Vec2, width: number, height: number, salt: number): Vec2[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const px = -dy / length;
  const py = dx / length;
  const bend = Math.min(width, height) * 0.12;
  const points: Vec2[] = [a];
  for (const t of [0.25, 0.5, 0.75]) {
    const wave = (valueNoise(t * 9, salt * 0.001, salt + Math.round(t * 100)) * 2 - 1) * bend;
    points.push({
      x: Math.max(2, Math.min(width - 3, Math.round(a.x + dx * t + px * wave))),
      y: Math.max(2, Math.min(height - 3, Math.round(a.y + dy * t + py * wave))),
    });
  }
  points.push(b);
  return points;
}

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function neighbors8(x: number, y: number): Vec2[] {
  const out: Vec2[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      out.push({ x: x + dx, y: y + dy });
    }
  }
  return out;
}

function carveRoute(
  tiles: number[],
  heights: number[],
  surfaces: SurfaceKind[],
  w: number,
  h: number,
  points: Vec2[],
  radius = 1,
  noiseSalt = 1,
  meander = true,
): void {
  for (let p = 0; p < points.length - 1; p++) {
    const a = points[p]!;
    const b = points[p + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const envelope = Math.sin(t * Math.PI);
      const wander = meander
        ? (valueNoise(a.x + dx * t, a.y + dy * t, noiseSalt + 77) * 2 - 1) * 3.6 * envelope
        : 0;
      const cx = Math.round(a.x + dx * t + px * wander);
      const cy = Math.round(a.y + dy * t + py * wander);
      const localRadius = radius + (valueNoise(cx * 0.35, cy * 0.35, noiseSalt + 91) > 0.62 ? 1 : 0);
      for (let oy = -localRadius; oy <= localRadius; oy++) {
        for (let ox = -localRadius; ox <= localRadius; ox++) {
          if (Math.abs(ox) + Math.abs(oy) > localRadius + 1) continue;
          const x = cx + ox;
          const y = cy + oy;
          if (!inBounds(x, y, w, h)) continue;
          const i = idx(x, y, w);
          tiles[i] = TILE_CLEAR;
          heights[i] = 1;
          if (surfaces[i] !== SURFACE_CONCRETE) surfaces[i] = SURFACE_ROAD;
        }
      }
    }
  }
}

function flattenArea(
  tiles: number[],
  heights: number[],
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  level: number,
): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y, w, h)) continue;
      if (Math.hypot(x - cx, y - cy) > r) continue;
      const i = idx(x, y, w);
      if (tiles[i] === TILE_WATER) {
        tiles[i] = TILE_CLEAR;
      }
      heights[i] = level;
    }
  }
}

function paintBase(
  tiles: number[],
  heights: number[],
  surfaces: SurfaceKind[],
  w: number,
  h: number,
  center: Vec2,
  radius: number,
): void {
  flattenArea(tiles, heights, w, h, center.x, center.y, radius, 1);
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (!inBounds(x, y, w, h) || Math.hypot(x - center.x, y - center.y) > radius) continue;
      const i = idx(x, y, w);
      tiles[i] = TILE_CLEAR;
      surfaces[i] = Math.hypot(x - center.x, y - center.y) <= radius - 2
        ? SURFACE_CONCRETE
        : SURFACE_NONE;
    }
  }
}

function countKind(
  tiles: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  kind: number,
): number {
  let n = 0;
  for (const nb of neighbors8(x, y)) {
    if (!inBounds(nb.x, nb.y, w, h)) continue;
    if (tiles[idx(nb.x, nb.y, w)] === kind) n += 1;
  }
  return n;
}

function smoothWater(
  tiles: number[],
  w: number,
  h: number,
  protect: (x: number, y: number) => boolean,
): void {
  for (let pass = 0; pass < 2; pass++) {
    const next = tiles.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (protect(x, y)) continue;
        const i = idx(x, y, w);
        const n = countKind(tiles, x, y, w, h, TILE_WATER);
        if (tiles[i] === TILE_WATER) {
          if (n < 3) next[i] = TILE_CLEAR;
        } else if (tiles[i] === TILE_CLEAR && n >= 5) {
          next[i] = TILE_WATER;
        }
      }
    }
    for (let i = 0; i < tiles.length; i++) tiles[i] = next[i]!;
  }
}

function pruneWaterIslands(tiles: number[], w: number, h: number, heights?: number[]): void {
  const seen = new Uint8Array(tiles.length);
  const components: number[][] = [];
  const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = idx(x, y, w);
      if (seen[start] || tiles[start] !== TILE_WATER) continue;
      const component: number[] = [];
      const queue = [start];
      seen[start] = 1;
      while (queue.length) {
        const current = queue.pop()!;
        component.push(current);
        const cx = current % w;
        const cy = Math.floor(current / w);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!inBounds(nx, ny, w, h)) continue;
          const next = idx(nx, ny, w);
          if (seen[next] || tiles[next] !== TILE_WATER) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }
      components.push(component);
    }
  }

  if (components.length === 0) return;
  let largest = 0;
  for (let i = 1; i < components.length; i++) {
    if (components[i]!.length > components[largest]!.length) largest = i;
  }
  const minimumBlobSize = Math.max(4, Math.round(w * h * 0.0015));
  const keepLargest = components[largest]!.length >= minimumBlobSize;
  for (let i = 0; i < components.length; i++) {
    if ((i === largest && keepLargest) || components[i]!.length >= minimumBlobSize) continue;
    for (const cell of components[i]!) {
      tiles[cell] = TILE_CLEAR;
      if (heights) heights[cell] = 1;
    }
  }
}

function relaxHeights(heights: number[], tiles: number[], w: number, h: number): void {
  const next = heights.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      if (tiles[i] === TILE_WATER) continue;
      const here = heights[i] ?? 1;
      if (here < 2) continue;
      let similar = 0;
      for (const nb of neighbors8(x, y)) {
        if (!inBounds(nb.x, nb.y, w, h)) continue;
        const nh = heights[idx(nb.x, nb.y, w)] ?? 1;
        if (nh >= 2) similar += 1;
      }
      if (similar < 2) next[i] = here >= 3 ? 2 : 1;
    }
  }
  for (let i = 0; i < heights.length; i++) heights[i] = next[i]!;
}

function reachable(tiles: number[], heights: number[], w: number, h: number, start: Vec2, goal: Vec2): boolean {
  const seen = new Uint8Array(w * h);
  const q: Vec2[] = [start];
  seen[idx(start.x, start.y, w)] = 1;
  while (q.length) {
    const c = q.pop()!;
    if (c.x === goal.x && c.y === goal.y) return true;
    for (const n of neighbors8(c.x, c.y)) {
      if (!inBounds(n.x, n.y, w, h)) continue;
      const i = idx(n.x, n.y, w);
      if (seen[i]) continue;
      if (tiles[i] === TILE_WATER || tiles[i] === TILE_BLOCKED) continue;
      if (Math.abs((heights[i] ?? 1) - (heights[idx(c.x, c.y, w)] ?? 1)) > 1) continue;
      seen[i] = 1;
      q.push(n);
    }
  }
  return false;
}

function biomeTuning(biome: BiomeName): { water: number; blockers: number; mountain: number } {
  switch (biome) {
    case "salt marshes": return { water: 0.38, blockers: 0.79, mountain: 0.82 };
    case "glass desert": return { water: 0.19, blockers: 0.84, mountain: 0.72 };
    case "rust canyons": return { water: 0.22, blockers: 0.78, mountain: 0.66 };
    case "tundra grid": return { water: 0.3, blockers: 0.83, mountain: 0.72 };
    case "jungle wreckage": return { water: 0.31, blockers: 0.69, mountain: 0.77 };
    case "volcanic shelf": return { water: 0.25, blockers: 0.75, mountain: 0.67 };
    case "crystal flats": return { water: 0.24, blockers: 0.8, mountain: 0.78 };
    default: return { water: 0.27, blockers: 0.81, mountain: 0.73 };
  }
}

function resourcePatch(
  tiles: number[],
  resourceAmount: number[],
  surfaces: SurfaceKind[],
  w: number,
  h: number,
  center: Vec2,
  radius: number,
  rng: Rng,
): void {
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (!inBounds(x, y, w, h)) continue;
      if (Math.hypot(x - center.x, y - center.y) > radius + rng.next() * 0.35) continue;
      const i = idx(x, y, w);
      if (tiles[i] !== TILE_CLEAR || surfaces[i] === SURFACE_CONCRETE) continue;
      tiles[i] = TILE_RESOURCE;
      surfaces[i] = SURFACE_NONE;
      resourceAmount[i] = 480 + rng.int(421);
    }
  }
}

export function mapSizeForMission(index: number): number {
  if (index <= 1) return 48;
  if (index <= 4) return 72;
  return 96;
}

export function generateMap(
  seed: number,
  mission: Pick<MissionDef, "index" | "win" | "mapSize" | "biome">,
): GeneratedMap {
  const rng = createRng(seed, `map:${mission.index}`);
  const biome = mission.biome;
  const tuning = biomeTuning(biome);
  const width = mission.mapSize;
  const height = mission.mapSize;
  const tiles = new Array<number>(width * height).fill(TILE_CLEAR);
  const heights = new Array<number>(width * height).fill(1);
  const surfaces = new Array<SurfaceKind>(width * height).fill(SURFACE_NONE);
  const resourceAmount = new Array<number>(width * height).fill(0);
  const salt = mixSalt(rng);

  const playerStart: Vec2 = {
    x: 6 + rng.int(3),
    y: 6 + rng.int(3),
  };
  const enemyStart: Vec2 = {
    x: width - 9 - rng.int(3),
    y: height - 9 - rng.int(3),
  };

  const startClear = 8;
  const protectedStart = (x: number, y: number) =>
    Math.hypot(x - playerStart.x, y - playerStart.y) < startClear
    || Math.hypot(x - enemyStart.x, y - enemyStart.y) < startClear;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (protectedStart(x, y)) {
        tiles[i] = TILE_CLEAR;
        continue;
      }
      const localWet = warpedFbm(x * 0.72, y * 0.72, salt);
      const basinWet = warpedFbm(x * 0.3, y * 0.3, salt + 13);
      const channel = Math.abs(warpedFbm(x * 0.16, y * 0.16, salt + 37) - 0.5);
      const waterScore = localWet * 0.48 + basinWet * 0.52;
      const basin = waterScore < tuning.water * 0.98;
      const river = channel < 0.035 + tuning.water * 0.025 && basinWet < tuning.water + 0.16;
      if (basin || river) tiles[i] = TILE_WATER;
    }
  }
  smoothWater(tiles, width, height, protectedStart);
  pruneWaterIslands(tiles, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const shore = warpedFbm(x * 0.72, y * 0.72, salt);
      if (tiles[i] === TILE_WATER) {
        heights[i] = 0;
        continue;
      }
      const plateau = warpedFbm(x * 0.38, y * 0.38, salt + 91);
      const ridge = warpedFbm(x * 0.16, y * 0.16, salt + 127);
      if (shore < tuning.water + 0.07) {
        heights[i] = 0;
      } else {
        if (plateau > tuning.mountain || ridge > 0.69) heights[i] = 3;
        else if (plateau > tuning.mountain - 0.18 || ridge > 0.59) heights[i] = 2;
        else heights[i] = 1;
      }
      const grove = warpedFbm(x * 0.3, y * 0.3, salt + 211);
      const detail = fbm(x * 1.55, y * 1.55, salt + 223);
      if (grove > tuning.blockers - 0.05 && detail > 0.5 && heights[i]! < 3 && tiles[i] !== TILE_WATER) {
        tiles[i] = TILE_BLOCKED;
      }
    }
  }
  relaxHeights(heights, tiles, width, height);

  paintBase(tiles, heights, surfaces, width, height, playerStart, startClear);
  paintBase(tiles, heights, surfaces, width, height, enemyStart, startClear);

  const upperRoute = meanderingRoute(playerStart, enemyStart, width, height, salt + 7);
  const lowerRoute = meanderingRoute(playerStart, enemyStart, width, height, salt + 17)
    .map((point, i) => i === 0 || i === 4 ? point : {
      x: Math.max(2, Math.min(width - 3, point.x + Math.round((height * 0.12) * (i % 2 ? -1 : 1)))),
      y: Math.max(2, Math.min(height - 3, point.y + Math.round((width * 0.08) * (i % 2 ? 1 : -1)))),
    });
  carveRoute(tiles, heights, surfaces, width, height, upperRoute, 1, salt);
  carveRoute(tiles, heights, surfaces, width, height, lowerRoute, 1, salt + 11);
  if (mission.index >= 4) {
    carveRoute(tiles, heights, surfaces, width, height, meanderingRoute(playerStart, enemyStart, width, height, salt + 27), 1, salt + 23);
  }
  if (!reachable(tiles, heights, width, height, playerStart, enemyStart)) {
    carveRoute(tiles, heights, surfaces, width, height, [playerStart, enemyStart], 2, salt, false);
  }
  // Routes and flat starting pads can cut through a basin. Remove the tiny
  // remnants they leave behind so the final map cannot contain isolated water
  // specks that read as noise instead of a basin or a river.
  pruneWaterIslands(tiles, width, height, heights);

  const safeP = { x: Math.min(width - 5, playerStart.x + 10), y: Math.min(height - 5, playerStart.y + 4) };
  const safeE = { x: Math.max(4, enemyStart.x - 10), y: Math.max(4, enemyStart.y - 4) };
  const center = { x: Math.round(width / 2), y: Math.round(height / 2) };
  resourcePatch(tiles, resourceAmount, surfaces, width, height, safeP, 3, rng);
  resourcePatch(tiles, resourceAmount, surfaces, width, height, safeE, 3, rng);
  resourcePatch(tiles, resourceAmount, surfaces, width, height, center, 3 + (mission.index >= 4 ? 1 : 0), rng);

  const extraPatches = 3 + mission.index + (mission.win.kind === "harvestQuota" ? 3 : 0);
  for (let v = 0; v < extraPatches; v++) {
    for (let tries = 0; tries < 30; tries++) {
      const cx = 4 + rng.int(Math.max(1, width - 8));
      const cy = 4 + rng.int(Math.max(1, height - 8));
      const i = idx(cx, cy, width);
      if (tiles[i] !== TILE_CLEAR || surfaces[i] === SURFACE_CONCRETE) continue;
      if (Math.min(Math.hypot(cx - playerStart.x, cy - playerStart.y), Math.hypot(cx - enemyStart.x, cy - enemyStart.y)) < 9) continue;
      resourcePatch(tiles, resourceAmount, surfaces, width, height, { x: cx, y: cy }, 2 + rng.int(2), rng);
      break;
    }
  }

  const requiredResources = Math.max(
    14_000 + mission.index * 3_000,
    mission.win.kind === "harvestQuota" ? Math.ceil((mission.win.target ?? 0) * 1.5) : 0,
  );
  const resourceTiles = resourceAmount.map((amount, i) => amount > 0 ? i : -1).filter((i) => i >= 0);
  let totalResources = resourceAmount.reduce((sum, amount) => sum + amount, 0);
  for (let i = 0; totalResources < requiredResources && resourceTiles.length; i++) {
    const ri = resourceTiles[i % resourceTiles.length]!;
    const add = Math.min(250, requiredResources - totalResources);
    resourceAmount[ri] = (resourceAmount[ri] ?? 0) + add;
    totalResources += add;
  }

  const markedSpots: Vec2[] = [];
  const markCount =
    mission.win.kind === "destroyMarked" ? mission.win.targetCount ?? 1 : 0;
  for (let m = 0; m < markCount; m++) {
    const spot = {
      x: Math.max(2, enemyStart.x - 4 - m * 3),
      y: Math.max(2, enemyStart.y - 6 + (m % 2) * 2),
    };
    paintBase(tiles, heights, surfaces, width, height, spot, 3);
    markedSpots.push(spot);
  }

  return {
    width,
    height,
    tiles,
    heights,
    surfaces,
    biome,
    resourceAmount,
    playerStart,
    enemyStart,
    markedSpots,
  };
}

function mixSalt(rng: Rng): number {
  return 1 + rng.int(1_000_000);
}

export const MAP_SKIRT = 14;
export const MAP_SKIRT_ALPHA = 0.42;

export type ScenerySample = { kind: number; elev: number };

export function outsideDist(x: number, y: number, w: number, h: number): number {
  const dx = x < 0 ? -x : x >= w ? x - w + 1 : 0;
  const dy = y < 0 ? -y : y >= h ? y - h + 1 : 0;
  return Math.max(dx, dy);
}

export function skirtAlpha(x: number, y: number, w: number, h: number): number {
  return outsideDist(x, y, w, h) <= 0 ? 1 : MAP_SKIRT_ALPHA;
}

export function skirtSample(
  seed: number,
  biome: BiomeName,
  x: number,
  y: number,
  mapW: number,
  mapH: number,
): ScenerySample {
  const dist = outsideDist(x, y, mapW, mapH);
  const salt = (Math.imul(seed ^ 0x9e3779b9, 747796405) >>> 0) % 1_000_000;
  const n = warpedFbm(x * 0.9, y * 0.9, salt);
  const n2 = warpedFbm(x * 1.65, y * 1.65, salt + 51);
  const riverBand = warpedFbm(x * 0.22, y * 0.22, salt + 113);
  const tuning = biomeTuning(biome);
  const river = Math.abs(riverBand - 0.5) < 0.08 || n < tuning.water * 0.85;
  if (river && dist <= 8 && n2 < 0.72) {
    return { kind: TILE_WATER, elev: 0 };
  }
  if (dist >= 3 || n > tuning.mountain - 0.1) {
    const elev = dist >= 6 || n > tuning.mountain ? 3 : n > tuning.mountain - 0.2 ? 2 : 1;
    return { kind: TILE_BLOCKED, elev: Math.max(1, elev) };
  }
  if (n2 > tuning.blockers) return { kind: TILE_BLOCKED, elev: dist >= 2 ? 2 : 1 };
  return { kind: TILE_CLEAR, elev: dist >= 2 ? 2 : 1 };
}

export type SceneryWorld = {
  seed?: number;
  biome: BiomeName;
  width: number;
  height: number;
  tiles: number[];
  heights: number[];
};

export function isMountainScenery(sample: ScenerySample): boolean {
  return sample.elev >= 3 || (sample.kind === TILE_BLOCKED && sample.elev >= 2);
}

export function featureEdgeMask(
  state: SceneryWorld,
  x: number,
  y: number,
): { bank: number; ridge: number } {
  const here = sceneryAt(state, x, y);
  const water = here.kind === TILE_WATER;
  const mountain = isMountainScenery(here);
  let bank = 0;
  let ridge = 0;
  if (!water && !mountain) return { bank, ridge };
  const dirs: [number, number, number][] = [
    [0, -1, 1],
    [1, 0, 2],
    [0, 1, 4],
    [-1, 0, 8],
  ];
  for (const [dx, dy, bit] of dirs) {
    const n = sceneryAt(state, x + dx, y + dy);
    if (water && n.kind !== TILE_WATER) bank |= bit;
    if (mountain && !isMountainScenery(n)) ridge |= bit;
  }
  return { bank, ridge };
}

export function sceneryAt(
  state: SceneryWorld,
  x: number,
  y: number,
): ScenerySample {
  if (x >= 0 && y >= 0 && x < state.width && y < state.height) {
    const i = idx(x, y, state.width);
    return { kind: state.tiles[i]!, elev: state.heights[i] ?? 1 };
  }
  const sample = skirtSample(state.seed ?? 0, state.biome, x, y, state.width, state.height);
  const cx = Math.max(0, Math.min(state.width - 1, x));
  const cy = Math.max(0, Math.min(state.height - 1, y));
  const edge = state.tiles[idx(cx, cy, state.width)];
  const dist = outsideDist(x, y, state.width, state.height);
  if (edge === TILE_WATER && dist <= 3) return { kind: TILE_WATER, elev: 0 };
  return sample;
}

export function describeMap(map: GeneratedMap): {
  width: number;
  height: number;
  water: number;
  resources: number;
  valley: number;
  plains: number;
  hills: number;
  mountain: number;
} {
  let water = 0;
  let resources = 0;
  let valley = 0;
  let plains = 0;
  let hills = 0;
  let mountain = 0;
  for (let i = 0; i < map.tiles.length; i++) {
    const t = map.tiles[i]!;
    if (t === TILE_WATER) water++;
    if (t === TILE_RESOURCE) resources++;
    const el = map.heights[i] ?? 1;
    if (el <= 0) valley++;
    else if (el === 1) plains++;
    else if (el === 2) hills++;
    else mountain++;
  }
  return { width: map.width, height: map.height, water, resources, valley, plains, hills, mountain };
}

export function winNeedsMarked(win: WinCategory): boolean {
  return win.kind === "destroyMarked";
}
