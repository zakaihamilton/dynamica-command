import { biomeArt, TERRAIN_ART } from "../gen/visualAssets";
import { generateCampaignVisualProfile } from "../gen/visualProfile";
import { MAP_SKIRT, sceneryAt } from "../gen/map";
import { TILE_WATER } from "../types";
import { ATLAS_CELL } from "./terrainMaterials";
import { bakeTerrainAtlasData as bakeAtlas, makeAtlasKey, type TerrainAtlasData } from "./terrainAtlasBake";
import type { AtlasWorld } from "./terrainMaterials";

export {
  ATLAS_CELL,
  TERRAIN_ATLAS_REV,
  CONCRETE_STEEL,
  CONCRETE_STEEL_LIGHT,
  CONCRETE_STEEL_DARK,
  biomeMaterials,
  fogTerrainGain,
  tileVariant,
  terrainColors,
} from "./terrainMaterials";
export type { AtlasWorld, TerrainSample } from "./terrainMaterials";
export {
  ORE_GLINT_RIDGE,
  ORE_CRYSTAL_MIN_AMOUNT,
  ORE_VEIN_PROBES,
  oreVeinAt,
  oreVeinPeak,
  oreShardCount,
  oreCrystalCluster,
} from "./terrainOre";
export type {
  OreVeinSample,
  OreVeinPeak,
  OreShardPose,
  OreBurstOrigin,
  OreCrystalCluster,
} from "./terrainOre";
export {
  resourceSignature,
  terrainLayoutSignature,
  atlasRectForTile,
  waterShoreDist,
  sampleTerrainMaterial,
  atlasPixelAtTile,
} from "./terrainAtlasBake";
export { tintGroundPatches, applyBiomeGroundPattern } from "./terrainPatches";
export type { TerrainAtlasData } from "./terrainAtlasBake";

export type TerrainAtlas = TerrainAtlasData & {
  canvas: HTMLCanvasElement | null;
};

let grainGeneration = 0;
const grainImages = new Map<string, HTMLImageElement>();
let atlasCache: TerrainAtlas | null = null;

export function terrainGrainGeneration(): number {
  return grainGeneration;
}

export function terrainAtlasKey(state: AtlasWorld): string {
  return makeAtlasKey(state, grainGeneration);
}

export function bakeTerrainAtlasData(state: AtlasWorld): TerrainAtlasData {
  return bakeAtlas(state, grainGeneration);
}

export function isTerrainAtlasReady(state: AtlasWorld): boolean {
  if (typeof Image === "undefined") return true;
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) return true;
  const biomeSrc = biomeArt(state.biome);
  const treatment = generateCampaignVisualProfile(state.seed).terrainTreatment;
  const plateSrc = TERRAIN_ART[treatment];
  const bImg = grainImages.get(biomeSrc);
  const pImg = grainImages.get(plateSrc);
  const bReady = Boolean(bImg && bImg.complete && bImg.naturalWidth > 0);
  const pReady = Boolean(pImg && pImg.complete && pImg.naturalWidth > 0);
  return bReady && pReady;
}

export function preloadTerrainAtlas(state: AtlasWorld): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(true);
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) return Promise.resolve(true);
  const biomeSrc = biomeArt(state.biome);
  const treatment = generateCampaignVisualProfile(state.seed).terrainTreatment;
  const plateSrc = TERRAIN_ART[treatment];

  const loadOne = (src: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      const cached = grainImages.get(src);
      if (cached && cached.complete && cached.naturalWidth > 0) {
        resolve();
        return;
      }
      const img = cached ?? new Image();
      if (!cached) {
        img.decoding = "async";
        grainImages.set(src, img);
      }
      if (img.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      const onDone = () => {
        grainGeneration += 1;
        atlasCache = null;
        resolve();
      };
      img.addEventListener("load", onDone, { once: true });
      img.addEventListener("error", onDone, { once: true });
      if (!img.src) {
        img.src = src;
      }
    });
  };

  return Promise.all([loadOne(biomeSrc), loadOne(plateSrc)]).then(() => {
    if (typeof document !== "undefined") {
      getTerrainAtlas(state);
    }
    return true;
  });
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
    ctx.globalAlpha = 0.42;
    const tw = biomeImg.naturalWidth || biomeImg.width;
    const th = biomeImg.naturalHeight || biomeImg.height;
    for (let y = 0; y < height; y += th) {
      for (let x = 0; x < width; x += tw) ctx.drawImage(biomeImg, x, y, tw, th);
    }
  }
  if (plateImg) {
    ctx.globalAlpha = 0.24;
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
