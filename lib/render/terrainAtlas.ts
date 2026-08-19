import { MAP_SKIRT, sceneryAt, type SceneryWorld } from "../gen/map";
import { generateCampaignVisualProfile } from "../gen/visualProfile";
import { biomeArt, TERRAIN_ART } from "../gen/visualAssets";
import { mixSeed } from "../seed/rng";
import type { BiomeName, CampaignVisualProfile, SurfaceKind } from "../types";
import { SURFACE_CONCRETE, SURFACE_NONE, SURFACE_ROAD, TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";

export const ATLAS_CELL = 8;
export const TERRAIN_ATLAS_REV = "world-atlas-v2";
export const ORE_GLINT_RIDGE = 0.55;
const ORE_CELL_CLASS = 3;

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

export type OreVeinSample = {
  ridge: number;
  intensity: number;
};

export type OreVeinPeak = {
  fx: number;
  fy: number;
  intensity: number;
};

export type OreShardPose = {
  dx: number;
  dy: number;
  lean: number;
  rise: number;
  half: number;
  buried: number;
};

export type OreCrystalCluster = {
  fx: number;
  fy: number;
  intensity: number;
  shards: OreShardPose[];
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

type Rgb = { r: number; g: number; b: number };

type BiomeMaterials = {
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

const BIOME_MATERIALS: Record<BiomeName, BiomeMaterials> = {
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
    concrete: rgb(72, 80, 76),
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
    concrete: rgb(62, 88, 88),
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
    concrete: rgb(98, 72, 56),
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
    concrete: rgb(64, 80, 70),
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
    concrete: rgb(132, 118, 90),
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
    concrete: rgb(70, 92, 98),
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
    concrete: rgb(52, 68, 56),
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
    concrete: rgb(58, 52, 52),
    ore: rgb(196, 124, 48),
    blocked: rgb(48, 34, 34),
  },
};

let grainGeneration = 0;
const grainImages = new Map<string, HTMLImageElement>();
let atlasCache: TerrainAtlas | null = null;

function rgb(r: number, g: number, b: number): Rgb {
  return { r, g, b };
}

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
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

function hash2(x: number, y: number, salt: number): number {
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

function fbm(x: number, y: number, salt: number): number {
  return valueNoise(x, y, salt) * 0.55 + valueNoise(x * 2, y * 2, salt + 17) * 0.3 + valueNoise(x * 4, y * 4, salt + 31) * 0.15;
}

function artSalt(state: AtlasWorld): number {
  return mixSeed(state.seed, `terrain-art:${state.missionIndex ?? 0}`) || 1;
}

function inMap(state: AtlasWorld, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

function surfaceAt(state: AtlasWorld, x: number, y: number): SurfaceKind {
  if (!inMap(state, x, y)) return SURFACE_NONE;
  return state.surfaces[y * state.width + x] ?? SURFACE_NONE;
}

function resourceAt(state: AtlasWorld, x: number, y: number): number {
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

export function oreVeinAt(state: AtlasWorld, mapX: number, mapY: number): OreVeinSample {
  const x = Math.floor(mapX);
  const y = Math.floor(mapY);
  const amount = resourceAt(state, x, y);
  const salt = artSalt(state);
  const seam = fbm(mapX * 0.72, mapY * 0.28, salt + 91);
  const crack = fbm(mapX * 0.31, mapY * 0.64, salt + 140);
  const ridge = Math.max(
    Math.pow(1 - Math.abs(seam - 0.5) * 2, 2),
    Math.pow(1 - Math.abs(crack - 0.48) * 2, 3) * 0.65,
  );
  const richness = Math.min(1, Math.max(0, amount / 900));
  return { ridge, intensity: ridge * (0.28 + richness * 0.72) };
}

export const ORE_VEIN_PROBES: ReadonlyArray<readonly [number, number]> = [
  [0.28, 0.32],
  [0.62, 0.28],
  [0.38, 0.68],
  [0.72, 0.58],
];

export function oreVeinPeak(state: AtlasWorld, x: number, y: number): OreVeinPeak {
  let fx = 0.5;
  let fy = 0.5;
  let intensity = 0;
  for (const [px, py] of ORE_VEIN_PROBES) {
    const vein = oreVeinAt(state, x + px, y + py);
    if (vein.intensity > intensity) {
      intensity = vein.intensity;
      fx = px;
      fy = py;
    }
  }
  return { fx, fy, intensity };
}

export function oreShardCount(amount: number): number {
  if (amount > 700) return 9;
  if (amount > 380) return 7;
  return 5;
}

const ORE_SHARD_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0.22, 0.28],
  [0.50, 0.22],
  [0.78, 0.28],
  [0.28, 0.50],
  [0.50, 0.48],
  [0.72, 0.50],
  [0.22, 0.72],
  [0.50, 0.78],
  [0.78, 0.72],
];

export function oreCrystalCluster(state: AtlasWorld, x: number, y: number): OreCrystalCluster | null {
  const peak = oreVeinPeak(state, x, y);
  if (peak.intensity < ORE_GLINT_RIDGE) return null;
  const amount = resourceAt(state, x, y);
  const v = tileVariant(state.seed, x, y);
  const count = oreShardCount(amount);
  const start = v % ORE_SHARD_SLOTS.length;
  const shards: OreShardPose[] = [];
  for (let i = 0; i < count; i++) {
    const slot = ORE_SHARD_SLOTS[(start + i * 4) % ORE_SHARD_SLOTS.length]!;
    const jitterU = (((v >> (i * 3)) % 7) - 3) * 0.018;
    const jitterV = (((v >> (i * 5)) % 7) - 3) * 0.018;
    const u = Math.min(0.84, Math.max(0.16, slot[0] + jitterU));
    const vv = Math.min(0.84, Math.max(0.16, slot[1] + jitterV));
    const dx = (u - vv) * 32;
    const dy = (u + vv) * 16;
    const lean = ((u - 0.5) * 4.4) + (((v >> (i + 3)) % 5) - 2) * 0.35;
    const rise = 9 + ((v >> (i * 4)) % 4) + (i === 0 ? 2.4 : 0) + Math.min(2.5, amount / 360);
    const half = 8.4 + ((v >> (i + 6)) % 4) * 1.2 + (i === 0 ? 1.8 : 0);
    const buried = 5.2 + (i % 2) * 0.8;
    shards.push({ dx, dy, lean, rise, half, buried });
  }
  shards.sort((a, b) => a.dy - b.dy);
  return { fx: 0, fy: 0, intensity: peak.intensity, shards };
}

export function resourceSignature(amounts: number[]): number {
  let h = amounts.length;
  for (let i = 0; i < amounts.length; i++) h = (Math.imul(h, 33) + (amounts[i] ?? 0)) | 0;
  return h;
}

export function terrainAtlasKey(state: AtlasWorld): string {
  return `${TERRAIN_ATLAS_REV}:${state.seed}:${state.missionIndex ?? 0}:${state.biome}:${state.width}x${state.height}:${resourceSignature(state.resourceAmount)}:${grainGeneration}`;
}

export function terrainGrainGeneration(): number {
  return grainGeneration;
}

export function atlasRectForTile(x: number, y: number, mapWidth: number): { sx: number; sy: number; sw: number; sh: number } {
  return {
    sx: (x + MAP_SKIRT) * ATLAS_CELL,
    sy: (y + MAP_SKIRT) * ATLAS_CELL,
    sw: ATLAS_CELL,
    sh: ATLAS_CELL,
  };
}

const materialMemo = new Map<string, BiomeMaterials>();

function materialsFor(state: AtlasWorld): BiomeMaterials {
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
    const shore = waterNeighbor(state, x, y) && (
      sceneryAt(state, x + 1, y).kind !== TILE_WATER
      || sceneryAt(state, x - 1, y).kind !== TILE_WATER
      || sceneryAt(state, x, y + 1).kind !== TILE_WATER
      || sceneryAt(state, x, y - 1).kind !== TILE_WATER
    );
    color = shore ? mixRgb(mats.waterMid, mats.shore, 0.28) : mixRgb(mats.waterDeep, mats.waterMid, 0.35 + grain * 0.4);
    color = mixRgb(color, mats.waterHi, grain * 0.18);
  } else if (surface === SURFACE_CONCRETE) {
    color = mixRgb(mats.concrete, mats.dark, 0.18 + grain * 0.2);
    color = mixRgb(color, mats.light, micro * 0.12);
  } else if (surface === SURFACE_ROAD) {
    color = mixRgb(mats.road, mats.dark, 0.16 + grain * 0.22);
    color = mixRgb(color, mats.light, 0.06 + micro * 0.08);
  } else {
    const elev = scenery.elev;
    color = elev >= 3 ? mats.high : elev === 2 ? mixRgb(mats.mid, mats.high, 0.42) : elev <= 0 ? mats.low : mats.mid;
    if (waterNeighbor(state, x, y)) color = mixRgb(color, mats.shore, 0.34);
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

function atlasSize(state: AtlasWorld): { cols: number; rows: number; width: number; height: number } {
  const cols = state.width + MAP_SKIRT * 2;
  const rows = state.height + MAP_SKIRT * 2;
  return { cols, rows, width: cols * ATLAS_CELL, height: rows * ATLAS_CELL };
}

function cellColor(state: AtlasWorld, gx: number, gy: number): Rgb {
  const sample = sampleTerrainMaterial(state, gx, gy);
  return { r: sample.r, g: sample.g, b: sample.b };
}

function cellClass(state: AtlasWorld, x: number, y: number): number {
  const scenery = sceneryAt(state, x, y);
  if (scenery.kind === TILE_WATER) return 0;
  const surface = surfaceAt(state, x, y);
  if (surface === SURFACE_ROAD) return 1;
  if (surface === SURFACE_CONCRETE) return 2;
  if (scenery.kind === TILE_RESOURCE) return ORE_CELL_CLASS;
  return 4;
}

export function bakeTerrainAtlasData(state: AtlasWorld): TerrainAtlasData {
  const { cols, rows, width, height } = atlasSize(state);
  const colors = new Float32Array(cols * rows * 3);
  const classes = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gx = col - MAP_SKIRT;
      const gy = row - MAP_SKIRT;
      const color = cellColor(state, gx, gy);
      const i = (row * cols + col) * 3;
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
      classes[row * cols + col] = cellClass(state, gx, gy);
    }
  }

  const data = new Uint8ClampedArray(width * height * 4);
  const salt = artSalt(state);
  const mats = materialsFor(state);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gx = col - MAP_SKIRT;
      const gy = row - MAP_SKIRT;
      const i = (row * cols + col) * 3;
      const baseR = colors[i]!;
      const baseG = colors[i + 1]!;
      const baseB = colors[i + 2]!;
      const same = classes[row * cols + col]!;
      const blendE = col + 1 < cols && classes[row * cols + col + 1] === same;
      const blendS = row + 1 < rows && classes[(row + 1) * cols + col] === same;
      const eastR = blendE ? colors[i + 3]! : baseR;
      const eastG = blendE ? colors[i + 4]! : baseG;
      const eastB = blendE ? colors[i + 5]! : baseB;
      const southI = i + cols * 3;
      const southR = blendS ? colors[southI]! : baseR;
      const southG = blendS ? colors[southI + 1]! : baseG;
      const southB = blendS ? colors[southI + 2]! : baseB;
      for (let ly = 0; ly < ATLAS_CELL; ly++) {
        const fy = ly / ATLAS_CELL;
        const py = row * ATLAS_CELL + ly;
        for (let lx = 0; lx < ATLAS_CELL; lx++) {
          const fx = lx / ATLAS_CELL;
          let r = baseR + (eastR - baseR) * fx * 0.28 + (southR - baseR) * fy * 0.28;
          let g = baseG + (eastG - baseG) * fx * 0.28 + (southG - baseG) * fy * 0.28;
          let b = baseB + (eastB - baseB) * fx * 0.28 + (southB - baseB) * fy * 0.28;
          if (same === ORE_CELL_CLASS) {
            const vein = oreVeinAt(state, gx + (lx + 0.5) / ATLAS_CELL, gy + (ly + 0.5) / ATLAS_CELL);
            const metal = mixRgb(mats.ore, mats.light, 0.28 + vein.ridge * 0.45);
            const t = Math.min(1, vein.intensity);
            r += (metal.r - r) * t;
            g += (metal.g - g) * t;
            b += (metal.b - b) * t;
          }
          const px = col * ATLAS_CELL + lx;
          const grain = (hash2(px, py, salt) - 0.5) * 16;
          const o = (py * width + px) * 4;
          data[o] = clampByte(r + grain);
          data[o + 1] = clampByte(g + grain * 0.82);
          data[o + 2] = clampByte(b + grain * 0.7);
          data[o + 3] = 255;
        }
      }
    }
  }

  return {
    key: terrainAtlasKey(state),
    data,
    width,
    height,
    cell: ATLAS_CELL,
    mapWidth: state.width,
    mapHeight: state.height,
  };
}

