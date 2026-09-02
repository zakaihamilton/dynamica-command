import { TILE_H } from "../../iso";
import { sceneryAt } from "../../gen/map";
import type { BiomeName, SurfaceKind } from "../../types";
import {
  SURFACE_CONCRETE,
  SURFACE_ROAD,
  TILE_BLOCKED,
  TILE_CLEAR,
  TILE_RESOURCE,
  TILE_WATER,
} from "../../types";
import { biomeMaterials, tileVariant } from "../terrainAtlas";
import type { BiomeMaterials, Rgb } from "../terrainMaterials";

export type ScatterKind =
  | "pebble"
  | "pebbleCluster"
  | "tuft"
  | "shrub"
  | "debris"
  | "crystalChip"
  | "reed"
  | "cinder"
  | "iceChip";

export type ScatterItem = {
  kind: ScatterKind;
  ox: number;
  oy: number;
  scale: number;
  variant: number;
};

export type ScatterWorld = {
  seed: number;
  biome: BiomeName;
  width: number;
  height: number;
  tiles: number[];
  heights: number[];
  surfaces: SurfaceKind[];
};

export type BlockerPropKind =
  | "boulder"
  | "tree"
  | "pine"
  | "deadTree"
  | "crystalOutcrop"
  | "wreckage"
  | "spire"
  | "sandstone"
  | "deadShrub"
  | "snowRock";

export const LUSH_SCATTER: ReadonlySet<ScatterKind> = new Set(["tuft", "shrub", "reed"]);
export const ARID_SCATTER: ReadonlySet<ScatterKind> = new Set(["pebble", "pebbleCluster", "debris", "cinder"]);

const POOLS: Record<BiomeName, ScatterKind[]> = {
  "jungle wreckage": ["tuft", "tuft", "tuft", "shrub", "shrub", "reed", "pebble"],
  "salt marshes": ["tuft", "tuft", "reed", "reed", "shrub", "pebble"],
  "ash plains": ["pebble", "pebble", "tuft", "pebbleCluster", "tuft"],
  "crystal flats": ["crystalChip", "crystalChip", "pebble", "pebbleCluster"],
  "tundra grid": ["iceChip", "iceChip", "pebble", "tuft", "tuft"],
  "rust canyons": ["pebble", "debris", "debris", "pebbleCluster", "pebble"],
  "volcanic shelf": ["pebble", "cinder", "cinder", "debris", "pebbleCluster"],
  "glass desert": ["pebble", "pebble", "pebbleCluster", "debris", "cinder"],
};

function mix(v: number, salt: number): number {
  return (Math.imul(v ^ salt, 1597334677) >>> 0);
}

function unit(v: number, salt: number): number {
  return mix(v, salt) / 4294967296;
}

function signed(v: number, salt: number, span: number): number {
  return (unit(v, salt) * 2 - 1) * span;
}

function scatterChance(biome: BiomeName): number {
  switch (biome) {
    case "jungle wreckage": return 42;
    case "salt marshes": return 40;
    case "ash plains": return 32;
    case "rust canyons": return 30;
    case "crystal flats": return 28;
    case "volcanic shelf": return 28;
    case "tundra grid": return 26;
    case "glass desert": return 24;
  }
}

function makeItem(biome: BiomeName, v: number, slot: number): ScatterItem {
  const pool = POOLS[biome];
  const hashed = mix(v, 31 + slot * 17);
  return {
    kind: pool[hashed % pool.length]!,
    ox: signed(v, 101 + slot, 10),
    oy: signed(v, 151 + slot, 4),
    scale: 0.72 + unit(v, 201 + slot) * 0.5,
    variant: mix(v, 251 + slot),
  };
}

function groundItems(biome: BiomeName, v: number): ScatterItem[] {
  const chance = scatterChance(biome);
  const roll = v % 100;
  if (roll >= chance) return [];
  const count = roll < chance * 0.08 ? 3 : roll < chance * 0.32 ? 2 : 1;
  const items: ScatterItem[] = [];
  for (let i = 0; i < count; i++) items.push(makeItem(biome, v, i));
  return items;
}

