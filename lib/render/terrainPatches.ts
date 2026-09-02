import type { BiomeName } from "../types";
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
  let out = mixRgb(color, mats.patchA, 0.1 + macro * 0.26);
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
): Rgb {
  const n = hash2(Math.floor(mapX * 8), Math.floor(mapY * 8), salt + 419);
  switch (biome) {
    case "glass desert": {
      const ripple = 0.5 + 0.5 * Math.sin(mapX * 3.1 + mapY * 0.85);
      return mixRgb(color, mats.patchA, ripple * 0.18 + (n - 0.5) * 0.06);
    }
    case "rust canyons": {
      const stripe = ((mapX * 0.85 + mapY * 1.6) % 1 + 1) % 1;
      const band = stripe < 0.16 || stripe > 0.84 ? 0.26 : 0.04;
      return mixRgb(color, mats.patchB, band);
    }
    case "tundra grid": {
      const speckle = n > 0.74 ? 0.42 : n > 0.58 ? 0.12 : 0;
      return mixRgb(color, mats.patchA, speckle);
    }
    case "volcanic shelf": {
      const crack = Math.abs(Math.sin(mapX * 7.3) * Math.sin(mapY * 5.1));
      return mixRgb(color, mats.patchB, crack > 0.86 ? 0.38 : 0.05);
    }
    case "salt marshes": {
      const wet = 0.5 + 0.5 * Math.sin(mapX * 1.7 + mapY * 1.3);
      return mixRgb(color, mats.patchA, 0.08 + wet * 0.22);
    }
    case "jungle wreckage": {
      const fleck = n > 0.62 ? 0.28 : 0.07;
      return mixRgb(color, n > 0.86 ? mats.patchA : mats.patchB, fleck);
    }
    case "crystal flats": {
      const glint = n > 0.9 ? 0.48 : n > 0.76 ? 0.16 : 0.03;
      return mixRgb(color, mats.patchB, glint);
    }
    default: {
      const streak = 0.5 + 0.5 * Math.sin(mapX * 0.9 - mapY * 2.2);
      return mixRgb(color, streak > 0.62 ? mats.patchA : mats.patchB, 0.1 + streak * 0.14);
    }
  }
}
