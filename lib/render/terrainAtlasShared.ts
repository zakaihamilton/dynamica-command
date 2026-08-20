import { MAP_SKIRT, sceneryAt, type SceneryWorld } from "../gen/map";
import { generateCampaignVisualProfile } from "../gen/visualProfile";
import { mixSeed } from "../seed/rng";
import type { BiomeName, CampaignVisualProfile, SurfaceKind } from "../types";
import { SURFACE_CONCRETE, SURFACE_NONE, SURFACE_ROAD, TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";

export const ATLAS_CELL = 8;
export const TERRAIN_ATLAS_REV = "world-atlas-v6";
export const ORE_GLINT_RIDGE = 0.55;
export const ORE_CRYSTAL_MIN_AMOUNT = 50;
export const CONCRETE_STEEL = { r: 89, g: 104, b: 117 };
export const CONCRETE_STEEL_LIGHT = { r: 154, g: 171, b: 186 };
export const CONCRETE_STEEL_DARK = { r: 38, g: 50, b: 61 };
export const WATER_CELL_CLASS = 0;
export const ORE_CELL_CLASS = 3;
export const CONCRETE_CELL_CLASS = 2;
export const WATER_SHORE_MAX = 8;

export type AtlasWorld = SceneryWorld & {
  seed: number;
  missionIndex?: number;
  surfaces: SurfaceKind[];
  resourceAmount: number[];
};

export type TerrainSample = {
  r: number;
  g: number;
  b: number;
  water: boolean;
  ore: boolean;
  elev: number;
};

export type TerrainAtlasData = {
  key: string;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  cell: number;
  mapWidth: number;
  mapHeight: number;
};

export type TerrainAtlas = TerrainAtlasData & {
  canvas: HTMLCanvasElement | null;
};

export type Rgb = { r: number; g: number; b: number };

export type BiomeMaterials = {
  low: Rgb;
  mid: Rgb;
  high: Rgb;
  light: Rgb;
  dark: Rgb;
  waterDeep: Rgb;
  waterMid: Rgb;
  waterHi: Rgb;
  shore: Rgb;
  road: Rgb;
  concrete: Rgb;
  ore: Rgb;
  blocked: Rgb;
};

export const BIOME_MATERIALS: Record<BiomeName, BiomeMaterials> = {
  "ash plains": {
    low: rgb(46, 58, 52),
    mid: rgb(78, 96, 82),
    high: rgb(118, 132, 112),
    light: rgb(154, 168, 148),
    dark: rgb(28, 36, 32),
    waterDeep: rgb(18, 58, 82),
    waterMid: rgb(32, 104, 126),
    waterHi: rgb(122, 176, 178),
    shore: rgb(138, 128, 96),
    road: rgb(86, 74, 58),
    concrete: rgb(89, 104, 117),
    ore: rgb(168, 132, 52),
    blocked: rgb(42, 50, 44),
  },
  "crystal flats": {
    low: rgb(36, 64, 66),
    mid: rgb(68, 112, 108),
    high: rgb(126, 176, 168),
    light: rgb(168, 214, 204),
    dark: rgb(22, 42, 46),
    waterDeep: rgb(24, 62, 70),
    waterMid: rgb(42, 112, 118),
    waterHi: rgb(150, 214, 208),
    shore: rgb(118, 148, 142),
    road: rgb(70, 88, 86),
    concrete: rgb(89, 104, 117),
    ore: rgb(176, 196, 92),
    blocked: rgb(40, 66, 64),
  },
  "rust canyons": {
    low: rgb(72, 42, 32),
    mid: rgb(126, 78, 52),
    high: rgb(176, 118, 74),
    light: rgb(210, 160, 108),
    dark: rgb(42, 24, 20),
    waterDeep: rgb(28, 58, 64),
    waterMid: rgb(48, 90, 92),
    waterHi: rgb(132, 176, 168),
    shore: rgb(156, 118, 78),
    road: rgb(96, 62, 44),
    concrete: rgb(89, 104, 117),
    ore: rgb(196, 132, 48),
    blocked: rgb(64, 38, 30),
  },
  "salt marshes": {
    low: rgb(40, 58, 48),
    mid: rgb(72, 102, 82),
    high: rgb(118, 142, 108),
    light: rgb(156, 176, 132),
    dark: rgb(24, 38, 32),
    waterDeep: rgb(24, 52, 46),
    waterMid: rgb(42, 90, 72),
    waterHi: rgb(132, 186, 158),
    shore: rgb(122, 122, 80),
    road: rgb(74, 70, 52),
    concrete: rgb(89, 104, 117),
    ore: rgb(168, 148, 64),
    blocked: rgb(38, 54, 42),
  },
  "glass desert": {
    low: rgb(92, 74, 50),
    mid: rgb(148, 118, 78),
    high: rgb(196, 164, 112),
    light: rgb(226, 206, 154),
    dark: rgb(54, 42, 30),
    waterDeep: rgb(32, 74, 76),
    waterMid: rgb(52, 122, 118),
    waterHi: rgb(150, 214, 200),
    shore: rgb(196, 176, 124),
    road: rgb(118, 96, 68),
    concrete: rgb(89, 104, 117),
    ore: rgb(196, 160, 64),
    blocked: rgb(86, 70, 48),
  },
  "tundra grid": {
    low: rgb(52, 72, 78),
    mid: rgb(86, 116, 120),
    high: rgb(148, 176, 176),
    light: rgb(198, 220, 218),
    dark: rgb(28, 42, 48),
    waterDeep: rgb(32, 64, 78),
    waterMid: rgb(58, 112, 128),
    waterHi: rgb(176, 216, 222),
    shore: rgb(148, 160, 156),
    road: rgb(68, 88, 94),
    concrete: rgb(89, 104, 117),
    ore: rgb(176, 168, 84),
    blocked: rgb(48, 64, 70),
  },
  "jungle wreckage": {
    low: rgb(28, 50, 34),
    mid: rgb(52, 92, 58),
    high: rgb(92, 132, 78),
    light: rgb(132, 168, 102),
    dark: rgb(16, 32, 22),
    waterDeep: rgb(20, 50, 44),
    waterMid: rgb(36, 86, 68),
    waterHi: rgb(118, 186, 154),
    shore: rgb(92, 86, 52),
    road: rgb(62, 54, 38),
    concrete: rgb(89, 104, 117),
    ore: rgb(168, 148, 48),
    blocked: rgb(30, 48, 32),
  },
  "volcanic shelf": {
    low: rgb(52, 38, 38),
    mid: rgb(88, 62, 58),
    high: rgb(132, 96, 88),
    light: rgb(176, 132, 112),
    dark: rgb(28, 20, 22),
    waterDeep: rgb(22, 36, 44),
    waterMid: rgb(40, 60, 70),
    waterHi: rgb(128, 156, 158),
    shore: rgb(102, 86, 70),
    road: rgb(78, 50, 44),
    concrete: rgb(89, 104, 117),
    ore: rgb(196, 124, 48),
    blocked: rgb(48, 34, 34),
  },
};

function rgb(r: number, g: number, b: number): Rgb {
  return { r, g, b };
}

export function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: a.r + (b.r - a.r) * u,
    g: a.g + (b.g - a.g) * u,
    b: a.b + (b.b - a.b) * u,
  };
}

