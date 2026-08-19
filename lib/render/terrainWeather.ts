import { featureEdgeMask, MAP_SKIRT, sceneryAt } from "../gen/map";
import type { BiomeName, SimState } from "../types";
import { TILE_RESOURCE, TILE_WATER } from "../types";
import { fogAt } from "../sim/fog";
import { TILE_H, TILE_W, expandIsoDiamond, tileToScreen, type Camera } from "./iso";
import { fogTerrainGain, oreCrystalCluster, biomeMaterials } from "./terrainAtlas";
import { WATER_COVER } from "./terrainPaint";

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
  const phase = timeMs * 0.0012 + x * 0.63 + y * 0.41;
  return {
    offset: Math.sin(phase) * 5.5 + Math.sin(phase * 0.37 + 1.2) * 2.2,
    alpha: 0.14 + (Math.sin(phase * 1.3) + 1) * 0.1,
    phase,
  };
}

export function oreGlint(timeMs: number, x: number, y: number): number {
  return oreSparkle(timeMs, x, y, 0).glow;
}

export function oreSparkle(timeMs: number, x: number, y: number, index: number): {
  sweep: number;
  twinkle: number;
  glow: number;
} {
  const phase = timeMs * 0.00032 + x * 1.13 + y * 0.67 + index * 2.09;
  return {
    sweep: (Math.sin(phase) + 1) * 0.5,
    twinkle: Math.pow(Math.max(0, Math.sin(phase * 0.72 + 0.6)), 16),
    glow: 0.05 + (Math.sin(phase * 0.14 + index) + 1) * 0.04,
  };
}

function drawSparkleStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
): void {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#fff8dc";
  ctx.lineWidth = Math.max(1, size * 0.18);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.55;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.55, y - size * 0.55);
  ctx.lineTo(x + size * 0.55, y + size * 0.55);
  ctx.moveTo(x + size * 0.55, y - size * 0.55);
  ctx.lineTo(x - size * 0.55, y + size * 0.55);
  ctx.stroke();
  ctx.restore();
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

function rgbCss(color: { r: number; g: number; b: number }): string {
  return `rgb(${color.r | 0},${color.g | 0},${color.b | 0})`;
}

