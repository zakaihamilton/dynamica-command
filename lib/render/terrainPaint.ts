import { cliffFaces, drawElevationFaces } from "../gen/assets";
import { MAP_SKIRT, isMountainScenery, sceneryAt, type ScenerySample } from "../gen/map";
import { generateCampaignVisualProfile } from "../gen/visualProfile";
import type { BuildingKind, Entity, SimState } from "../types";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";
import { fogAt } from "../sim/fog";
import { HEIGHT_STEP, TILE_H, TILE_W, tileToScreen, type Camera } from "./iso";
import {
  atlasRectForTile,
  biomeMaterials,
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
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return `rgb(${Math.round(a.r + (b.r - a.r) * u)},${Math.round(a.g + (b.g - a.g) * u)},${Math.round(a.b + (b.b - a.b) * u)})`;
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
  for (const shard of cluster.shards) {
    const dx = shard.dx * z;
    const dy = shard.dy * z;
    const lean = shard.lean * z;
    const rise = shard.rise * z;
    const half = shard.half * z;
    const buried = shard.buried * z;
    const tipX = dx + lean;
    const tipY = dy - rise;
    ctx.globalAlpha = alpha * 0.38;
    ctx.fillStyle = `rgb(${mats.dark.r},${mats.dark.g},${mats.dark.b})`;
    ctx.beginPath();
    ctx.ellipse(dx, dy + 1.2 * z, half * 1.7, half * 0.48, lean * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx - half * 5, dy - rise - 8 * z, half * 10, rise + 2.4 * z);
    ctx.clip();
    ctx.fillStyle = gemDark;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(dx + half, dy + 1.6 * z);
    ctx.lineTo(dx + half * 0.2, dy + buried);
    ctx.lineTo(dx - half * 0.12, dy + buried);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(dx - half, dy + 1.6 * z);
    ctx.lineTo(dx - half * 0.18, dy + buried);
    ctx.lineTo(dx + half * 0.2, dy + buried);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gemHi;
    ctx.globalAlpha = alpha * 0.72;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(dx - half * 0.22, dy + 0.8 * z);
    ctx.lineTo(dx + half * 0.1, dy + 0.8 * z);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = gemHi;
    ctx.lineWidth = Math.max(1, 0.85 * z);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(dx - half * 0.18, dy + 0.4 * z);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function paintCell(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  atlas: TerrainAtlas,
  x: number,
  y: number,
): void {
  const scenery = memoScenery(state, x, y);
  const elev = scenery.elev;
  const s = tileToScreen(x, y, cam, elev);
  const z = cam.zoom;
  const tw = TILE_W * z;
  const th = TILE_H * z;
  const overlap = 1.14;
  const east = memoScenery(state, x + 1, y).elev;
  const south = memoScenery(state, x, y + 1).elev;
  const dropE = Math.max(0, elev - east);
  const dropS = Math.max(0, elev - south);
  const gain = smoothFogGain(state, x, y);

  if (elev >= 2 || dropE > 0 || dropS > 0) {
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
    ctx.globalAlpha = gain;
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
      cliffFaces(state.biome, elev, generateCampaignVisualProfile(state.seed)),
    );
    ctx.restore();
  }

  ctx.save();
  isoDiamondPath(ctx, s.x, s.y, tw * overlap, th * overlap);
  ctx.clip();
  const destW = tw * overlap;
  const destH = th * overlap;
  const dx = s.x - destW / 2;
  const dy = s.y;
  if (atlas.canvas) {
    const rect = atlasRectForTile(x, y, state.width);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(atlas.canvas, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, destW, destH);
  } else {
    const mats = biomeMaterials(state.biome);
    ctx.fillStyle = scenery.kind === TILE_WATER
      ? `rgb(${mats.waterMid.r},${mats.waterMid.g},${mats.waterMid.b})`
      : `rgb(${mats.mid.r},${mats.mid.g},${mats.mid.b})`;
    ctx.fillRect(dx, dy, destW, destH);
  }
  if (gain < 0.98) {
    ctx.globalAlpha = 1 - gain;
    ctx.fillStyle = "#080d11";
    ctx.fillRect(dx, dy, destW, destH);
  }
  ctx.restore();

  const inMap = x >= 0 && y >= 0 && x < state.width && y < state.height;
  if (!inMap || fogAt(state, x, y) === 0) return;
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

export function paintTerrainWorld(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  sceneryMemo.clear();
  const atlas = getTerrainAtlas(state);
  const mats = biomeMaterials(state.biome);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = `rgb(${mats.dark.r},${mats.dark.g},${mats.dark.b})`;
  ctx.fillRect(0, 0, w, h);

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
      paintCell(ctx, state, cam, atlas, x, y);
    }
  }
}

export function paintBuildingPlates(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  footprintOf: (kind: BuildingKind) => { w: number; h: number },
  entityVisible: (state: SimState, e: Entity) => boolean,
  entityElev: (state: SimState, e: Entity) => number,
): void {
  const mats = biomeMaterials(state.biome);
  const z = cam.zoom;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "building" || !entityVisible(state, e)) continue;
    const fog = fogAt(state, Math.round(e.x), Math.round(e.y));
    if (fog === 0) continue;
    const fp = footprintOf(e.kind as BuildingKind);
    const alpha = fogTerrainGain(fog) * 0.92;
    const elev = entityElev(state, e);
    const n = tileToScreen(e.x, e.y, cam, elev);
    const east = tileToScreen(e.x + fp.w - 1, e.y, cam, elev);
    const south = tileToScreen(e.x + fp.w - 1, e.y + fp.h - 1, cam, elev);
    const west = tileToScreen(e.x, e.y + fp.h - 1, cam, elev);
    const tw = TILE_W * z;
    const th = TILE_H * z;
    ctx.save();
    ctx.globalAlpha = alpha * 0.88;
    ctx.fillStyle = `rgb(${mats.concrete.r},${mats.concrete.g},${mats.concrete.b})`;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(east.x + tw / 2, east.y + th / 2);
    ctx.lineTo(south.x, south.y + th);
    ctx.lineTo(west.x - tw / 2, west.y + th / 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = `rgb(${mats.light.r},${mats.light.g},${mats.light.b})`;
    ctx.beginPath();
    ctx.moveTo(n.x, n.y + 2 * z);
    ctx.lineTo(east.x + tw / 2 - 4 * z, east.y + th / 2);
    ctx.lineTo(n.x + 6 * z, n.y + th * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