function scaleRgb(color: Rgb, amount: number): Rgb {
  return { r: color.r * amount, g: color.g * amount, b: color.b * amount };
}

export function hash2(x: number, y: number, salt: number): number {
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
  const v00 = hash2(x0, y0, salt);
  const v10 = hash2(x0 + 1, y0, salt);
  const v01 = hash2(x0, y0 + 1, salt);
  const v11 = hash2(x0 + 1, y0 + 1, salt);
  return v00 + (v10 - v00) * fx + (v01 + (v11 - v01) * fx - (v00 + (v10 - v00) * fx)) * fy;
}

export function fbm(x: number, y: number, salt: number): number {
  return valueNoise(x, y, salt) * 0.55 + valueNoise(x * 2, y * 2, salt + 17) * 0.3 + valueNoise(x * 4, y * 4, salt + 31) * 0.15;
}

export function artSalt(state: AtlasWorld): number {
  return mixSeed(state.seed, `terrain-art:${state.missionIndex ?? 0}`) || 1;
}

function inMap(state: AtlasWorld, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function surfaceAt(state: AtlasWorld, x: number, y: number): SurfaceKind {
  if (!inMap(state, x, y)) return SURFACE_NONE;
  return state.surfaces[y * state.width + x] ?? SURFACE_NONE;
}

export function resourceAt(state: AtlasWorld, x: number, y: number): number {
  if (!inMap(state, x, y)) return 0;
  return state.resourceAmount[y * state.width + x] ?? 0;
}

function campaignTint(profile: CampaignVisualProfile): Rgb {
  if (profile.terrainAccent === "amber") return rgb(231, 174, 99);
  if (profile.terrainAccent === "red") return rgb(216, 120, 104);
  return rgb(121, 213, 223);
}

export function biomeMaterials(biome: BiomeName): BiomeMaterials {
  return BIOME_MATERIALS[biome];
}

export function fogTerrainGain(fog: number): number {
  if (fog >= 2) return 1;
  if (fog === 1) return 0.55;
  return 0.15;
}

export function tileVariant(seed: number, x: number, y: number): number {
  return ((seed * 83492791) ^ (x * 73856093) ^ (y * 19349663)) >>> 0;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function atlasRectForTile(x: number, y: number, _mapWidth: number): { sx: number; sy: number; sw: number; sh: number } {
  return {
    sx: (x + MAP_SKIRT) * ATLAS_CELL,
    sy: (y + MAP_SKIRT) * ATLAS_CELL,
    sw: ATLAS_CELL,
    sh: ATLAS_CELL,
  };
}

const materialMemo = new Map<string, BiomeMaterials>();

export function materialsFor(state: AtlasWorld): BiomeMaterials {
  const key = `${state.seed}:${state.biome}`;
  const cached = materialMemo.get(key);
  if (cached) return cached;
  const base = BIOME_MATERIALS[state.biome];
  const tint = campaignTint(generateCampaignVisualProfile(state.seed));
  const amount = 0.08;
  const mats = {
    ...base,
    light: mixRgb(base.light, tint, amount),
    mid: mixRgb(base.mid, tint, amount * 0.45),
    waterHi: mixRgb(base.waterHi, tint, amount * 0.5),
  };
  materialMemo.set(key, mats);
  return mats;
}

function waterNeighbor(state: AtlasWorld, x: number, y: number): boolean {
  return sceneryAt(state, x, y).kind === TILE_WATER
    || sceneryAt(state, x + 1, y).kind === TILE_WATER
    || sceneryAt(state, x - 1, y).kind === TILE_WATER
    || sceneryAt(state, x, y + 1).kind === TILE_WATER
    || sceneryAt(state, x, y - 1).kind === TILE_WATER;
}

export function waterShoreDist(state: AtlasWorld, x: number, y: number): number {
  if (sceneryAt(state, x, y).kind !== TILE_WATER) return 0;
  for (let d = 1; d <= WATER_SHORE_MAX; d++) {
    for (let oy = -d; oy <= d; oy++) {
      for (let ox = -d; ox <= d; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== d) continue;
        if (sceneryAt(state, x + ox, y + oy).kind !== TILE_WATER) return d;
      }
    }
  }
  return WATER_SHORE_MAX;
}

export function waterPixelDist(state: AtlasWorld, mapX: number, mapY: number, cellDist: number): number {
  const x = Math.floor(mapX);
  const y = Math.floor(mapY);
  const fx = mapX - x;
  const fy = mapY - y;
  let dist = cellDist;
  if (sceneryAt(state, x + 1, y).kind !== TILE_WATER) dist = Math.min(dist, 1 - fx);
  if (sceneryAt(state, x - 1, y).kind !== TILE_WATER) dist = Math.min(dist, fx);
  if (sceneryAt(state, x, y + 1).kind !== TILE_WATER) dist = Math.min(dist, 1 - fy);
  if (sceneryAt(state, x, y - 1).kind !== TILE_WATER) dist = Math.min(dist, fy);
  if (sceneryAt(state, x + 1, y + 1).kind !== TILE_WATER) dist = Math.min(dist, Math.max(1 - fx, 1 - fy));
  if (sceneryAt(state, x - 1, y - 1).kind !== TILE_WATER) dist = Math.min(dist, Math.max(fx, fy));
  if (sceneryAt(state, x + 1, y - 1).kind !== TILE_WATER) dist = Math.min(dist, Math.max(1 - fx, fy));
  if (sceneryAt(state, x - 1, y + 1).kind !== TILE_WATER) dist = Math.min(dist, Math.max(fx, 1 - fy));
  return dist;
}

export function tintWater(mats: BiomeMaterials, dist: number, mapX: number, mapY: number, salt: number): Rgb {
  const wet = fbm(mapX * 0.85, mapY * 0.55, salt + 73);
  const current = fbm(mapX * 0.28 + mapY * 0.16, mapY * 0.34, salt + 101);
  const depthT = Math.min(1, Math.max(0, (dist - 0.4) / 3.4));
  let color = mixRgb(mats.waterMid, mats.waterDeep, 0.22 + depthT * 0.78);
  color = mixRgb(color, mats.waterHi, wet * 0.12 * (0.4 + depthT * 0.45));
  const streak = Math.max(0, 1 - Math.abs(current - 0.48) * 3.6);
  color = mixRgb(color, mats.waterHi, streak * streak * 0.11);
  if (dist < 1.1) color = mixRgb(color, mats.waterHi, (1.1 - dist) * 0.26);
  return color;
}

export function bakeWaterShoreDist(state: AtlasWorld, cols: number, rows: number): Uint8Array {
  const dist = new Uint8Array(cols * rows);
  dist.fill(255);
  const queue: number[] = [];
  let head = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gx = col - MAP_SKIRT;
      const gy = row - MAP_SKIRT;
      if (sceneryAt(state, gx, gy).kind === TILE_WATER) continue;
      const i = row * cols + col;
      dist[i] = 0;
      queue.push(i);
    }
  }
  while (head < queue.length) {
    const i = queue[head++]!;
    const d = dist[i]!;
    const col = i % cols;
    const row = (i / cols) | 0;
    const nd = d + 1;
    if (nd > WATER_SHORE_MAX) continue;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nc = col + dx;
        const nr = row + dy;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        if (nd >= dist[ni]!) continue;
        dist[ni] = nd;
        queue.push(ni);
      }
    }
  }
  return dist;
}

