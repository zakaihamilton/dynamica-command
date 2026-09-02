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

/**
 * The atlas only needs rebuilding when a tile's visual class changes. Ore
 * quantity is intentionally excluded: its changing richness is painted by the
 * dynamic crystal and glint layers, while an exhausted tile changes class from
 * resource to ground.
 */
export function terrainLayoutSignature(tiles: number[], surfaces: number[]): number {
  let h = tiles.length;
  for (let i = 0; i < tiles.length; i++) h = (Math.imul(h, 33) + (tiles[i] ?? 0)) | 0;
  h = (Math.imul(h, 33) + surfaces.length) | 0;
  for (let i = 0; i < surfaces.length; i++) h = (Math.imul(h, 33) + (surfaces[i] ?? 0)) | 0;
  return h;
}

export function makeAtlasKey(state: AtlasWorld, grainGeneration: number): string {
  return `${TERRAIN_ATLAS_REV}:${state.seed}:${state.missionIndex ?? 0}:${state.biome}:${state.width}x${state.height}:${terrainLayoutSignature(state.tiles, state.surfaces)}:${grainGeneration}`;
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clampShore(dist: number): number {
  return dist > WATER_SHORE_MAX ? WATER_SHORE_MAX : dist;
}

function readShoreCell(
  shoreDist: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  fallback: number,
): number {
  if (col < 0 || row < 0 || col >= cols || row >= rows) return clampShore(fallback);
  return clampShore(shoreDist[row * cols + col] ?? fallback);
}

function landEdgeDistFromMask(fx: number, fy: number, mask: number): number {
  let dist = WATER_SHORE_MAX;
  if ((mask & 2) === 0) dist = Math.min(dist, 1 - fx);
  if ((mask & 8) === 0) dist = Math.min(dist, fx);
  if ((mask & 4) === 0) dist = Math.min(dist, 1 - fy);
  if ((mask & 1) === 0) dist = Math.min(dist, fy);
  if ((mask & 128) === 0) dist = Math.min(dist, Math.hypot(1 - fx, 1 - fy));
  if ((mask & 64) === 0) dist = Math.min(dist, Math.hypot(fx, fy));
  if ((mask & 16) === 0) dist = Math.min(dist, Math.hypot(1 - fx, fy));
  if ((mask & 32) === 0) dist = Math.min(dist, Math.hypot(fx, 1 - fy));
  return dist;
}

function bilinearFromNeighborhood(
  fx: number,
  fy: number,
  n00: number,
  n10: number,
  n20: number,
  n01: number,
  n11: number,
  n21: number,
  n02: number,
  n12: number,
  n22: number,
): number {
  const west = fx < 0.5;
  const north = fy < 0.5;
  const tx = west ? fx + 0.5 : fx - 0.5;
  const ty = north ? fy + 0.5 : fy - 0.5;
  const a = north ? (west ? n00 : n10) : (west ? n01 : n11);
  const b = north ? (west ? n10 : n20) : (west ? n11 : n21);
  const c = north ? (west ? n01 : n11) : (west ? n02 : n12);
  const d = north ? (west ? n11 : n21) : (west ? n12 : n22);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function landEdgeDistFromScenery(state: AtlasWorld, x: number, y: number, fx: number, fy: number): number {
  let dist = WATER_SHORE_MAX;
  if (sceneryAt(state, x + 1, y).kind !== TILE_WATER) dist = Math.min(dist, 1 - fx);
  if (sceneryAt(state, x - 1, y).kind !== TILE_WATER) dist = Math.min(dist, fx);
  if (sceneryAt(state, x, y + 1).kind !== TILE_WATER) dist = Math.min(dist, 1 - fy);
  if (sceneryAt(state, x, y - 1).kind !== TILE_WATER) dist = Math.min(dist, fy);
  if (sceneryAt(state, x + 1, y + 1).kind !== TILE_WATER) dist = Math.min(dist, Math.hypot(1 - fx, 1 - fy));
  if (sceneryAt(state, x - 1, y - 1).kind !== TILE_WATER) dist = Math.min(dist, Math.hypot(fx, fy));
  if (sceneryAt(state, x + 1, y - 1).kind !== TILE_WATER) dist = Math.min(dist, Math.hypot(1 - fx, fy));
  if (sceneryAt(state, x - 1, y + 1).kind !== TILE_WATER) dist = Math.min(dist, Math.hypot(fx, 1 - fy));
  return dist;
}

function waterPixelDist(state: AtlasWorld, mapX: number, mapY: number): number {
  const x = Math.floor(mapX);
  const y = Math.floor(mapY);
  const fx = mapX - x;
  const fy = mapY - y;
  const sx = fx < 0.5 ? x - 1 : x;
  const sy = fy < 0.5 ? y - 1 : y;
  const tx = fx < 0.5 ? fx + 0.5 : fx - 0.5;
  const ty = fy < 0.5 ? fy + 0.5 : fy - 0.5;
  const field = lerp(
    lerp(waterShoreDist(state, sx, sy), waterShoreDist(state, sx + 1, sy), tx),
    lerp(waterShoreDist(state, sx, sy + 1), waterShoreDist(state, sx + 1, sy + 1), tx),
    ty,
  );
  return Math.min(field, landEdgeDistFromScenery(state, x, y, fx, fy));
}

function tintWater(mats: BiomeMaterials, dist: number, mapX: number, mapY: number, salt: number): Rgb {
  const wet = fbm(mapX * 0.42, mapY * 0.28, salt + 73);
  const current = fbm(mapX * 0.16 + mapY * 0.09, mapY * 0.2, salt + 101);
  const warpedDist = Math.max(0, dist + (wet - 0.5) * 0.75);
  const depthT = Math.min(1, Math.max(0, (warpedDist - 0.4) / 3.4));
  let color = mixRgb(mats.waterMid, mats.waterDeep, 0.18 + depthT * 0.82);
  color = mixRgb(color, mats.waterDeep, current * 0.12 * depthT);
  color = mixRgb(color, mats.waterHi, wet * 0.16 * (0.35 + depthT * 0.5));
  const streak = Math.max(0, 1 - Math.abs(current - 0.5) * 3.2);
  color = mixRgb(color, mats.waterHi, streak * streak * 0.16);
  if (warpedDist < 1.15) color = mixRgb(color, mats.waterHi, (1.15 - warpedDist) * 0.28);
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

type AtlasSceneryGrid = {
  cols: number;
  rows: number;
  kind: Uint8Array;
  waterNeighbors: Uint8Array;
};

function bakeAtlasSceneryGrid(state: AtlasWorld, cols: number, rows: number): AtlasSceneryGrid {
  // Include one extra cell around the atlas so every immediate neighbor lookup
  // used by pixel shading stays on the fast cached path.
  const cachedCols = cols + 2;
  const cachedRows = rows + 2;
  const kind = new Uint8Array(cachedCols * cachedRows);
  for (let row = 0; row < cachedRows; row++) {
    for (let col = 0; col < cachedCols; col++) {
      const sample = sceneryAt(state, col - MAP_SKIRT - 1, row - MAP_SKIRT - 1);
      kind[row * cachedCols + col] = sample.kind;
    }
  }

  const waterNeighbors = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const center = (row + 1) * cachedCols + col + 1;
      let mask = 0;
      if (kind[center - cachedCols] === TILE_WATER) mask |= 1;
      if (kind[center + 1] === TILE_WATER) mask |= 2;
      if (kind[center + cachedCols] === TILE_WATER) mask |= 4;
      if (kind[center - 1] === TILE_WATER) mask |= 8;
      if (kind[center - cachedCols + 1] === TILE_WATER) mask |= 16;
      if (kind[center + cachedCols - 1] === TILE_WATER) mask |= 32;
      if (kind[center - cachedCols - 1] === TILE_WATER) mask |= 64;
      if (kind[center + cachedCols + 1] === TILE_WATER) mask |= 128;
      waterNeighbors[row * cols + col] = mask;
    }
  }
  return { cols, rows, kind, waterNeighbors };
}

function atlasKindAt(grid: AtlasSceneryGrid, col: number, row: number): number {
  return grid.kind[(row + 1) * (grid.cols + 2) + col + 1] ?? TILE_BLOCKED;
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
    const dist = waterPixelDist(state, mapX, mapY);
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
      color = mixRgb(color, mats.dark, 0.28);
      color = mixRgb(color, mats.ore, 0.22);
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

export function bakeTerrainAtlasData(state: AtlasWorld, grainGeneration = 0): TerrainAtlasData {
  const { cols, rows, width, height } = atlasSize(state);
  const colors = new Float32Array(cols * rows * 3);
  const classes = new Uint8Array(cols * rows);
  const shoreDist = bakeWaterShoreDist(state, cols, rows);
  const sceneryGrid = bakeAtlasSceneryGrid(state, cols, rows);
  const salt = artSalt(state);
  const mats = materialsFor(state);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gx = col - MAP_SKIRT;
      const gy = row - MAP_SKIRT;
      const kind = atlasKindAt(sceneryGrid, col, row);
      const color = kind === TILE_WATER ? { r: 0, g: 0, b: 0 } : cellColor(state, gx, gy);
      const i = (row * cols + col) * 3;
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
      const surface = surfaceAt(state, gx, gy);
      classes[row * cols + col] = kind === TILE_WATER
        ? WATER_CELL_CLASS
        : surface === SURFACE_ROAD
          ? 1
          : surface === SURFACE_CONCRETE
            ? CONCRETE_CELL_CLASS
            : kind === TILE_RESOURCE
              ? ORE_CELL_CLASS
              : 4;
    }
  }

  const data = new Uint8ClampedArray(width * height * 4);
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
      const cellDist = clampShore(shoreDist[row * cols + col] ?? WATER_SHORE_MAX);
      const resourceAmount = same === ORE_CELL_CLASS ? resourceAt(state, gx, gy) : 0;
      const waterMask = same === WATER_CELL_CLASS ? sceneryGrid.waterNeighbors[row * cols + col] ?? 0 : 0;
      const n00 = same === WATER_CELL_CLASS ? readShoreCell(shoreDist, cols, rows, col - 1, row - 1, cellDist) : 0;
      const n10 = same === WATER_CELL_CLASS ? readShoreCell(shoreDist, cols, rows, col, row - 1, cellDist) : 0;
      const n20 = same === WATER_CELL_CLASS ? readShoreCell(shoreDist, cols, rows, col + 1, row - 1, cellDist) : 0;
      const n01 = same === WATER_CELL_CLASS ? readShoreCell(shoreDist, cols, rows, col - 1, row, cellDist) : 0;
      const n21 = same === WATER_CELL_CLASS ? readShoreCell(shoreDist, cols, rows, col + 1, row, cellDist) : 0;
      const n02 = same === WATER_CELL_CLASS ? readShoreCell(shoreDist, cols, rows, col - 1, row + 1, cellDist) : 0;
      const n12 = same === WATER_CELL_CLASS ? readShoreCell(shoreDist, cols, rows, col, row + 1, cellDist) : 0;
      const n22 = same === WATER_CELL_CLASS ? readShoreCell(shoreDist, cols, rows, col + 1, row + 1, cellDist) : 0;
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
            const pxFx = (lx + 0.5) / ATLAS_CELL;
            const pxFy = (ly + 0.5) / ATLAS_CELL;
            const wet = tintWater(
              mats,
              Math.min(
                bilinearFromNeighborhood(pxFx, pxFy, n00, n10, n20, n01, cellDist, n21, n02, n12, n22),
                landEdgeDistFromMask(pxFx, pxFy, waterMask),
              ),
              mapX,
              mapY,
              salt,
            );
            r = wet.r;
            g = wet.g;
            b = wet.b;
          } else {
            r = baseR + (eastR - baseR) * fx * 0.28 + (southR - baseR) * fy * 0.28;
            g = baseG + (eastG - baseG) * fx * 0.28 + (southG - baseG) * fy * 0.28;
            b = baseB + (eastB - baseB) * fx * 0.28 + (southB - baseB) * fy * 0.28;
          }
          if (same === ORE_CELL_CLASS) {
            const vein = oreVeinAt(
              state,
              gx + (lx + 0.5) / ATLAS_CELL,
              gy + (ly + 0.5) / ATLAS_CELL,
              { salt, amount: resourceAmount },
            );
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
          const grainScale = same === CONCRETE_CELL_CLASS ? 5 : same === WATER_CELL_CLASS ? 3 : 16;
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
