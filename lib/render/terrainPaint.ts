import { cliffFaces, drawElevationFaces, fillElevationPoly, tileCliffGeometry } from "../gen/assets";
import { MAP_SKIRT, isMountainScenery, sceneryAt, type ScenerySample } from "../gen/map";
import { generateCampaignVisualProfile } from "../gen/visualProfile";
import type { BuildingKind, Entity, SimState } from "../types";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER, SURFACE_CONCRETE } from "../types";
import { fogAt } from "../sim/fog";
import { HEIGHT_STEP, TILE_H, TILE_W, expandIsoDiamond, isoAtlasTransform, tileToScreen, type Camera } from "./iso";
import {
  atlasRectForTile,
  biomeMaterials,
  CONCRETE_STEEL,
  CONCRETE_STEEL_DARK,
  CONCRETE_STEEL_LIGHT,
  fogTerrainGain,
  getTerrainAtlas,
  oreCrystalCluster,
  tileVariant,
  type TerrainAtlas,
} from "./terrainAtlas";

const sceneryMemo = new Map<number, ScenerySample>();

function sceneryKey(x: number, y: number): number {
  return ((x + 512) << 12) | (y + 512);
}

function memoScenery(state: SimState, x: number, y: number): ScenerySample {
  const k = sceneryKey(x, y);
  let sample = sceneryMemo.get(k);
  if (!sample) {
    sample = sceneryAt(state, x, y);
    sceneryMemo.set(k, sample);
  }
  return sample;
}

const SHROUD_FILL = "#080d11";
const TERRAIN_COVER = 1.08;
export const WATER_COVER = 1.24;
const ATLAS_SAMPLE_PAD = 1;

function isoDiamondPath(
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

function paintShroudCliffs(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tw: number,
  th: number,
  dropE: number,
  dropS: number,
  step: number,
  tileX: number,
  tileY: number,
  seed: number,
  seal: boolean,
): void {
  if (dropE <= 0 && dropS <= 0) return;
  const geo = tileCliffGeometry(tw, th, step, dropE, dropS, seed, tileX, tileY);
  if (geo.south) fillElevationPoly(ctx, sx, sy, geo.south.points, undefined, seal);
  if (geo.east) fillElevationPoly(ctx, sx, sy, geo.east.points, undefined, seal);
  if (geo.wedge) fillElevationPoly(ctx, sx, sy, geo.wedge, undefined, seal);
}

function paintShroudMaskTile(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tw: number,
  th: number,
  dropE: number,
  dropS: number,
  step: number,
  gain: number,
  z: number,
  tileX: number,
  tileY: number,
  seed: number,
): void {
  const shroudGain = fogTerrainGain(0);
  if (gain <= shroudGain + 0.005) return;
  const srcAlpha = 1 - (1 - gain) / (1 - shroudGain);
  if (srcAlpha <= 0.01) return;
  ctx.globalAlpha = srcAlpha;
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.35, 1.25 * z);
  const cover = expandIsoDiamond(sx, sy, tw, th, srcAlpha >= 0.98 ? TERRAIN_COVER : 1);
  isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
  ctx.fill();
  if (srcAlpha >= 0.98) ctx.stroke();
  paintShroudCliffs(ctx, sx, sy, tw, th, dropE, dropS, step, tileX, tileY, seed, srcAlpha >= 0.98);
}

function paintShroudOverlay(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tw: number,
  th: number,
  dropE: number,
  dropS: number,
  step: number,
  gain: number,
  z: number,
  tileX: number,
  tileY: number,
  seed: number,
): void {
  if (gain >= 0.98) return;
  ctx.save();
  ctx.globalAlpha = 1 - gain;
  ctx.fillStyle = SHROUD_FILL;
  ctx.strokeStyle = SHROUD_FILL;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.35, 1.25 * z);
  const cover = expandIsoDiamond(sx, sy, tw, th, TERRAIN_COVER);
  isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
  ctx.fill();
  ctx.stroke();
  paintShroudCliffs(ctx, sx, sy, tw, th, dropE, dropS, step, tileX, tileY, seed, true);
  ctx.restore();
}

