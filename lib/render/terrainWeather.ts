import { featureEdgeMask, MAP_SKIRT, sceneryAt } from "../gen/map";
import type { BiomeName, SimState } from "../types";
import { TILE_RESOURCE, TILE_WATER } from "../types";
import { fogAt } from "../sim/fog";
import { TILE_H, TILE_W, tileToScreen, type Camera } from "./iso";
import { fogTerrainGain, biomeMaterials, oreVeinAt, ORE_GLINT_RIDGE } from "./terrainAtlas";

export type WeatherKind = "snow" | "ash" | "dust" | "ember" | "pollen" | "mist";

export type WeatherParticle = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: string;
};

export type WaterCaustic = {
  offset: number;
  alpha: number;
  phase: number;
};

const PARTICLE_COUNT = 120;

export function weatherKindForBiome(biome: BiomeName): WeatherKind {
  if (biome === "tundra grid") return "snow";
  if (biome === "ash plains") return "ash";
  if (biome === "glass desert" || biome === "rust canyons") return "dust";
  if (biome === "volcanic shelf") return "ember";
  if (biome === "jungle wreckage") return "pollen";
  return "mist";
}

function hash01(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function weatherParticleAt(
  seed: number,
  biome: BiomeName,
  index: number,
  timeMs: number,
  screenW: number,
  screenH: number,
): WeatherParticle {
  const kind = weatherKindForBiome(biome);
  const lane = seed * 9973 + index * 7919;
  const originX = hash01(lane) * screenW;
  const originY = hash01(lane + 17) * screenH;
  const speed = kind === "ember" ? 0.042 : kind === "snow" ? 0.028 : kind === "ash" ? 0.022 : 0.018;
  const driftX = (hash01(lane + 31) - 0.35) * speed * (kind === "snow" ? 0.6 : 1);
  const driftY = speed * (kind === "ember" ? -1.4 : 1);
  const wrap = (value: number, span: number) => ((value % span) + span) % span;
  const color = kind === "snow"
    ? "#e8f4f6"
    : kind === "ash"
      ? "#9aa39c"
      : kind === "dust"
        ? "#c8b486"
        : kind === "ember"
          ? "#d06a3c"
          : kind === "pollen"
            ? "#8ea878"
            : "#b8d0cc";
  return {
    x: wrap(originX + timeMs * driftX, screenW),
    y: wrap(originY + timeMs * driftY, screenH),
    size: 0.7 + hash01(lane + 53) * (kind === "mist" ? 3.2 : 1.8),
    alpha: kind === "mist" ? 0.05 + hash01(lane + 71) * 0.06 : 0.1 + hash01(lane + 71) * 0.18,
    color,
  };
}

export function waterCaustic(timeMs: number, x: number, y: number): WaterCaustic {
  const phase = timeMs * 0.0016 + x * 0.63 + y * 0.41;
  return {
    offset: Math.sin(phase) * 4.2 + Math.sin(phase * 0.37 + 1.2) * 1.6,
    alpha: 0.08 + (Math.sin(phase * 1.3) + 1) * 0.07,
    phase,
  };
}

export function oreGlint(timeMs: number, x: number, y: number): number {
  const phase = timeMs * 0.0028 + x * 1.17 + y * 0.73;
  return 0.18 + (Math.sin(phase) + 1) * 0.16;
}

function isoDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.closePath();
}

export function paintWaterFx(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  clockMs = 0,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const z = cam.zoom;
  const tw = TILE_W * z;
  const th = TILE_H * z;
  const margin = tw;
  const x0 = Math.max(-MAP_SKIRT, 0);
  const y0 = Math.max(-MAP_SKIRT, 0);
  const x1 = state.width;
  const y1 = state.height;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (state.tiles[y * state.width + x] !== TILE_WATER) continue;
      const fog = fogAt(state, x, y);
      if (fog === 0) continue;
      const s = tileToScreen(x, y, cam, 0);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      const caustic = waterCaustic(clockMs, x, y);
      const caustic2 = waterCaustic(clockMs * 1.27 + 80, x + 2, y - 1);
      const gain = fogTerrainGain(fog);
      ctx.save();
      isoDiamond(ctx, s.x, s.y, tw, th);
      ctx.clip();
      ctx.globalAlpha = caustic.alpha * gain;
      ctx.fillStyle = "#d7eef2";
      ctx.beginPath();
      ctx.ellipse(s.x + caustic.offset, s.y + th * 0.42, tw * 0.18, th * 0.08, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = caustic2.alpha * 0.7 * gain;
      ctx.beginPath();
      ctx.ellipse(s.x - tw * 0.12 - caustic2.offset * 0.4, s.y + th * 0.58, tw * 0.14, th * 0.06, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const bank = featureEdgeMask(state, x, y).bank;
      if (bank) {
        ctx.save();
        ctx.globalAlpha = (0.16 + caustic.alpha) * gain;
        ctx.strokeStyle = state.biome === "volcanic shelf" ? "#8a8070" : "#e8e0c8";
        ctx.lineWidth = Math.max(1.2, z * 1.4);
        ctx.beginPath();
        ctx.moveTo(s.x - tw * 0.28, s.y + th * 0.58 + Math.sin(caustic.phase) * 1.5);
        ctx.lineTo(s.x + tw * 0.22, s.y + th * 0.72 + Math.cos(caustic.phase) * 1.2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

const VEIN_GLINT_PROBES: ReadonlyArray<readonly [number, number]> = [
  [0.28, 0.32],
  [0.62, 0.28],
  [0.38, 0.68],
  [0.72, 0.58],
];

export function paintOreGlints(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  clockMs = 0,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const z = cam.zoom;
  const margin = TILE_W * z;
  const mats = biomeMaterials(state.biome);
  const specR = Math.round(mats.ore.r + (mats.light.r - mats.ore.r) * 0.55);
  const specG = Math.round(mats.ore.g + (mats.light.g - mats.ore.g) * 0.55);
  const specB = Math.round(mats.ore.b + (mats.light.b - mats.ore.b) * 0.55);
  const fill = `rgb(${specR},${specG},${specB})`;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (state.tiles[y * state.width + x] !== TILE_RESOURCE) continue;
      const fog = fogAt(state, x, y);
      if (fog === 0) continue;
      const elev = sceneryAt(state, x, y).elev;
      const origin = tileToScreen(x, y, cam, elev);
      if (origin.x < -margin || origin.y < -margin || origin.x > w + margin || origin.y > h + margin) continue;
      let bestFx = 0.5;
      let bestFy = 0.5;
      let bestIntensity = 0;
      for (const [fx, fy] of VEIN_GLINT_PROBES) {
        const vein = oreVeinAt(state, x + fx, y + fy);
        if (vein.intensity > bestIntensity) {
          bestIntensity = vein.intensity;
          bestFx = fx;
          bestFy = fy;
        }
      }
      if (bestIntensity < ORE_GLINT_RIDGE) continue;
      const s = tileToScreen(x + bestFx, y + bestFy, cam, elev);
      const glint = oreGlint(clockMs, x, y);
      ctx.save();
      ctx.globalAlpha = glint * fogTerrainGain(fog) * Math.min(1, bestIntensity);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + TILE_H * z * 0.08, 2.2 * z, 1.1 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function paintTerrainWeather(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  _cam: Camera,
  clockMs = 0,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const particle = weatherParticleAt(state.seed, state.biome, i, clockMs, w, h);
    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.ellipse(particle.x, particle.y, particle.size, particle.size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
