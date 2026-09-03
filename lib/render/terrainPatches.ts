import type { BiomeName } from "../types";
import type { TerrainFeatureSample } from "../gen/map/features";
import { fbm, hash2, mixRgb, type BiomeMaterials, type Rgb } from "./terrainMaterials";

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
  const out = mixRgb(color, mats.patchA, 0.1 + macro * 0.26);
  const fleck = Math.max(0, detail - 0.52) * 0.65;
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
      out = mixRgb(color, mats.patchA, dune * 0.24 + ripple * 0.12 + (n - 0.5) * 0.08);
      if (n2 > 0.88) out = mixRgb(out, mats.patchB, 0.3);
      break;
    }
    case "rust canyons": {
      const stripe = ((mapX * 0.85 + mapY * 1.6) % 1 + 1) % 1;
      const strata = stripe < 0.12 || stripe > 0.88 ? 0.4 : stripe < 0.22 || stripe > 0.78 ? 0.18 : 0.05;
      const scratch = n > 0.82 ? 0.24 : 0;
      out = mixRgb(mixRgb(color, mats.patchB, strata), mats.patchA, scratch);
      break;
    }
    case "tundra grid": {
      const frost = n > 0.7 ? 0.52 : n > 0.52 ? 0.18 : 0.04;
      const vein = Math.abs(Math.sin(mapX * 5.2 + mapY * 0.4));
      out = mixRgb(color, mats.patchA, frost);
      if (vein > 0.9) out = mixRgb(out, mats.light, 0.32);
      if (n2 > 0.86) out = mixRgb(out, mats.patchB, 0.2);
      break;
    }
    case "volcanic shelf": {
      const crack = Math.abs(Math.sin(mapX * 7.3) * Math.sin(mapY * 5.1));
      const seam = crack > 0.86 ? 0.5 : crack > 0.72 ? 0.2 : 0.06;
      out = mixRgb(color, mats.patchB, seam);
      if (n2 > 0.9) out = mixRgb(out, mats.ore, 0.24);
      break;
    }
    case "salt marshes": {
      const wet = 0.5 + 0.5 * Math.sin(mapX * 1.7 + mapY * 1.3);
      const puddle = 0.5 + 0.5 * Math.sin(mapX * 4.2 - mapY * 3.1);
      out = mixRgb(
        mixRgb(color, mats.patchA, 0.1 + wet * 0.28),
        mats.patchB,
        puddle > 0.76 ? 0.2 : 0.05,
      );
      break;
    }
    case "jungle wreckage": {
      const litter = n > 0.76 ? 0.4 : n > 0.52 ? 0.18 : 0.08;
      const moss = n2 > 0.68 ? mats.patchA : mats.patchB;
      out = mixRgb(color, moss, litter);
      if (n > 0.92) out = mixRgb(out, mats.high, 0.16);
      break;
    }
    case "crystal flats": {
      const glint = n > 0.86 ? 0.58 : n > 0.7 ? 0.24 : 0.05;
      const facet = Math.abs(Math.sin(mapX * 6.1 - mapY * 4.4));
      out = mixRgb(color, mats.patchB, glint);
      if (facet > 0.88) out = mixRgb(out, mats.light, 0.3);
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
