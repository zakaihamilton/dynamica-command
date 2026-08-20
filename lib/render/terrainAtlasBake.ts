import { MAP_SKIRT, sceneryAt } from "../gen/map";
import { SURFACE_CONCRETE, SURFACE_ROAD, TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";
import {
  ATLAS_CELL,
  CONCRETE_STEEL,
  CONCRETE_STEEL_DARK,
  CONCRETE_STEEL_LIGHT,
  TERRAIN_ATLAS_REV,
  artSalt,
  clampByte,
  fbm,
  hash2,
  materialsFor,
  mixRgb,
  resourceAt,
  scaleRgb,
  surfaceAt,
  type AtlasWorld,
  type BiomeMaterials,
  type Rgb,
  type TerrainSample,
} from "./terrainMaterials";
import { oreVeinAt } from "./terrainOre";

const WATER_CELL_CLASS = 0;
const ORE_CELL_CLASS = 3;
const CONCRETE_CELL_CLASS = 2;
const WATER_SHORE_MAX = 8;

export type TerrainAtlasData = {
  key: string;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  cell: number;
  mapWidth: number;
  mapHeight: number;
};

export function resourceSignature(amounts: number[]): number {
  let h = amounts.length;
  for (let i = 0; i < amounts.length; i++) h = (Math.imul(h, 33) + (amounts[i] ?? 0)) | 0;
  return h;
}

export function makeAtlasKey(state: AtlasWorld, grainGeneration: number): string {
  return `${TERRAIN_ATLAS_REV}:${state.seed}:${state.missionIndex ?? 0}:${state.biome}:${state.width}x${state.height}:${resourceSignature(state.resourceAmount)}:${grainGeneration}`;
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

function waterPixelDist(state: AtlasWorld, mapX: number, mapY: number, cellDist: number): number {
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

function tintWater(mats: BiomeMaterials, dist: number, mapX: number, mapY: number, salt: number): Rgb {
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

function bakeWaterShoreDist(state: AtlasWorld, cols: number, rows: number): Uint8Array {
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
  if (scenery.kind === TILE_WATER) return WATER_CELL_CLASS;
  const surface = surfaceAt(state, x, y);
  if (surface === SURFACE_ROAD) return 1;
  if (surface === SURFACE_CONCRETE) return CONCRETE_CELL_CLASS;
  if (scenery.kind === TILE_RESOURCE) return ORE_CELL_CLASS;
  return 4;
}

export function bakeTerrainAtlasData(state: AtlasWorld, grainGeneration = 0): TerrainAtlasData {
  const { cols, rows, width, height } = atlasSize(state);
  const colors = new Float32Array(cols * rows * 3);
  const classes = new Uint8Array(cols * rows);
  const shoreDist = bakeWaterShoreDist(state, cols, rows);
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
      const canBlend = same !== CONCRETE_CELL_CLASS && same !== WATER_CELL_CLASS;
      const blendE = canBlend && col + 1 < cols && classes[row * cols + col + 1] === same;
      const blendS = canBlend && row + 1 < rows && classes[(row + 1) * cols + col] === same;
      const eastR = blendE ? colors[i + 3]! : baseR;
      const eastG = blendE ? colors[i + 4]! : baseG;
      const eastB = blendE ? colors[i + 5]! : baseB;
      const southI = i + cols * 3;
      const southR = blendS ? colors[southI]! : baseR;
      const southG = blendS ? colors[southI + 1]! : baseG;
      const southB = blendS ? colors[southI + 2]! : baseB;
      const cellDist = shoreDist[row * cols + col] ?? WATER_SHORE_MAX;
      for (let ly = 0; ly < ATLAS_CELL; ly++) {
        const fy = ly / ATLAS_CELL;
        const py = row * ATLAS_CELL + ly;
        for (let lx = 0; lx < ATLAS_CELL; lx++) {
          const fx = lx / ATLAS_CELL;
          let r: number;
          let g: number;
          let b: number;
          if (same === WATER_CELL_CLASS) {
            const mapX = gx + (lx + 0.5) / ATLAS_CELL;
            const mapY = gy + (ly + 0.5) / ATLAS_CELL;
            const wet = tintWater(mats, waterPixelDist(state, mapX, mapY, cellDist), mapX, mapY, salt);
            r = wet.r;
            g = wet.g;
            b = wet.b;
          } else {
            r = baseR + (eastR - baseR) * fx * 0.28 + (southR - baseR) * fy * 0.28;
            g = baseG + (eastG - baseG) * fx * 0.28 + (southG - baseG) * fy * 0.28;
            b = baseB + (eastB - baseB) * fx * 0.28 + (southB - baseB) * fy * 0.28;
          }
          if (same === ORE_CELL_CLASS) {
            const vein = oreVeinAt(state, gx + (lx + 0.5) / ATLAS_CELL, gy + (ly + 0.5) / ATLAS_CELL);
            const metal = mixRgb(mats.ore, mats.light, 0.28 + vein.ridge * 0.45);
            const t = Math.min(1, vein.intensity);
            r += (metal.r - r) * t;
            g += (metal.g - g) * t;
            b += (metal.b - b) * t;
          }
          if (same === CONCRETE_CELL_CLASS) {
            const edge = lx === 0 || ly === 0 || lx === ATLAS_CELL - 1 || ly === ATLAS_CELL - 1;
            if (edge) {
              const t = 0.42;
              r += (CONCRETE_STEEL_DARK.r - r) * t;
              g += (CONCRETE_STEEL_DARK.g - g) * t;
              b += (CONCRETE_STEEL_DARK.b - b) * t;
            }
          }
          const px = col * ATLAS_CELL + lx;
          const grainScale = same === CONCRETE_CELL_CLASS ? 5 : same === WATER_CELL_CLASS ? 6 : 16;
          const grain = (hash2(px, py, salt) - 0.5) * grainScale;
          const o = (py * width + px) * 4;
          if (same === WATER_CELL_CLASS) {
            data[o] = clampByte(r + grain * 0.35);
            data[o + 1] = clampByte(g + grain * 0.7);
            data[o + 2] = clampByte(b + grain);
          } else {
            data[o] = clampByte(r + grain);
            data[o + 1] = clampByte(g + grain * 0.82);
            data[o + 2] = clampByte(b + grain * 0.7);
          }
          data[o + 3] = 255;
        }
      }
    }
  }

  return {
    key: makeAtlasKey(state, grainGeneration),
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