function drawAtlasDiamond(
  ctx: CanvasRenderingContext2D,
  atlas: TerrainAtlas,
  x: number,
  y: number,
  sx: number,
  sy: number,
  tw: number,
  th: number,
): void {
  if (!atlas.canvas) return;
  const rect = atlasRectForTile(x, y, atlas.mapWidth);
  const pad = ATLAS_SAMPLE_PAD;
  const sx0 = Math.max(0, rect.sx - pad);
  const sy0 = Math.max(0, rect.sy - pad);
  const sx1 = Math.min(atlas.width, rect.sx + rect.sw + pad);
  const sy1 = Math.min(atlas.height, rect.sy + rect.sh + pad);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.transform(...isoAtlasTransform(sx, sy, tw, th, rect.sw, rect.sh));
  ctx.drawImage(atlas.canvas, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 - rect.sx, sy0 - rect.sy, sx1 - sx0, sy1 - sy0);
}

const SLAB_RUST = { r: 117, g: 81, b: 59 };
const SLAB_RUST_LIGHT = { r: 189, g: 130, b: 88 };

function mixTone(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: a.r + (b.r - a.r) * u,
    g: a.g + (b.g - a.g) * u,
    b: a.b + (b.b - a.b) * u,
  };
}

function rgbCss(color: { r: number; g: number; b: number }): string {
  return `rgb(${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)})`;
}

function slabBit(v: number, shift: number, mod: number): number {
  return ((v >>> shift) % mod + mod) % mod;
}

