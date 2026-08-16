import { createRng, type Rng } from "../seed/rng";
import {
  TILE_CLEAR,
  TILE_RESOURCE,
  TILE_WATER,
  type MissionDef,
  type Vec2,
  type WinCategory,
} from "../types";

export type GeneratedMap = {
  width: number;
  height: number;
  tiles: number[];
  heights: number[];
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

function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
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

function carvePath(tiles: number[], heights: number[], w: number, h: number, a: Vec2, b: Vec2): void {
  let x = a.x;
  let y = a.y;
  while (x !== b.x || y !== b.y) {
    tiles[idx(x, y, w)] = TILE_CLEAR;
    heights[idx(x, y, w)] = 1;
    if (inBounds(x + 1, y, w, h)) {
      tiles[idx(x + 1, y, w)] = TILE_CLEAR;
      if (heights[idx(x + 1, y, w)]! > 1) heights[idx(x + 1, y, w)] = 1;
    }
    if (inBounds(x, y + 1, w, h)) {
      tiles[idx(x, y + 1, w)] = TILE_CLEAR;
      if (heights[idx(x, y + 1, w)]! > 1) heights[idx(x, y + 1, w)] = 1;
    }
    if (x < b.x) x++;
    else if (x > b.x) x--;
    else if (y < b.y) y++;
    else y--;
  }
  tiles[idx(b.x, b.y, w)] = TILE_CLEAR;
  heights[idx(b.x, b.y, w)] = 1;
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

function isNearWater(tiles: number[], x: number, y: number, w: number, h: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, w, h)) continue;
      if (tiles[idx(nx, ny, w)] === TILE_WATER) return true;
    }
  }
  return false;
}

function reachable(tiles: number[], w: number, h: number, start: Vec2, goal: Vec2): boolean {
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
      if (tiles[i] === TILE_WATER) continue;
      seen[i] = 1;
      q.push(n);
    }
  }
  return false;
}

export function mapSizeForMission(index: number): number {
  if (index <= 1) return 48;
  if (index <= 4) return 72;
  return 96;
}

export function generateMap(
  seed: number,
  mission: Pick<MissionDef, "index" | "win" | "mapSize">,
): GeneratedMap {
  const rng = createRng(seed, `map:${mission.index}`);
  const width = mission.mapSize;
  const height = mission.mapSize;
  const tiles = new Array<number>(width * height).fill(TILE_CLEAR);
  const heights = new Array<number>(width * height).fill(1);
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

  const harvestBoost = mission.win.kind === "harvestQuota" ? 0.08 : 0;
  const waterThresh = 0.3;
  const startClear = 8;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const n = fbm(x, y, salt);
      const distP = Math.hypot(x - playerStart.x, y - playerStart.y);
      const distE = Math.hypot(x - enemyStart.x, y - enemyStart.y);
      if (distP < startClear || distE < startClear) {
        tiles[i] = TILE_CLEAR;
        continue;
      }
      if (n < waterThresh) tiles[i] = TILE_WATER;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (tiles[i] === TILE_WATER) {
        heights[i] = 0;
        continue;
      }
      if (isNearWater(tiles, x, y, width, height)) {
        heights[i] = 0;
        continue;
      }
      const hn = fbm(x * 0.85, y * 0.85, salt + 91);
      if (hn > 0.74) heights[i] = 3;
      else if (hn > 0.54) heights[i] = 2;
      else heights[i] = 1;
    }
  }

  flattenArea(tiles, heights, width, height, playerStart.x, playerStart.y, startClear, 1);
  flattenArea(tiles, heights, width, height, enemyStart.x, enemyStart.y, startClear, 1);

  carvePath(tiles, heights, width, height, playerStart, enemyStart);
  if (!reachable(tiles, width, height, playerStart, enemyStart)) {
    carvePath(tiles, heights, width, height, playerStart, enemyStart);
  }

  const veinCount = 6 + mission.index + (harvestBoost ? 4 : 0);
  for (let v = 0; v < veinCount; v++) {
    let cx = rng.int(width);
    let cy = rng.int(height);
    for (let tries = 0; tries < 20; tries++) {
      cx = rng.int(width);
      cy = rng.int(height);
      const i = idx(cx, cy, width);
      if (tiles[i] !== TILE_WATER) break;
    }
    const radius = 2 + rng.int(3);
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!inBounds(x, y, width, height)) continue;
        if (Math.hypot(x - cx, y - cy) > radius) continue;
        const i = idx(x, y, width);
        if (tiles[i] === TILE_WATER) continue;
        tiles[i] = TILE_RESOURCE;
        resourceAmount[i] = 400 + rng.int(500);
      }
    }
  }

  const markedSpots: Vec2[] = [];
  const markCount =
    mission.win.kind === "destroyMarked" ? mission.win.targetCount ?? 1 : 0;
  for (let m = 0; m < markCount; m++) {
    markedSpots.push({
      x: Math.max(2, enemyStart.x - 4 - m * 3),
      y: Math.max(2, enemyStart.y - 6 + (m % 2) * 2),
    });
  }

  return {
    width,
    height,
    tiles,
    heights,
    resourceAmount,
    playerStart,
    enemyStart,
    markedSpots,
  };
}

function mixSalt(rng: Rng): number {
  return 1 + rng.int(1_000_000);
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