function roadItems(v: number): ScatterItem[] {
  if (v % 14 !== 0) return [];
  return [{
    kind: "pebble",
    ox: signed(v, 88, 8),
    oy: signed(v, 89, 3),
    scale: 0.65 + unit(v, 90) * 0.3,
    variant: mix(v, 91),
  }];
}

export function scatterForTile(state: ScatterWorld, x: number, y: number): ScatterItem[] {
  const v = tileVariant(state.seed, x, y);
  if (x >= 0 && y >= 0 && x < state.width && y < state.height) {
    const i = y * state.width + x;
    const tile = state.tiles[i] ?? TILE_CLEAR;
    const surface = state.surfaces[i] ?? 0;
    if (tile === TILE_WATER || tile === TILE_RESOURCE || tile === TILE_BLOCKED) return [];
    if (surface === SURFACE_CONCRETE) return [];
    if (surface === SURFACE_ROAD) return roadItems(v);
    return groundItems(state.biome, v);
  }
  if (sceneryAt(state, x, y).kind !== TILE_CLEAR) return [];
  return groundItems(state.biome, v);
}

export function blockerPropKind(biome: BiomeName, variant: number): BlockerPropKind {
  const roll = variant % 8;
  switch (biome) {
    case "jungle wreckage":
      return roll === 0 ? "boulder" : "tree";
    case "salt marshes":
      return roll <= 1 ? "boulder" : "tree";
    case "tundra grid":
      return roll <= 2 ? "snowRock" : "pine";
    case "glass desert":
      return roll <= 3 ? "sandstone" : "deadShrub";
    case "crystal flats":
      return roll <= 1 ? "boulder" : "crystalOutcrop";
    case "rust canyons":
      return roll <= 2 ? "boulder" : "wreckage";
    case "volcanic shelf":
      return roll <= 2 ? "boulder" : "spire";
    default:
      return roll === 0 ? "deadTree" : "boulder";
  }
}

function rgbOf(c: Rgb): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: Math.round(a.r + (b.r - a.r) * u),
    g: Math.round(a.g + (b.g - a.g) * u),
    b: Math.round(a.b + (b.b - a.b) * u),
  };
}