export function atlasPixelAtTile(atlas: TerrainAtlasData, tileX: number, tileY: number): [number, number, number] {
  const rect = atlasRectForTile(tileX, tileY, atlas.mapWidth);
  const px = Math.min(atlas.width - 1, Math.max(0, rect.sx + (rect.sw >> 1)));
  const py = Math.min(atlas.height - 1, Math.max(0, rect.sy + (rect.sh >> 1)));
  const i = (py * atlas.width + px) * 4;
  return [atlas.data[i] ?? 0, atlas.data[i + 1] ?? 0, atlas.data[i + 2] ?? 0];
}

function requestGrain(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  const cached = grainImages.get(src);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    grainGeneration += 1;
    atlasCache = null;
  };
  img.src = src;
  grainImages.set(src, img);
  return null;
}

function overlayGrain(ctx: CanvasRenderingContext2D, state: AtlasWorld, width: number, height: number): void {
  const biomeImg = requestGrain(biomeArt(state.biome));
  const treatment = generateCampaignVisualProfile(state.seed).terrainTreatment;
  const plateImg = requestGrain(TERRAIN_ART[treatment]);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  if (biomeImg) {
    ctx.globalAlpha = 0.34;
    const tw = biomeImg.naturalWidth || biomeImg.width;
    const th = biomeImg.naturalHeight || biomeImg.height;
    for (let y = 0; y < height; y += th) {
      for (let x = 0; x < width; x += tw) ctx.drawImage(biomeImg, x, y, tw, th);
    }
  }
  if (plateImg) {
    ctx.globalAlpha = 0.18;
    const tw = plateImg.naturalWidth || plateImg.width;
    const th = plateImg.naturalHeight || plateImg.height;
    for (let y = 0; y < height; y += th) {
      for (let x = 0; x < width; x += tw) ctx.drawImage(plateImg, x, y, tw, th);
    }
  }
  ctx.restore();
}

