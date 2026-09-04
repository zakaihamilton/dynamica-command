import type { BiomeName } from "../types";
import type { TerrainFeatureSample } from "../gen/map/features";
import { fbm, hash2, mixRgb, type BiomeMaterials, type Rgb } from "./terrainMaterials";

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Regional soil/moss/sand mix sampled once per atlas cell. */
export function tintGroundPatches(
  color: Rgb,
  mats: BiomeMaterials,
  mapX: number,
  mapY: number,
  salt: number,
): Rgb {
  const macro = fbm(mapX * 0.11, mapY * 0.11, salt + 311);
  const detail = fbm(mapX * 0.48, mapY * 0.48, salt + 347);
  const out = mixRgb(color, mats.patchA, 0.08 + macro * 0.22);
  const fleck = smoothstep(0.42, 0.86, detail) * 0.38;
  return mixRgb(out, mats.patchB, fleck);
}

/**
 * Cheap per-pixel biome marks. Uses hash + trig only — no extra fbm — so the
 * atlas bake stays inside the performance budget.
 */
export function applyBiomeGroundPattern(
  color: Rgb,
  biome: BiomeName,
  mapX: number,
  mapY: number,
  salt: number,
  mats: BiomeMaterials,
  feature?: TerrainFeatureSample,
): Rgb {
  const n = hash2(Math.floor(mapX * 8), Math.floor(mapY * 8), salt + 419);
  const n2 = hash2(Math.floor(mapX * 16), Math.floor(mapY * 16), salt + 431);
  let out: Rgb;
  switch (biome) {
    case "glass desert": {
      const dune = 0.5 + 0.5 * Math.sin(mapX * 3.1 + mapY * 0.85);
      const ripple = 0.5 + 0.5 * Math.sin(mapX * 7.4 - mapY * 2.1);
      out = mixRgb(color, mats.patchA, dune * 0.18 + ripple * 0.08 + (n - 0.5) * 0.06);
      out = mixRgb(out, mats.patchB, smoothstep(0.8, 0.98, n2) * 0.18);
      break;
    }
    case "rust canyons": {
      const stripe = ((mapX * 0.85 + mapY * 1.6) % 1 + 1) % 1;
      const strata = Math.pow(Math.max(0, Math.cos(stripe * Math.PI * 2)), 10) * 0.28 + 0.04;
      const scratch = smoothstep(0.72, 0.96, n) * 0.16;
      out = mixRgb(mixRgb(color, mats.patchB, strata), mats.patchA, scratch);
      break;
    }
    case "tundra grid": {
      const frost = smoothstep(0.44, 0.88, n) * 0.36;
      const vein = Math.abs(Math.sin(mapX * 5.2 + mapY * 0.4));
      out = mixRgb(color, mats.patchA, frost);
      out = mixRgb(out, mats.light, smoothstep(0.84, 0.99, vein) * 0.2);
      out = mixRgb(out, mats.patchB, smoothstep(0.8, 0.98, n2) * 0.14);
      break;
    }
    case "volcanic shelf": {
      const crack = Math.abs(Math.sin(mapX * 7.3) * Math.sin(mapY * 5.1));
      const seam = smoothstep(0.68, 0.96, crack) * 0.38 + 0.04;
      out = mixRgb(color, mats.patchB, seam);
      out = mixRgb(out, mats.ore, smoothstep(0.84, 0.99, n2) * 0.16);
      break;
    }
    case "salt marshes": {
      const wet = 0.5 + 0.5 * Math.sin(mapX * 1.7 + mapY * 1.3);
      const puddle = 0.5 + 0.5 * Math.sin(mapX * 4.2 - mapY * 3.1);
      out = mixRgb(
        mixRgb(color, mats.patchA, 0.08 + wet * 0.22),
        mats.patchB,
        0.04 + smoothstep(0.66, 0.94, puddle) * 0.12,
      );
      break;
    }
    case "jungle wreckage": {
      const litter = 0.06 + smoothstep(0.48, 0.94, n) * 0.28;
      const moss = n2 > 0.68 ? mats.patchA : mats.patchB;
      out = mixRgb(color, moss, litter);
      out = mixRgb(out, mats.high, smoothstep(0.86, 0.99, n) * 0.12);
      break;
    }
    case "crystal flats": {
      const glint = 0.04 + smoothstep(0.68, 0.98, n) * 0.38;
      const facet = Math.abs(Math.sin(mapX * 6.1 - mapY * 4.4));
      out = mixRgb(color, mats.patchB, glint);
      out = mixRgb(out, mats.light, smoothstep(0.84, 0.99, facet) * 0.2);
      break;
    }
    default: {
      const streak = 0.5 + 0.5 * Math.sin(mapX * 0.9 - mapY * 2.2);
      const ash = n > 0.78 ? 0.24 : 0.08;
      out = mixRgb(
        mixRgb(color, streak > 0.56 ? mats.patchA : mats.patchB, 0.12 + streak * 0.18),
        mats.dark,
        ash,
      );
      break;
    }
  }
  return applyTerrainFeaturePattern(out, feature, mapX, mapY, salt, mats);
}

function applyTerrainFeaturePattern(
  color: Rgb,
  feature: TerrainFeatureSample | undefined,
  mapX: number,
  mapY: number,
  salt: number,
  mats: BiomeMaterials,
): Rgb {
  if (!feature || feature.intensity < 0.08) return color;
  const t = feature.intensity;
  const grain = hash2(Math.floor(mapX * 12), Math.floor(mapY * 12), salt + 503);
  const band = 0.5 + 0.5 * Math.sin(mapX * 4.4 - mapY * 2.7 + feature.detail * 5);
  const seam = Math.abs(Math.sin(mapX * 7.1 + mapY * 3.6 + feature.detail * 4));
  switch (feature.kind) {
    case "ashDrift":
    case "duneSea":
    case "saltPan":
    case "frostPan":
      return mixRgb(color, mats.patchA, t * (0.1 + band * 0.2));
    case "cinderBasin":
    case "strataGully":
    case "dryWash":
    case "iceRift":
    case "lavaScar":
      return mixRgb(color, mats.patchB, t * (seam > 0.74 ? 0.34 : 0.1));
    case "crystalVein":
    case "glassShards":
      return mixRgb(color, grain > 0.72 ? mats.light : mats.patchB, t * (grain > 0.72 ? 0.34 : 0.12));
    case "reedBed":
    case "canopyGrove":
      return mixRgb(color, grain > 0.54 ? mats.patchA : mats.dark, t * (0.12 + band * 0.15));
    case "wreckClearing":
    case "scrapWash":
    case "mudflat":
      return mixRgb(color, grain > 0.8 ? mats.light : mats.patchB, t * (grain > 0.8 ? 0.16 : 0.16));
    case "scoriaField":
    case "facetRise":
    case "mesaShelf":
    case "driftMoraine":
    case "vineRidge":
    case "basaltShelf":
    case "ashCone":
      return mixRgb(color, seam > 0.76 ? mats.light : mats.dark, t * (seam > 0.76 ? 0.2 : 0.14));
  }
  return color;
}
