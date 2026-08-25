import type { BiomeName, SimState } from "../../types";
import type { Camera } from "../../iso";
import type { WeatherKind, WeatherParticle } from "./types";

const PARTICLE_COUNT = 120;
const particleSprites = new Map<string, HTMLCanvasElement>();

function particleSprite(color: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const hit = particleSprites.get(color);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(8, 8, 8, 4.96, 0, 0, Math.PI * 2);
  ctx.fill();
  particleSprites.set(color, canvas);
  return canvas;
}

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
    const sprite = particleSprite(particle.color);
    const radiusX = particle.size;
    const radiusY = particle.size * 0.62;
    if (sprite) {
      ctx.drawImage(sprite, particle.x - radiusX, particle.y - radiusY, radiusX * 2, radiusY * 2);
    } else {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.ellipse(particle.x, particle.y, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