export function invalidateTerrainAtlas(): void {
  atlasCache = null;
}

export function getTerrainAtlas(state: AtlasWorld): TerrainAtlas {
  const key = terrainAtlasKey(state);
  if (atlasCache && atlasCache.key === key) return atlasCache;
  const baked = bakeTerrainAtlasData(state);
  let canvas: HTMLCanvasElement | null = null;
  if (typeof document !== "undefined") {
    canvas = document.createElement("canvas");
    canvas.width = baked.width;
    canvas.height = baked.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const image = ctx.createImageData(baked.width, baked.height);
      image.data.set(baked.data);
      ctx.putImageData(image, 0, 0);
      overlayGrain(ctx, state, baked.width, baked.height);
    }
  }
  atlasCache = { ...baked, canvas };
  return atlasCache;
}

export function terrainColors(biome: BiomeName): {
  low: string;
  mid: string;
  high: string;
  water: string;
  road: string;
  concrete: string;
  blocked: string;
} {
  const mats = BIOME_MATERIALS[biome];
  const hex = (c: Rgb) => `#${[c.r, c.g, c.b].map((n) => clampByte(n).toString(16).padStart(2, "0")).join("")}`;
  return {
    low: hex(mats.low),
    mid: hex(mats.mid),
    high: hex(mats.high),
    water: hex(mats.waterDeep),
    road: hex(mats.road),
    concrete: hex(mats.concrete),
    blocked: hex(mats.blocked),
  };
}