function drawConcreteSlab(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tw: number,
  th: number,
  z: number,
  variant: number,
  alpha: number,
): void {
  const v = variant >>> 0;
  const age = slabBit(v, 3, 10) / 9;
  const polish = (slabBit(v, 7, 7) - 3) / 3;
  let face = mixTone(CONCRETE_STEEL, CONCRETE_STEEL_LIGHT, 0.12 + polish * 0.08);
  face = mixTone(face, CONCRETE_STEEL_DARK, 0.08 + age * 0.28);
  if (age > 0.62) face = mixTone(face, SLAB_RUST, 0.06 + (age - 0.62) * 0.1);
  const grout = mixTone(CONCRETE_STEEL_DARK, CONCRETE_STEEL, 0.22);
  const joint = Math.max(1.15, 1.45 * z);
  const iw = tw - joint * 2;
  const ih = th - joint;
  const iy = sy + joint * 0.5;
  ctx.save();
  ctx.globalAlpha = alpha;
  isoDiamondPath(ctx, sx, sy, tw, th);
  ctx.fillStyle = rgbCss(grout);
  ctx.fill();
  isoDiamondPath(ctx, sx, iy, iw, ih);
  ctx.fillStyle = rgbCss(face);
  ctx.fill();
  ctx.save();
  isoDiamondPath(ctx, sx, iy, iw, ih);
  ctx.clip();

  const bloomX = sx + (slabBit(v, 0, 9) - 4) * 3.2 * z;
  const bloomY = iy + ih * (0.38 + slabBit(v, 4, 5) * 0.06);
  ctx.globalAlpha = alpha * (0.1 + age * 0.18);
  ctx.fillStyle = rgbCss(mixTone(CONCRETE_STEEL_DARK, SLAB_RUST, age * 0.4));
  ctx.beginPath();
  ctx.ellipse(bloomX, bloomY, iw * (0.2 + slabBit(v, 2, 4) * 0.04), ih * (0.16 + slabBit(v, 8, 3) * 0.03), 0, 0, Math.PI * 2);
  ctx.fill();

  const grain = 2 + slabBit(v, 1, 3);
  const lean = (slabBit(v, 1, 2) === 0 ? 1 : -1) * iw * 0.38;
  ctx.lineCap = "butt";
  ctx.lineWidth = Math.max(0.7, 0.85 * z);
  for (let i = 0; i < grain; i++) {
    const t = (i + 0.35) / grain - 0.5;
    const gy = iy + ih * (0.32 + t * 0.42) + (slabBit(v, 10 + i, 5) - 2) * 0.45 * z;
    ctx.globalAlpha = alpha * (i === 1 ? 0.22 : 0.12);
    ctx.strokeStyle = rgbCss(i % 2 ? CONCRETE_STEEL_LIGHT : CONCRETE_STEEL_DARK);
    ctx.beginPath();
    ctx.moveTo(sx - lean, gy - ih * 0.12);
    ctx.lineTo(sx + lean, gy + ih * 0.12);
    ctx.stroke();
  }

  if (slabBit(v, 5, 5) >= 2) {
    const stains = 1 + slabBit(v, 11, 2);
    for (let i = 0; i < stains; i++) {
      const rx = sx + (slabBit(v, 8 + i * 4, 11) - 5) * 2.4 * z;
      const ry = iy + ih * (0.34 + slabBit(v, 12 + i, 5) * 0.07);
      ctx.globalAlpha = alpha * (0.18 + age * 0.2);
      ctx.fillStyle = rgbCss(mixTone(i === 0 ? SLAB_RUST : SLAB_RUST_LIGHT, face, 0.28));
      ctx.beginPath();
      ctx.ellipse(rx, ry, (2.8 + i) * z, 1.25 * z, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * (0.16 + age * 0.14);
      ctx.strokeStyle = rgbCss(SLAB_RUST);
      ctx.lineWidth = Math.max(0.7, 0.9 * z);
      ctx.beginPath();
      ctx.moveTo(rx - 0.4 * z, ry);
      ctx.lineTo(rx + 1.6 * z, ry + 5.2 * z);
      ctx.stroke();
    }
  }

  const pits = slabBit(v, 9, 4);
  ctx.fillStyle = rgbCss(mixTone(CONCRETE_STEEL_DARK, SLAB_RUST, 0.2));
  for (let i = 0; i < pits; i++) {
    const px = sx + (slabBit(v, 14 + i * 3, 13) - 6) * 2.1 * z;
    const py = iy + ih * (0.28 + slabBit(v, 16 + i, 6) * 0.08);
    ctx.globalAlpha = alpha * 0.28;
    ctx.beginPath();
    ctx.ellipse(px, py, 0.9 * z, 0.45 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

function smoothFogGain(state: SimState, x: number, y: number): number {
  let sum = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      sum += fogTerrainGain(fogAt(state, x + dx, y + dy));
      count += 1;
    }
  }
  return sum / count;
}

function drawBlockerProp(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  x: number,
  y: number,
  sx: number,
  sy: number,
  z: number,
): void {
  const v = tileVariant(state.seed, x, y);
  const mats = biomeMaterials(state.biome);
  const lush = state.biome === "jungle wreckage" || state.biome === "salt marshes";
  const ox = ((v % 7) - 3) * z * 0.4;
  const oy = ((Math.floor(v / 11) % 5) - 2) * z * 0.2;
  const body = lush
    ? `rgb(${mats.blocked.r},${Math.min(255, mats.blocked.g + 18)},${mats.blocked.b})`
    : `rgb(${mats.blocked.r},${mats.blocked.g},${mats.blocked.b})`;
  const top = `rgb(${mats.light.r},${mats.light.g},${mats.light.b})`;
  const side = `rgb(${mats.dark.r},${mats.dark.g},${mats.dark.b})`;
  ctx.save();
  ctx.translate(sx + ox, sy + TILE_H * z * 0.42 + oy);
  ctx.fillStyle = "rgba(6,10,12,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 6 * z, 16 * z, 5 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(-14 * z, 2 * z);
  ctx.lineTo(13 * z, 3 * z);
  ctx.lineTo(9 * z, 9 * z);
  ctx.lineTo(-11 * z, 8 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-12 * z, 2 * z);
  ctx.lineTo(-3 * z, -11 * z);
  ctx.lineTo(12 * z, -1 * z);
  ctx.lineTo(8 * z, 5 * z);
  ctx.lineTo(-9 * z, 5 * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = top;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(-3 * z, -11 * z);
  ctx.lineTo(12 * z, -1 * z);
  ctx.lineTo(4 * z, 1 * z);
  ctx.lineTo(-7 * z, -6 * z);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function rgbMix(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): string {
  return rgbCss(mixTone(a, b, t));
}

function drawOreCrystals(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
  elev: number,
  z: number,
): void {
  const cluster = oreCrystalCluster(state, x, y);
  if (!cluster) return;
  const mats = biomeMaterials(state.biome);
  const s = tileToScreen(x, y, cam, elev);
  const gemDark = rgbMix(mats.ore, mats.dark, 0.42);
  const gem = rgbMix(mats.ore, mats.light, 0.38);
  const gemHi = rgbMix(mats.light, { r: 255, g: 246, b: 210 }, 0.62);
  ctx.save();
  ctx.translate(s.x, s.y);
  const alpha = ctx.globalAlpha;
  ctx.fillStyle = `rgb(${mats.dark.r},${mats.dark.g},${mats.dark.b})`;
  for (const burst of cluster.bursts) {
    ctx.globalAlpha = alpha * 0.32;
    ctx.beginPath();
    ctx.ellipse(burst.dx * z, burst.dy * z + 1.1 * z, 6.2 * z, 2.35 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  for (const shard of cluster.shards) {
    const ox = shard.dx * z;
    const oy = shard.dy * z;
    const tipX = ox + shard.lean * z;
    const tipY = oy - shard.rise * z;
    const vx = tipX - ox;
    const vy = tipY - oy;
    const len = Math.hypot(vx, vy);
    if (len < 0.5 * z) continue;
    const ux = vx / len;
    const uy = vy / len;
    const px = -uy;
    const py = ux;
    const half = shard.half * z;
    const buried = shard.buried * z;
    const midT = 0.34 + shard.twist * 0.05;
    const bx = ox - ux * buried;
    const by = oy - uy * buried;
    const mx = bx + (tipX - bx) * midT;
    const my = by + (tipY - by) * midT;
    const ntx = tipX - ux * 0.55 * z;
    const nty = tipY - uy * 0.55 * z;
    const baseW = half * 0.42;
    const midW = half;
    const tipW = half * 0.16;
    const baseL = { x: bx + px * baseW, y: by + py * baseW };
    const baseR = { x: bx - px * baseW, y: by - py * baseW };
    const midL = { x: mx + px * midW, y: my + py * midW };
    const midR = { x: mx - px * midW, y: my - py * midW };
    const tipL = { x: ntx + px * tipW, y: nty + py * tipW };
    const tipR = { x: ntx - px * tipW, y: nty - py * tipW };
    ctx.fillStyle = gemDark;
    ctx.beginPath();
    ctx.moveTo(baseL.x, baseL.y);
    ctx.lineTo(midL.x, midL.y);
    ctx.lineTo(tipL.x, tipL.y);
    ctx.lineTo(tipR.x, tipR.y);
    ctx.lineTo(midR.x, midR.y);
    ctx.lineTo(baseR.x, baseR.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.moveTo(baseL.x, baseL.y);
    ctx.lineTo(midL.x, midL.y);
    ctx.lineTo(tipL.x, tipL.y);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(bx + ux * buried * 0.2, by + uy * buried * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gemHi;
    ctx.globalAlpha = alpha * 0.7;
    const hx = bx + ux * len * 0.14;
    const hy = by + uy * len * 0.14;
    ctx.beginPath();
    ctx.moveTo(hx + px * half * 0.12, hy + py * half * 0.12);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(hx - px * half * 0.22, hy - py * half * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha * 0.82;
    ctx.strokeStyle = gemHi;
    ctx.lineWidth = Math.max(0.65, 0.55 * z);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
}

function wetBankColors(
  base: ReturnType<typeof cliffFaces>,
  mats: ReturnType<typeof biomeMaterials>,
  waterE: boolean,
  waterS: boolean,
): ReturnType<typeof cliffFaces> {
  const wet = `rgb(${Math.max(0, mats.waterDeep.r - 6)},${Math.max(0, mats.waterDeep.g - 4)},${Math.min(255, mats.waterDeep.b + 4)})`;
  return {
    south: waterS ? wet : base.south,
    east: waterE ? wet : base.east,
    southInk: base.southInk,
    eastInk: base.eastInk,
  };
}

function paintCell(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  atlas: TerrainAtlas,
  x: number,
  y: number,
  waterPass: boolean,
): void {
  const scenery = memoScenery(state, x, y);
  const water = scenery.kind === TILE_WATER;
  if (water !== waterPass) return;
  const elev = scenery.elev;
  const s = tileToScreen(x, y, cam, elev);
  const z = cam.zoom;
  const tw = TILE_W * z;
  const th = TILE_H * z;
  const inMap = x >= 0 && y >= 0 && x < state.width && y < state.height;
  const concrete = inMap && state.surfaces[y * state.width + x] === SURFACE_CONCRETE;
  const cover = expandIsoDiamond(s.x, s.y, tw, th, concrete ? 1 : water ? WATER_COVER : TERRAIN_COVER);
  const eastSc = memoScenery(state, x + 1, y);
  const southSc = memoScenery(state, x, y + 1);
  const dropE = water ? 0 : Math.max(0, elev - eastSc.elev);
  const dropS = water ? 0 : Math.max(0, elev - southSc.elev);
  const gain = smoothFogGain(state, x, y);

  if (!water && (elev >= 2 || dropE > 0 || dropS > 0)) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.28, 0.1 + elev * 0.03 + (dropE + dropS) * 0.04) * gain;
    ctx.fillStyle = "#071014";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + th * 0.58 + HEIGHT_STEP * z * 0.1, tw * 0.42, th * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (dropE > 0 || dropS > 0) {
    ctx.save();
    drawElevationFaces(
      ctx,
      s.x,
      s.y,
      tw,
      th,
      HEIGHT_STEP * z,
      dropE,
      dropS,
      tileVariant(state.seed, x, y),
      wetBankColors(
        cliffFaces(state.biome, elev, generateCampaignVisualProfile(state.seed)),
        biomeMaterials(state.biome),
        eastSc.kind === TILE_WATER,
        southSc.kind === TILE_WATER,
      ),
      x,
      y,
    );
    ctx.restore();
  }

  ctx.save();
  isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
  ctx.clip();
  if (concrete) {
    drawConcreteSlab(ctx, s.x, s.y, tw, th, z, tileVariant(state.seed, x, y), 1);
  } else if (atlas.canvas) {
    drawAtlasDiamond(ctx, atlas, x, y, s.x, s.y, tw, th);
  } else {
    const mats = biomeMaterials(state.biome);
    ctx.fillStyle = water
      ? `rgb(${mats.waterMid.r},${mats.waterMid.g},${mats.waterMid.b})`
      : `rgb(${mats.mid.r},${mats.mid.g},${mats.mid.b})`;
    isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
    ctx.fill();
  }
  ctx.restore();
}

function paintCellProps(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
): void {
  const inMap = x >= 0 && y >= 0 && x < state.width && y < state.height;
  if (!inMap || fogAt(state, x, y) === 0) return;
  const scenery = memoScenery(state, x, y);
  const elev = scenery.elev;
  const s = tileToScreen(x, y, cam, elev);
  const z = cam.zoom;
  const gain = smoothFogGain(state, x, y);
  ctx.save();
  ctx.globalAlpha = gain;
  if (scenery.kind === TILE_BLOCKED && !isMountainScenery(scenery)) {
    drawBlockerProp(ctx, state, x, y, s.x, s.y, z);
  }
  if (state.tiles[y * state.width + x] === TILE_RESOURCE) {
    drawOreCrystals(ctx, state, cam, x, y, elev, z);
  }
  ctx.restore();
}

function visitVisibleTiles(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  visit: (x: number, y: number) => void,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const margin = TILE_W * cam.zoom * 2;
  const x0 = -MAP_SKIRT;
  const y0 = -MAP_SKIRT;
  const x1 = state.width + MAP_SKIRT;
  const y1 = state.height + MAP_SKIRT;
  const depth0 = x0 + y0;
  const depth1 = (x1 - 1) + (y1 - 1);
  for (let depth = depth0; depth <= depth1; depth++) {
    const xs = Math.max(x0, depth - (y1 - 1));
    const xe = Math.min(x1 - 1, depth - y0);
    for (let x = xs; x <= xe; x++) {
      const y = depth - x;
      const elev = memoScenery(state, x, y).elev;
      const s = tileToScreen(x, y, cam, elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      visit(x, y);
    }
  }
}

let shroudMask: HTMLCanvasElement | null = null;

function paintShroudLayer(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const z = cam.zoom;
  const tw = TILE_W * z;
  const th = TILE_H * z;
  const step = HEIGHT_STEP * z;
  if (typeof document === "undefined") {
    visitVisibleTiles(ctx, state, cam, (x, y) => {
      const scenery = memoScenery(state, x, y);
      const s = tileToScreen(x, y, cam, scenery.elev);
      const dropE = Math.max(0, scenery.elev - memoScenery(state, x + 1, y).elev);
      const dropS = Math.max(0, scenery.elev - memoScenery(state, x, y + 1).elev);
      paintShroudOverlay(ctx, s.x, s.y, tw, th, dropE, dropS, step, smoothFogGain(state, x, y), z, x, y, tileVariant(state.seed, x, y));
    });
    return;
  }
  if (!shroudMask) shroudMask = document.createElement("canvas");
  if (shroudMask.width !== w || shroudMask.height !== h) {
    shroudMask.width = w;
    shroudMask.height = h;
  }
  const fog = shroudMask.getContext("2d");
  if (!fog) {
    visitVisibleTiles(ctx, state, cam, (x, y) => {
      const scenery = memoScenery(state, x, y);
      const s = tileToScreen(x, y, cam, scenery.elev);
      const dropE = Math.max(0, scenery.elev - memoScenery(state, x + 1, y).elev);
      const dropS = Math.max(0, scenery.elev - memoScenery(state, x, y + 1).elev);
      paintShroudOverlay(ctx, s.x, s.y, tw, th, dropE, dropS, step, smoothFogGain(state, x, y), z, x, y, tileVariant(state.seed, x, y));
    });
    return;
  }
  fog.setTransform(1, 0, 0, 1, 0, 0);
  fog.globalCompositeOperation = "source-over";
  fog.globalAlpha = 1;
  fog.clearRect(0, 0, w, h);
  const overlay = 1 - fogTerrainGain(0);
  fog.fillStyle = `rgba(8, 13, 17, ${overlay})`;
  fog.fillRect(0, 0, w, h);
  fog.globalCompositeOperation = "destination-out";
  visitVisibleTiles(ctx, state, cam, (x, y) => {
    const scenery = memoScenery(state, x, y);
    const s = tileToScreen(x, y, cam, scenery.elev);
    const dropE = Math.max(0, scenery.elev - memoScenery(state, x + 1, y).elev);
    const dropS = Math.max(0, scenery.elev - memoScenery(state, x, y + 1).elev);
    paintShroudMaskTile(fog, s.x, s.y, tw, th, dropE, dropS, step, smoothFogGain(state, x, y), z, x, y, tileVariant(state.seed, x, y));
  });
  fog.globalCompositeOperation = "source-over";
  fog.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(shroudMask, 0, 0);
  ctx.restore();
}

export function paintTerrainWorld(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  sceneryMemo.clear();
  const atlas = getTerrainAtlas(state);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = SHROUD_FILL;
  ctx.fillRect(0, 0, w, h);

  visitVisibleTiles(ctx, state, cam, (x, y) => {
    paintCell(ctx, state, cam, atlas, x, y, false);
  });
  visitVisibleTiles(ctx, state, cam, (x, y) => {
    paintCell(ctx, state, cam, atlas, x, y, true);
  });
  paintShroudLayer(ctx, state, cam);
  visitVisibleTiles(ctx, state, cam, (x, y) => {
    paintCellProps(ctx, state, cam, x, y);
  });
}

export function paintBuildingPlates(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  footprintOf: (kind: BuildingKind) => { w: number; h: number },
  entityVisible: (state: SimState, e: Entity) => boolean,
  entityElev: (state: SimState, e: Entity) => number,
): void {
  const z = cam.zoom;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "building" || !entityVisible(state, e)) continue;
    const fog = fogAt(state, Math.round(e.x), Math.round(e.y));
    if (fog === 0) continue;
    const fp = footprintOf(e.kind as BuildingKind);
    const alpha = fogTerrainGain(fog) * 0.92;
    const elev = entityElev(state, e);
    const tw = TILE_W * z;
    const th = TILE_H * z;
    const ox0 = Math.round(e.x);
    const oy0 = Math.round(e.y);
    for (let oy = 0; oy < fp.h; oy++) {
      for (let ox = 0; ox < fp.w; ox++) {
        const tx = ox0 + ox;
        const ty = oy0 + oy;
        const p = tileToScreen(tx, ty, cam, elev);
        drawConcreteSlab(ctx, p.x, p.y, tw, th, z, tileVariant(state.seed, tx, ty), alpha);
      }
    }
  }
}
