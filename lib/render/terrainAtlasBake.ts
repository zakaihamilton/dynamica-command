import { MAP_SKIRT, sceneryAt } from "../gen/map";
import { generateCampaignVisualProfile } from "../gen/visualProfile";
import { biomeArt, TERRAIN_ART } from "../gen/visualAssets";
import { SURFACE_CONCRETE, SURFACE_ROAD, TILE_RESOURCE, TILE_WATER } from "../types";
import { oreVeinAt } from "./terrainOre";
import {
  ATLAS_CELL,
  CONCRETE_CELL_CLASS,
  CONCRETE_STEEL_DARK,
  ORE_CELL_CLASS,
  TERRAIN_ATLAS_REV,
  WATER_CELL_CLASS,
  WATER_SHORE_MAX,
  artSalt,
  bakeWaterShoreDist,
  clampByte,
  hash2,
  materialsFor,
  mixRgb,
  sampleTerrainMaterial,
  surfaceAt,
  tintWater,
  waterPixelDist,
  type AtlasWorld,
  type Rgb,
  type TerrainAtlas,
  type TerrainAtlasData,
} from "./terrainAtlasShared";

let grainGeneration = 0;
const grainImages = new Map<string, HTMLImageElement>();
let atlasCache: TerrainAtlas | null = null;

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

export function bakeTerrainAtlasData(state: AtlasWorld): TerrainAtlasData {
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
    key: terrainAtlasKey(state),
    data,
    width,
    height,
    cell: ATLAS_CELL,
    mapWidth: state.width,
    mapHeight: state.height,
  };
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

function restoreWaterPixels(ctx: CanvasRenderingContext2D, state: AtlasWorld, baked: TerrainAtlasData): void {
  const cols = state.width + MAP_SKIRT * 2;
  const rows = state.height + MAP_SKIRT * 2;
  const image = ctx.getImageData(0, 0, baked.width, baked.height);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (sceneryAt(state, col - MAP_SKIRT, row - MAP_SKIRT).kind !== TILE_WATER) continue;
      for (let ly = 0; ly < ATLAS_CELL; ly++) {
        const py = row * ATLAS_CELL + ly;
        for (let lx = 0; lx < ATLAS_CELL; lx++) {
          const o = (py * baked.width + col * ATLAS_CELL + lx) * 4;
          image.data[o] = baked.data[o] ?? 0;
          image.data[o + 1] = baked.data[o + 1] ?? 0;
          image.data[o + 2] = baked.data[o + 2] ?? 0;
          image.data[o + 3] = baked.data[o + 3] ?? 255;
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0);
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
      restoreWaterPixels(ctx, state, baked);
    }
  }
  atlasCache = { ...baked, canvas };
  return atlasCache;
}
