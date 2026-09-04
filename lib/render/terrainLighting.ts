import { generateCampaignVisualProfile } from "../gen/visualProfile";
import type { BiomeName, CampaignVisualProfile } from "../types";
import { mixRgb, type Rgb } from "./terrainMaterials";

export type TerrainLightRig = {
  directionX: number;
  directionY: number;
  ambient: number;
  keyStrength: number;
  occlusionStrength: number;
  keyColor: Rgb;
  atmosphereColor: Rgb;
  phase: number;
};

export type TerrainAtmosphereFrame = {
  phase: number;
  driftX: number;
  driftY: number;
  glowAlpha: number;
  hazeAlpha: number;
};

const rigCache = new Map<number, TerrainLightRig>();
const profileRigCache = new Map<string, TerrainLightRig>();

function hash01(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function accentColors(accent: CampaignVisualProfile["terrainAccent"]): { key: Rgb; atmosphere: Rgb } {
  if (accent === "amber") {
    return {
      key: { r: 255, g: 211, b: 143 },
      atmosphere: { r: 225, g: 163, b: 104 },
    };
  }
  if (accent === "red") {
    return {
      key: { r: 255, g: 183, b: 161 },
      atmosphere: { r: 203, g: 113, b: 101 },
    };
  }
  return {
    key: { r: 190, g: 240, b: 235 },
    atmosphere: { r: 113, g: 187, b: 197 },
  };
}

export function terrainLightRigFor(
  seed: number,
  profile?: CampaignVisualProfile,
): TerrainLightRig {
  if (profile === undefined) {
    const cached = rigCache.get(seed);
    if (cached) return cached;
  }
  const resolvedProfile = profile ?? generateCampaignVisualProfile(seed);
  const profileKey = `${seed}:${resolvedProfile.family}:${resolvedProfile.terrainTreatment}:${resolvedProfile.terrainAccent}`;
  const cachedProfile = profileRigCache.get(profileKey);
  if (cachedProfile) {
    if (profile === undefined) rigCache.set(seed, cachedProfile);
    return cachedProfile;
  }
  const colors = accentColors(resolvedProfile.terrainAccent);
  const familyContrast = resolvedProfile.family === 1 ? 0.96 : resolvedProfile.family === 2 ? 0.99 : 1;
  const rig: TerrainLightRig = {
    // Light arrives from the upper-left of the isometric diamond. Keeping this
    // direction stable makes cliffs, props, and tile materials read as one scene.
    directionX: 0.72,
    directionY: 0.58,
    ambient: 0.9 * familyContrast,
    keyStrength: 0.18 * familyContrast,
    occlusionStrength: 0.12,
    keyColor: colors.key,
    atmosphereColor: colors.atmosphere,
    phase: hash01(seed ^ 0x6d2b79f5) * Math.PI * 2,
  };
  profileRigCache.set(profileKey, rig);
  if (profile === undefined) rigCache.set(seed, rig);
  return rig;
}

export function clearTerrainLightCache(): void {
  rigCache.clear();
  profileRigCache.clear();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function terrainEdgeOcclusion(rig: TerrainLightRig, fx: number, fy: number): number {
  return (
    Math.max(0, fx - 0.56) * 0.55
    + Math.max(0, fy - 0.56) * 0.7
  ) * rig.occlusionStrength;
}

export function terrainEdgeDarkening(rig: TerrainLightRig, fx: number, fy: number): number {
  return clamp(1 - terrainEdgeOcclusion(rig, fx, fy), 0.94, 1);
}

/**
 * Estimate a soft surface response from the height changes toward the two
 * visible isometric faces and the pixel's position inside its tile.
 */
export function terrainLightFactor(
  rig: TerrainLightRig,
  elev: number,
  eastElev: number,
  southElev: number,
  fx: number,
  fy: number,
): number {
  const faceX = (0.5 - fx) * rig.directionX;
  const faceY = (0.5 - fy) * rig.directionY;
  const relief = (elev - eastElev) * rig.directionX * 0.07
    + (elev - southElev) * rig.directionY * 0.09;
  const faceLight = (faceX + faceY) * rig.keyStrength;
  return clamp(rig.ambient + faceLight + relief - terrainEdgeOcclusion(rig, fx, fy), 0.76, 1.12);
}

export function gradeTerrainColor(color: Rgb, factor: number, rig: TerrainLightRig, tint = 0): Rgb {
  let out = {
    r: color.r * factor,
    g: color.g * factor,
    b: color.b * factor,
  };
  const keyTint = clamp(Math.max(0, factor - 0.96) * 0.3 + tint, 0, 0.12);
  if (keyTint > 0) out = mixRgb(out, rig.keyColor, keyTint);
  const shadowTint = clamp(Math.max(0, 0.96 - factor) * 0.18, 0, 0.06);
  if (shadowTint > 0) out = mixRgb(out, { r: 10, g: 16, b: 20 }, shadowTint);
  return out;
}

export function restrainTerrainColor(color: Rgb, amount = 0.08): Rgb {
  const luma = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  return mixRgb(color, { r: luma, g: luma, b: luma }, amount);
}

export function terrainAtmosphereFrame(
  seed: number,
  timeMs: number,
  reducedMotion = false,
): TerrainAtmosphereFrame {
  const rig = terrainLightRigFor(seed);
  const phase = reducedMotion ? rig.phase : rig.phase + (timeMs / 12000) * Math.PI * 2;
  const drift = reducedMotion ? 0 : Math.sin(phase) * 0.5 + Math.sin(phase * 0.37 + 1.3) * 0.2;
  return {
    phase,
    driftX: Math.cos(phase * 0.83) * 0.08 + drift * 0.06,
    driftY: Math.sin(phase * 0.61) * 0.06,
    glowAlpha: reducedMotion ? 0.022 : 0.06,
    hazeAlpha: reducedMotion ? 0.009 : 0.024,
  };
}

export function biomeAtmosphereColor(biome: BiomeName, rig: TerrainLightRig): Rgb {
  if (biome === "ash plains" || biome === "volcanic shelf") {
    return mixRgb(rig.atmosphereColor, { r: 112, g: 92, b: 79 }, 0.26);
  }
  if (biome === "tundra grid" || biome === "crystal flats") {
    return mixRgb(rig.atmosphereColor, { r: 143, g: 201, b: 212 }, 0.24);
  }
  if (biome === "jungle wreckage" || biome === "salt marshes") {
    return mixRgb(rig.atmosphereColor, { r: 92, g: 151, b: 111 }, 0.22);
  }
  return rig.atmosphereColor;
}