function shadow(ctx: CanvasRenderingContext2D, z: number, rx: number, ry: number, dy = 5): void {
  ctx.fillStyle = "rgba(6,10,12,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, dy * z, rx * z, ry * z, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPebble(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const s = z * scale;
  const lean = ((variant % 5) - 2) * 0.35 * s;
  const body = mixRgb(mats.dark, mats.blocked, 0.45);
  const hi = mixRgb(mats.light, mats.mid, 0.4);
  shadow(ctx, s, 3.6, 1.35, 2.2);
  ctx.fillStyle = rgbOf(body);
  ctx.beginPath();
  ctx.moveTo(-3.2 * s + lean, 0.4 * s);
  ctx.lineTo(-1.1 * s, -2.4 * s);
  ctx.lineTo(2.8 * s + lean, -1.1 * s);
  ctx.lineTo(3.1 * s, 1.4 * s);
  ctx.lineTo(-2.4 * s, 1.8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbOf(hi);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(-0.4 * s, -0.8 * s, 1.4 * s, 0.7 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPebbleCluster(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const n = 2 + (variant % 2);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(((i * 37 + variant) % 11 - 5) * z * 0.55, ((i * 19 + variant) % 7 - 3) * z * 0.22);
    drawPebble(ctx, mats, z, scale * (0.7 + (i % 3) * 0.12), variant + i * 13);
    ctx.restore();
  }
}

function drawTuft(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const s = z * scale;
  const blades = 3 + (variant % 2);
  const stem = mixRgb(mats.dark, mats.blocked, 0.25);
  const tip = mixRgb(mats.light, mats.high, 0.35);
  shadow(ctx, s, 3.2, 1.1, 2);
  ctx.lineCap = "round";
  for (let i = 0; i < blades; i++) {
    const lean = ((i - (blades - 1) / 2) * 1.35 + ((variant >> i) % 3 - 1) * 0.4) * s;
    ctx.strokeStyle = i === 1 ? rgbOf(tip) : rgbOf(stem);
    ctx.lineWidth = Math.max(0.7, 0.85 * s);
    ctx.beginPath();
    ctx.moveTo(i * 0.4 * s, 1.6 * s);
    ctx.lineTo(lean, -3.6 * s - (i % 2) * 0.8 * s);
    ctx.stroke();
  }
}

function drawShrub(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const s = z * scale;
  const dark = mixRgb(mats.blocked, mats.dark, 0.35);
  const mid = mixRgb(mats.blocked, mats.light, 0.28);
  const hi = mixRgb(mats.light, mats.high, 0.4);
  shadow(ctx, s, 5.4, 1.8, 2.4);
  ctx.fillStyle = rgbOf(dark);
  ctx.beginPath();
  ctx.ellipse(-1.6 * s, -2.2 * s, 5.2 * s, 3.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgbOf(mid);
  ctx.beginPath();
  ctx.ellipse(1.8 * s, -2.8 * s, 4.2 * s, 2.8 * s, 0.15, 0, Math.PI * 2);
  ctx.fill();
  if (variant % 2 === 0) {
    ctx.fillStyle = rgbOf(hi);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(0.6 * s, -3.6 * s, 2.1 * s, 1.4 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawDebris(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const s = z * scale;
  const rust = mixRgb(mats.ore, mats.blocked, 0.35);
  const iron = mixRgb(mats.dark, mats.blocked, 0.2);
  shadow(ctx, s, 4.4, 1.4, 2);
  ctx.fillStyle = rgbOf(iron);
  ctx.beginPath();
  ctx.moveTo(-4.2 * s, 0.6 * s);
  ctx.lineTo(3.6 * s, -0.8 * s);
  ctx.lineTo(4.4 * s, 1.2 * s);
  ctx.lineTo(-3.2 * s, 2.1 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbOf(rust);
  ctx.beginPath();
  ctx.moveTo(-1.8 * s, -0.2 * s);
  ctx.lineTo(2.4 * s, -1.4 * s);
  ctx.lineTo(2.8 * s, 0.2 * s);
  ctx.lineTo(-1.2 * s, 1.1 * s);
  ctx.closePath();
  ctx.fill();
  if (variant % 3 === 0) {
    ctx.strokeStyle = rgbOf(mixRgb(mats.light, rust, 0.5));
    ctx.lineWidth = Math.max(0.6, 0.7 * s);
    ctx.beginPath();
    ctx.moveTo(-3 * s, 0.4 * s);
    ctx.lineTo(1.6 * s, -0.6 * s);
    ctx.stroke();
  }
}

function drawCrystalChip(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const s = z * scale;
  const gem = mixRgb(mats.ore, mats.light, 0.4);
  const dark = mixRgb(mats.dark, mats.ore, 0.35);
  const lean = ((variant % 5) - 2) * 0.5 * s;
  shadow(ctx, s, 2.6, 1.0, 1.8);
  ctx.fillStyle = rgbOf(dark);
  ctx.beginPath();
  ctx.moveTo(-1.6 * s, 1.2 * s);
  ctx.lineTo(lean, -4.4 * s);
  ctx.lineTo(1.8 * s, 1.0 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbOf(gem);
  ctx.beginPath();
  ctx.moveTo(-0.4 * s, 0.6 * s);
  ctx.lineTo(lean * 0.6, -4.0 * s);
  ctx.lineTo(1.2 * s, 0.4 * s);
  ctx.closePath();
  ctx.fill();
}

function drawReed(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const s = z * scale;
  const stem = mixRgb(mats.blocked, mats.dark, 0.15);
  const hi = mixRgb(mats.light, mats.high, 0.25);
  shadow(ctx, s, 3.8, 1.15, 2);
  ctx.lineCap = "round";
  const n = 3 + (variant % 2);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 1.5 * s;
    ctx.strokeStyle = i % 2 ? rgbOf(hi) : rgbOf(stem);
    ctx.lineWidth = Math.max(0.65, 0.7 * s);
    ctx.beginPath();
    ctx.moveTo(x, 1.8 * s);
    ctx.lineTo(x + ((variant >> i) % 3 - 1) * 0.5 * s, -4.8 * s - (i % 2) * s);
    ctx.stroke();
  }
}

function drawCinder(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const s = z * scale;
  const ember = mixRgb(mats.ore, { r: 210, g: 90, b: 40 }, 0.45);
  const ash = mixRgb(mats.dark, mats.blocked, 0.3);
  shadow(ctx, s, 2.8, 1.05, 1.8);
  ctx.fillStyle = rgbOf(ash);
  ctx.beginPath();
  ctx.ellipse(0, 0.4 * s, 2.6 * s, 1.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  if (variant % 3 !== 0) {
    ctx.fillStyle = rgbOf(ember);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(0.4 * s, -0.2 * s, 1.1 * s, 0.7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawIceChip(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  scale: number,
  variant: number,
): void {
  const s = z * scale;
  const ice = mixRgb(mats.light, { r: 220, g: 236, b: 238 }, 0.45);
  const edge = mixRgb(mats.dark, mats.high, 0.35);
  shadow(ctx, s, 3.2, 1.15, 1.9);
  ctx.fillStyle = rgbOf(edge);
  ctx.beginPath();
  ctx.moveTo(-3.1 * s, 0.8 * s);
  ctx.lineTo(-0.6 * s, -2.6 * s);
  ctx.lineTo(3.2 * s, -0.4 * s);
  ctx.lineTo(1.4 * s, 1.8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbOf(ice);
  ctx.beginPath();
  ctx.moveTo(-1.6 * s, 0.2 * s);
  ctx.lineTo(-0.2 * s, -2.1 * s);
  ctx.lineTo(2.2 * s, -0.2 * s);
  ctx.lineTo(0.6 * s, 1.1 * s);
  ctx.closePath();
  ctx.fill();
  if (variant % 2 === 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = Math.max(0.5, 0.55 * s);
    ctx.beginPath();
    ctx.moveTo(-0.4 * s, -1.6 * s);
    ctx.lineTo(1.4 * s, 0.4 * s);
    ctx.stroke();
  }
}

function paintItem(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  item: ScatterItem,
  z: number,
): void {
  ctx.save();
  ctx.translate(item.ox * z, item.oy * z);
  switch (item.kind) {
    case "pebble":
      drawPebble(ctx, mats, z, item.scale, item.variant);
      break;
    case "pebbleCluster":
      drawPebbleCluster(ctx, mats, z, item.scale, item.variant);
      break;
    case "tuft":
      drawTuft(ctx, mats, z, item.scale, item.variant);
      break;
    case "shrub":
      drawShrub(ctx, mats, z, item.scale, item.variant);
      break;
    case "debris":
      drawDebris(ctx, mats, z, item.scale, item.variant);
      break;
    case "crystalChip":
      drawCrystalChip(ctx, mats, z, item.scale, item.variant);
      break;
    case "reed":
      drawReed(ctx, mats, z, item.scale, item.variant);
      break;
    case "cinder":
      drawCinder(ctx, mats, z, item.scale, item.variant);
      break;
    case "iceChip":
      drawIceChip(ctx, mats, z, item.scale, item.variant);
      break;
  }
  ctx.restore();
}

export function drawTerrainScatter(
  ctx: CanvasRenderingContext2D,
  state: ScatterWorld,
  x: number,
  y: number,
  sx: number,
  sy: number,
  z: number,
): void {
  const items = scatterForTile(state, x, y);
  if (items.length === 0) return;
  const mats = biomeMaterials(state.biome);
  ctx.save();
  ctx.translate(sx, sy + TILE_H * z * 0.42);
  for (const item of items) paintItem(ctx, mats, item, z);
  ctx.restore();
}