export function sampleTerrainMaterial(state: AtlasWorld, mapX: number, mapY: number): TerrainSample {
  const x = Math.floor(mapX);
  const y = Math.floor(mapY);
  const scenery = sceneryAt(state, x, y);
  const mats = materialsFor(state);
  const salt = artSalt(state);
  const grain = fbm(mapX * 0.45, mapY * 0.45, salt);
  const micro = hash2(x * 13, y * 17, salt);
  const surface = surfaceAt(state, x, y);
  const ore = scenery.kind === TILE_RESOURCE || resourceAt(state, x, y) > 0;
  const water = scenery.kind === TILE_WATER;
  let color: Rgb;
  if (water) {
    const dist = waterPixelDist(state, mapX, mapY, waterShoreDist(state, x, y));
    color = tintWater(mats, dist, mapX, mapY, salt);
  } else if (surface === SURFACE_CONCRETE) {
    color = mixRgb(CONCRETE_STEEL, CONCRETE_STEEL_DARK, 0.05 + micro * 0.08);
    color = mixRgb(color, CONCRETE_STEEL_LIGHT, 0.04 + hash2(x, y, salt) * 0.05);
  } else if (surface === SURFACE_ROAD) {
    color = mixRgb(mats.road, mats.dark, 0.16 + grain * 0.22);
    color = mixRgb(color, mats.light, 0.06 + micro * 0.08);
  } else {
    const elev = scenery.elev;
    color = elev >= 3 ? mats.high : elev === 2 ? mixRgb(mats.mid, mats.high, 0.42) : elev <= 0 ? mats.low : mats.mid;
    if (waterNeighbor(state, x, y)) color = mixRgb(color, mats.shore, 0.4);
    if (ore) {
      const richness = Math.min(1, resourceAt(state, x, y) / 900);
      color = mixRgb(color, mats.dark, 0.2 + richness * 0.08);
      color = mixRgb(color, mats.ore, 0.12 + richness * 0.1);
    }
    if (scenery.kind === TILE_BLOCKED) color = mixRgb(color, mats.blocked, 0.55);
    const east = sceneryAt(state, x + 1, y).elev;
    const south = sceneryAt(state, x, y + 1).elev;
    const slope = (scenery.elev - east) * 0.08 + (scenery.elev - south) * 0.12;
    color = scaleRgb(color, 0.86 + scenery.elev * 0.06 + slope + (grain - 0.5) * 0.16);
  }
  return {
    r: clampByte(color.r),
    g: clampByte(color.g),
    b: clampByte(color.b),
    water,
    ore,
    elev: scenery.elev,
  };
}