function strokeCausticFamily(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tw: number,
  th: number,
  slope: number,
  spacing: number,
  scroll: number,
  alpha: number,
  width: number,
): void {
  const coord = (px: number, py: number) => py - slope * px;
  const x0 = sx - tw;
  const x1 = sx + tw;
  const c0 = coord(x0, sy - th);
  const c1 = coord(x1, sy + th * 2);
  const lo = Math.min(c0, c1);
  const hiC = Math.max(c0, c1);
  const k0 = Math.floor((lo + scroll) / spacing);
  const k1 = Math.ceil((hiC + scroll) / spacing);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  for (let k = k0; k <= k1; k++) {
    const c = k * spacing - scroll;
    ctx.beginPath();
    ctx.moveTo(x0, c + slope * x0);
    ctx.lineTo(x1, c + slope * x1);
    ctx.stroke();
  }
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
  const hi = biomeMaterials(state.biome).waterHi;
  const highlight = rgbCss(hi);
  const foamFill = state.biome === "volcanic shelf"
    ? "rgba(138,128,112,0.9)"
    : `rgba(${Math.min(255, hi.r + 40)},${Math.min(255, hi.g + 28)},${Math.min(255, hi.b + 20)},0.9)`;
  const scrollA = clockMs * 0.016;
  const scrollB = clockMs * 0.01;
  const spacingA = 20 * z;
  const spacingB = 33 * z;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (state.tiles[y * state.width + x] !== TILE_WATER) continue;
      const fog = fogAt(state, x, y);
      if (fog === 0) continue;
      const s = tileToScreen(x, y, cam, 0);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      const caustic = waterCaustic(clockMs, x, y);
      const gain = fogTerrainGain(fog);
      const cover = expandIsoDiamond(s.x, s.y, tw, th, WATER_COVER);
      ctx.save();
      isoDiamond(ctx, cover.x, cover.y, cover.w, cover.h);
      ctx.clip();
      ctx.fillStyle = highlight;
      ctx.globalAlpha = (0.045 + (Math.sin(clockMs * 0.0009 + (s.x + s.y) * 0.012) + 1) * 0.035) * gain;
      isoDiamond(ctx, cover.x, cover.y, cover.w, cover.h);
      ctx.fill();
      ctx.strokeStyle = highlight;
      strokeCausticFamily(ctx, s.x, s.y, tw, th, -0.5, spacingA, scrollA, caustic.alpha * 0.85 * gain, Math.max(1.15, z * 1.7));
      strokeCausticFamily(ctx, s.x, s.y, tw, th, 0.42, spacingB, scrollB, caustic.alpha * 0.55 * gain, Math.max(0.9, z * 1.2));
      ctx.restore();
      const bank = featureEdgeMask(state, x, y).bank;
      if (!bank) continue;
      const n: [number, number] = [s.x, s.y];
      const e: [number, number] = [s.x + tw / 2, s.y + th / 2];
      const so: [number, number] = [s.x, s.y + th];
      const we: [number, number] = [s.x - tw / 2, s.y + th / 2];
      const mid = [s.x, s.y + th * 0.5] as const;
      const edges: Array<[number, [number, number], [number, number]]> = [
        [1, n, e],
        [2, e, so],
        [4, so, we],
        [8, we, n],
      ];
      ctx.save();
      ctx.fillStyle = foamFill;
      ctx.globalAlpha = (0.2 + caustic.alpha * 0.35) * gain;
      const bob = Math.sin(caustic.phase) * 1.4 * z;
      for (const [bit, a, b] of edges) {
        if (!(bank & bit)) continue;
        const mx = (a[0] + b[0]) * 0.5;
        const my = (a[1] + b[1]) * 0.5;
        const ix = (mid[0] - mx) * 0.22;
        const iy = (mid[1] - my) * 0.22;
        ctx.beginPath();
        ctx.ellipse(mx + ix, my + iy + bob, tw * 0.18, th * 0.07, 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

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
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (state.tiles[y * state.width + x] !== TILE_RESOURCE) continue;
      const fog = fogAt(state, x, y);
      if (fog === 0) continue;
      const elev = sceneryAt(state, x, y).elev;
      const origin = tileToScreen(x, y, cam, elev);
      if (origin.x < -margin || origin.y < -margin || origin.x > w + margin || origin.y > h + margin) continue;
      const cluster = oreCrystalCluster(state, x, y);
      if (!cluster) continue;
      const gain = fogTerrainGain(fog) * Math.min(1, cluster.intensity);
      const s = tileToScreen(x, y, cam, elev);
      const baseX = s.x;
      const baseY = s.y;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const halo = oreSparkle(clockMs, x, y, 0);
      ctx.globalAlpha = halo.glow * gain * 0.16;
      ctx.fillStyle = "#ffe9a8";
      ctx.beginPath();
      ctx.ellipse(baseX, baseY + TILE_H * z * 0.5, TILE_W * z * 0.28, TILE_H * z * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      cluster.shards.forEach((shard, index) => {
        const spark = oreSparkle(clockMs, x, y, index);
        const dx = shard.dx * z;
        const dy = shard.dy * z;
        const lean = shard.lean * z;
        const rise = shard.rise * z;
        const tipX = baseX + dx + lean;
        const tipY = baseY + dy - rise;
        const t = 0.18 + spark.sweep * 0.72;
        const sweepX = baseX + dx + lean * t;
        const sweepY = baseY + dy - rise * t;
        ctx.globalAlpha = (0.05 + spark.sweep * 0.1) * gain;
        ctx.fillStyle = "#fff4c4";
        ctx.beginPath();
        ctx.ellipse(sweepX, sweepY, 2.2 * z, 1.1 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = (0.04 + spark.glow * 0.16) * gain;
        ctx.fillStyle = "#ffe07a";
        ctx.beginPath();
        ctx.ellipse(tipX, tipY, 1.6 * z, 1.6 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        drawSparkleStar(ctx, tipX, tipY, (2.2 + spark.twinkle * 1.8) * z, spark.twinkle * gain * 0.55);
      });
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
