import { BUILDING_STATS, TICKS_PER_SECOND, UNIT_STATS, footprintOf, labelFor, sellRefundFor } from "../catalog";
import { cliffFaces, drawElevationFaces, buildingSprite, rubbleSprite, terrainFieldPalette, tileSprite, tileSpriteId, TILE_SPRITE_PAD_X, TILE_SPRITE_PAD_Y, unitSprite, wreckSprite } from "../gen/assets";
import { generateCampaignVisualProfile, generateVisualProfile } from "../gen/visualProfile";
import { MAP_SKIRT, isMountainScenery, sceneryAt, type ScenerySample, type SceneryWorld } from "../gen/map";
import { RESCUE_CONTACT_RADIUS } from "../types";
import type { BuildingKind, CampaignVisualProfile, Entity, Facing, SimState, TileContour, UnitKind } from "../types";
import { SURFACE_CONCRETE, SURFACE_NONE, SURFACE_ROAD, TILE_BLOCKED, TILE_CLEAR, TILE_RESOURCE, TILE_WATER } from "../types";
import {
  animClock,
  buildingAnim,
  constructionProgress,
  facingVector,
  selectionPulse,
  toFacing,
  unitAnim,
  waterShimmer,
  type BuildingAnim,
} from "./anim";
import { HEIGHT_STEP, TILE_H, TILE_W, screenToGroundTile, tileToScreen, type Camera } from "./iso";
import { cachedSprite, drawSprite, rasterize } from "./sprites";
import { paintUnitMovementFx } from "./unitMotion";
import { buildingAt, canPlaceBuilding, groundHeight, heightAt, terrainAccess } from "../sim/world";
import { fogAt } from "../sim/fog";
import { canRepair } from "../sim/repair";
import { canSell } from "../sim/sell";
import { fxProgress, isBuildingKind, isUnitKind, type FxBurst } from "./fx";

const TERRAIN_RENDER_REV = "continuous-landforms-v10-coherent-surface";

function entityElev(state: SimState, e: Entity): number {
  return e.class === "unit" ? groundHeight(state, e.x, e.y) : heightAt(state, Math.round(e.x), Math.round(e.y));
}

function tileKind(t: number): "clear" | "water" | "resource" | "blocked" {
  if (t === TILE_WATER) return "water";
  if (t === TILE_RESOURCE) return "resource";
  if (t === TILE_BLOCKED) return "blocked";
  return "clear";
}

function tileVariant(seed: number, x: number, y: number): number {
  return ((seed * 83492791) ^ (x * 73856093) ^ (y * 19349663)) >>> 0;
}

function terrainVariant(seed: number, x: number, y: number): number {
  const local = tileVariant(seed, x, y) & 0xff;
  const region = tileVariant(seed, Math.floor(x / 4), Math.floor(y / 4)) & 0xffff;
  return local | (region << 8);
}

function surfaceBoundaryMask(state: SimState, x: number, y: number, surface: number): number {
  if (surface === SURFACE_NONE || x < 0 || y < 0 || x >= state.width || y >= state.height) return 0;
  const dirs: Array<[number, number, number]> = [
    [0, -1, 1],
    [1, 0, 2],
    [0, 1, 4],
    [-1, 0, 8],
  ];
  let mask = 0;
  for (const [dx, dy, bit] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height || state.surfaces[ny * state.width + nx] !== surface) {
      mask |= bit;
    }
  }
  return mask;
}

function pointInDiamond(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  const cx = x;
  const cy = y + h / 2;
  return Math.abs(px - cx) / (w / 2) + Math.abs(py - cy) / (h / 2) <= 1.02;
}

export function pickTile(
  state: SimState,
  sx: number,
  sy: number,
  cam: Camera,
): { x: number; y: number } | null {
  // Bring the pointer back to the base plane, then test actual raised tile tops.
  // This avoids a cliff face stealing a click intended for the tile behind it.
  const maxElev = 3;
  const g = screenToGroundTile(sx, sy + maxElev * HEIGHT_STEP * cam.zoom, cam);
  const cx = Math.round(g.x);
  const cy = Math.round(g.y);
  let best: { x: number; y: number } | null = null;
  let bestDepth = -Infinity;
  const tw = TILE_W * cam.zoom;
  const th = TILE_H * cam.zoom;
  const r = 4;
  const x0 = Math.max(0, cx - r);
  const y0 = Math.max(0, cy - r);
  const x1 = Math.min(state.width - 1, cx + r);
  const y1 = Math.min(state.height - 1, cy + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const elev = heightAt(state, x, y);
      const s = tileToScreen(x, y, cam, elev);
      if (!pointInDiamond(sx, sy, s.x, s.y, tw, th)) continue;
      // Terrain is painted in x + y order. Prefer the front-most top surface,
      // and resolve same-depth overlaps in favor of the raised tactical tile.
      const depth = (x + y) * 16 + elev;
      if (depth >= bestDepth) {
        bestDepth = depth;
        best = { x, y };
      }
    }
  }
  return best;
}

function entityVisible(state: SimState, e: Entity): boolean {
  const tx = Math.round(e.x);
  const ty = Math.round(e.y);
  const fog = fogAt(state, tx, ty);
  if (e.owner === 1 && fog !== 2) return false;
  return true;
}

function renderEntityOpacity(state: SimState, e: Entity, timeMs: number): number {
  if (e.owner === 0 || e.class !== "unit") return entityVisible(state, e) ? 1 : 0;
  const fog = fogAt(state, Math.round(e.x), Math.round(e.y));
  const target = fog === 2 ? 1 : fog === 1 ? 0.22 : 0;
  const previous = entityVisibility.get(e.id);
  if (!previous) {
    entityVisibility.set(e.id, { alpha: target, target, timeMs });
    return target;
  }
  if (previous.target !== target) previous.target = target;
  const elapsed = Math.max(0, timeMs - previous.timeMs);
  const blend = 1 - Math.exp(-elapsed / 120);
  previous.alpha += (previous.target - previous.alpha) * blend;
  previous.timeMs = timeMs;
  return previous.alpha;
}

export function visibleBuildingAt(state: SimState, x: number, y: number): Entity | undefined {
  if (fogAt(state, x, y) === 0) return undefined;
  const b = buildingAt(state, x, y);
  if (!b || b.hp <= 0 || !entityVisible(state, b)) return undefined;
  return b;
}

export function entityAtPointer(state: SimState, sx: number, sy: number, cam: Camera): Entity | undefined {
  const tile = pickTile(state, sx, sy, cam);
  let bestUnit: Entity | undefined;
  let bestD = 28 * cam.zoom;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit" || !entityVisible(state, e)) continue;
    const elev = groundHeight(state, e.x, e.y);
    const s = tileToScreen(e.x, e.y, cam, elev);
    const d = Math.hypot(sx - s.x, sy - (s.y + (TILE_H / 2) * cam.zoom - 12 * cam.zoom));
    if (d < bestD) {
      bestD = d;
      bestUnit = e;
    }
  }
  if (bestUnit) return bestUnit;
  if (!tile) return undefined;
  return visibleBuildingAt(state, tile.x, tile.y);
}

export type RenderExtras = {
  cursor?: { x: number; y: number } | null;
  placeKind?: BuildingKind | null;
  repairMode?: boolean;
  sellMode?: boolean;
  clockMs?: number;
  selectBox?: { x0: number; y0: number; x1: number; y1: number } | null;
  fx?: FxBurst[];
};

const sceneryMemo = new Map<number, ScenerySample>();
const entityById = new Map<number, Entity>();
const entityVisibility = new Map<number, { alpha: number; target: number; timeMs: number }>();
const drawList: Entity[] = [];

type TerrainLayer = {
  canvas: HTMLCanvasElement | null;
  skirt: HTMLCanvasElement | null;
  key: string;
};

const terrainLayer: TerrainLayer = { canvas: null, skirt: null, key: "" };
const campaignVisualMemo = new Map<number, CampaignVisualProfile>();

function campaignVisualFor(seed: number): CampaignVisualProfile {
  let profile = campaignVisualMemo.get(seed);
  if (!profile) {
    profile = generateCampaignVisualProfile(seed);
    campaignVisualMemo.set(seed, profile);
  }
  return profile;
}

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

function fogSignature(fog: number[]): number {
  let h = fog.length;
  for (let i = 0; i < fog.length; i += 11) h = (Math.imul(h, 33) + (fog[i] ?? 0)) | 0;
  return h;
}

function resourceSignature(amounts: number[]): number {
  let h = amounts.length;
  for (let i = 0; i < amounts.length; i += 9) h = (h + (amounts[i] ?? 0)) | 0;
  return h;
}

function terrainCacheKey(state: SimState, cam: Camera, w: number, h: number): string {
  return `${TERRAIN_RENDER_REV}:${state.seed}:${state.missionIndex}:${w}x${h}:${cam.x | 0}:${cam.y | 0}:${cam.zoom}:${fogSignature(state.fog)}:${resourceSignature(state.resourceAmount)}`;
}

function ensureOffscreen(slot: "canvas" | "skirt", w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  let canvas = terrainLayer[slot];
  if (!canvas) {
    canvas = document.createElement("canvas");
    terrainLayer[slot] = canvas;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    if (slot === "canvas") terrainLayer.key = "";
  }
  return canvas;
}

function ensureTerrainCanvas(w: number, h: number): HTMLCanvasElement | null {
  return ensureOffscreen("canvas", w, h);
}

function paddedTerrainPresent(state: SceneryWorld, x: number, y: number): boolean {
  if (x >= 0 && y >= 0 && x < state.width && y < state.height) return true;
  const dx = x < 0 ? -x : x >= state.width ? x - state.width + 1 : 0;
  const dy = y < 0 ? -y : y >= state.height ? y - state.height + 1 : 0;
  const distance = Math.max(dx, dy);
  if (distance > MAP_SKIRT || distance <= 2) return distance <= MAP_SKIRT;
  const sample = sceneryAt(state, x, y);
  const seedNoise = (tileVariant(state.seed ?? 0, x, y) % 100) / 100;
  const materialBias = sample.kind === TILE_WATER ? 0.58 : sample.elev >= 2 ? 0.88 : 0.72;
  const falloff = 1 - ((distance - 2) / Math.max(1, MAP_SKIRT - 2)) * 0.42;
  return seedNoise < materialBias * falloff;
}

export function terrainContourMapPoints(state: SceneryWorld): Array<{ x: number; y: number }> {
  const edgeCountX = Math.max(24, Math.ceil(state.width / 2));
  const edgeCountY = Math.max(24, Math.ceil(state.height / 2));
  const points: Array<{ x: number; y: number }> = [];
  const edgeDepth = (axis: "x" | "y", index: number, count: number, side: -1 | 1): number => {
    const value = count <= 0 ? 0 : index / count;
    const coordinate = axis === "x"
      ? Math.round(value * state.width)
      : Math.round(value * state.height);
    let depth = 1;
    for (let d = 1; d <= MAP_SKIRT; d++) {
      const x = axis === "x"
        ? coordinate
        : side < 0 ? -d : state.width - 1 + d;
      const y = axis === "x"
        ? side < 0 ? -d : state.height - 1 + d
        : coordinate;
      if (!paddedTerrainPresent(state, x, y)) break;
      depth = d;
    }
    return depth;
  };
  const addEdge = (axis: "x" | "y", count: number, point: (t: number, depth: number) => { x: number; y: number }, side: -1 | 1) => {
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      points.push(point(t, edgeDepth(axis, i, count, side)));
    }
  };
  addEdge("x", edgeCountX, (t, depth) => ({ x: t * state.width, y: -depth }), -1);
  addEdge("y", edgeCountY, (t, depth) => ({ x: state.width - 1 + depth, y: t * state.height }), 1);
  addEdge("x", edgeCountX, (t, depth) => ({ x: state.width - t * state.width, y: state.height - 1 + depth }), 1);
  addEdge("y", edgeCountY, (t, depth) => ({ x: -depth, y: state.height - t * state.height }), -1);
  return points;
}

function mapSilhouettePoints(state: SimState, cam: Camera): Array<{ x: number; y: number }> {
  return terrainContourMapPoints(state).map((point) => tileToScreen(point.x, point.y, cam, 0));
}

function smoothClosedPath(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>): void {
  if (!points.length) return;
  const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const start = midpoint(last, first);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    const next = points[(i + 1) % points.length]!;
    const mid = midpoint(point, next);
    ctx.quadraticCurveTo(point.x, point.y, mid.x, mid.y);
  }
  ctx.closePath();
}

function paintTerrainField(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  const colors = terrainFieldPalette(state.biome, campaignVisualFor(state.seed));
  const x0 = -MAP_SKIRT;
  const y0 = -MAP_SKIRT;
  const x1 = state.width + MAP_SKIRT;
  const y1 = state.height + MAP_SKIRT;
  const nw = tileToScreen(x0, y0, cam, 0);
  const se = tileToScreen(x1, y1, cam, 0);

  ctx.save();
  ctx.globalAlpha = 0.9;
  smoothClosedPath(ctx, mapSilhouettePoints(state, cam));
  ctx.clip();

  const gradient = ctx.createLinearGradient(nw.x, nw.y, se.x, se.y);
  gradient.addColorStop(0, colors.light);
  gradient.addColorStop(0.35, colors.base);
  gradient.addColorStop(0.72, colors.base);
  gradient.addColorStop(1, colors.dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Soft radial zones establish broad material changes without hard polygon
  // edges. The centers are seeded in map space, but the gradients are painted
  // in screen space so no zone can be mistaken for a logical tile.
  for (let i = 0; i < 5; i++) {
    const px = x0 + 3 + ((tileVariant(state.seed, i, 31) >>> 0) % Math.max(1, state.width + MAP_SKIRT * 2 - 6));
    const py = y0 + 3 + ((tileVariant(state.seed, i, 47) >>> 0) % Math.max(1, state.height + MAP_SKIRT * 2 - 6));
    const p = tileToScreen(px, py, cam, 0);
    const rx = TILE_W * (4.5 + (i % 4) * 1.6) * cam.zoom;
    const ry = TILE_H * (3.2 + (i % 3) * 0.9) * cam.zoom;
    const radius = Math.max(rx, ry);
    const tone = i % 3 === 0 ? colors.dark : i % 3 === 1 ? colors.light : colors.base;
    const zone = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    zone.addColorStop(0, tone);
    zone.addColorStop(0.48, tone);
    zone.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.045 + (i % 3) * 0.012;
    ctx.fillStyle = zone;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, (i % 5 - 2) * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function terrainAdornmentAccent(biome: SimState["biome"]): string {
  if (biome === "tundra grid") return "#b8d9d3";
  if (biome === "crystal flats") return "#8ed9cb";
  if (biome === "rust canyons") return "#b86f46";
  if (biome === "volcanic shelf") return "#d06a3c";
  if (biome === "glass desert") return "#c8b486";
  if (biome === "jungle wreckage") return "#6c9b5b";
  if (biome === "salt marshes") return "#8ea878";
  return "#9ca69d";
}

export function shouldRenderTerrainAdornment(state: SimState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false;
  if (fogAt(state, x, y) === 0) return false;
  if (state.tiles[y * state.width + x] !== TILE_CLEAR) return false;
  return (state.surfaces[y * state.width + x] ?? SURFACE_NONE) === SURFACE_NONE;
}

function paintTerrainAdornments(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  const colors = terrainFieldPalette(state.biome, campaignVisualFor(state.seed));
  const accent = terrainAdornmentAccent(state.biome);
  const z = cam.zoom;

  ctx.save();
  for (let i = 0; i < 36; i++) {
    const gx = 1 + ((tileVariant(state.seed, i, 101) >>> 0) % Math.max(1, state.width - 2));
    const gy = 1 + ((tileVariant(state.seed, i, 131) >>> 0) % Math.max(1, state.height - 2));
    if (!shouldRenderTerrainAdornment(state, gx, gy)) continue;
    const p = tileToScreen(gx, gy, cam, 0);
    const size = (3.5 + ((tileVariant(state.seed, i, 151) >>> 0) % 5)) * z;
    const drift = (((tileVariant(state.seed, i, 181) >>> 0) % 100) / 100 - 0.5) * size;

    // Every adornment starts with a soft contact patch, then branches into a
    // small cluster. The shapes are deliberately screen-space and irregular,
    // so they read as material deposits rather than tile decals.
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = colors.dark;
    ctx.beginPath();
    ctx.ellipse(p.x + drift, p.y + size * 0.45, size * 1.55, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (state.biome === "tundra grid" || state.biome === "crystal flats") {
      ctx.globalAlpha = 0.46;
      ctx.fillStyle = accent;
      for (let shard = 0; shard < 3; shard++) {
        const ox = (shard - 1) * size * 0.72;
        const h = size * (0.8 + shard * 0.18);
        ctx.beginPath();
        ctx.moveTo(p.x + ox - size * 0.42, p.y + size * 0.25);
        ctx.lineTo(p.x + ox, p.y - h);
        ctx.lineTo(p.x + ox + size * 0.48, p.y + size * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = colors.light;
      ctx.beginPath();
      ctx.ellipse(p.x - size * 0.35, p.y - size * 0.15, size * 0.65, size * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (state.biome === "jungle wreckage" || state.biome === "salt marshes") {
      ctx.globalAlpha = 0.48;
      ctx.fillStyle = accent;
      for (let clump = 0; clump < 3; clump++) {
        ctx.beginPath();
        ctx.ellipse(
          p.x + (clump - 1) * size * 0.68,
          p.y - (clump % 2) * size * 0.45,
          size * (0.8 - clump * 0.08),
          size * 0.42,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = colors.light;
      ctx.beginPath();
      ctx.ellipse(p.x + size * 0.35, p.y - size * 0.7, size * 0.45, size * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (state.biome === "volcanic shelf" || state.biome === "ash plains") {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = colors.dark;
      ctx.beginPath();
      ctx.moveTo(p.x - size * 1.2, p.y + size * 0.25);
      ctx.lineTo(p.x - size * 0.35, p.y - size * 0.72);
      ctx.lineTo(p.x + size * 1.18, p.y - size * 0.18);
      ctx.lineTo(p.x + size * 0.5, p.y + size * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(p.x + size * 0.35, p.y - size * 0.2, size * 0.45, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(p.x - size * 1.2, p.y + size * 0.25);
      ctx.lineTo(p.x - size * 0.42, p.y - size * 0.7);
      ctx.lineTo(p.x + size * 1.16, p.y - size * 0.05);
      ctx.lineTo(p.x + size * 0.42, p.y + size * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = colors.light;
      ctx.beginPath();
      ctx.ellipse(p.x - size * 0.1, p.y - size * 0.35, size * 0.58, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function paintFogOverlay(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  const x0 = 0;
  const y0 = 0;
  const x1 = state.width;
  const y1 = state.height;
  ctx.save();
  // Fog should recede into the scene art instead of becoming a second black
  // battlefield silhouette. Keep the logical cell mask for reveal/picking,
  // but use a translucent blue-green atmosphere so the biome remains visible.
  ctx.fillStyle = "#1b3035";
  for (const fog of [0, 1] as const) {
    ctx.beginPath();
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (fogAt(state, x, y) !== fog) continue;
        // The field underneath is screen-space, so use the unraised logical
        // diamond here. Restrict the mask to real map cells so the padded
        // terrain skirt remains atmospheric instead of becoming a black slab.
        appendRegionDiamondPath(ctx, regionDiamond(x, y, cam, 0));
      }
    }
    ctx.globalAlpha = fog === 0 ? 0.32 : 0.14;
    ctx.fill();
  }
  ctx.restore();
}

function drawBuildingPlates(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  const colors = terrainFieldPalette(state.biome, campaignVisualFor(state.seed));
  const z = cam.zoom;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "building" || !entityVisible(state, e)) continue;
    const fog = fogAt(state, Math.round(e.x), Math.round(e.y));
    if (fog === 0) continue;
    const fp = footprintOf(e.kind as BuildingKind);
    const alpha = fog === 1 ? 0.42 : 1;
    const center = tileToScreen(e.x + (fp.w - 1) / 2, e.y + (fp.h - 1) / 2, cam, entityElev(state, e));

    ctx.save();
    ctx.globalAlpha = alpha * 0.38;
    ctx.fillStyle = "#03090c";
    ctx.translate(5 * z, 6 * z);
    footprintPath(ctx, state, cam, e.x - 1, e.y - 1, fp.w + 2, fp.h + 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha * 0.86;
    ctx.fillStyle = colors.dark;
    footprintPath(ctx, state, cam, e.x - 1, e.y - 1, fp.w + 2, fp.h + 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = colors.base;
    footprintPath(ctx, state, cam, e.x, e.y, fp.w, fp.h);
    ctx.fill();

    // Corner inserts and a front service apron give the structure a grounded
    // deployment footprint without outlining it as another tile grid.
    const spreadX = (fp.w + 1.4) * TILE_W * z * 0.27;
    const spreadY = (fp.h + 1.4) * TILE_H * z * 0.28;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = colors.light;
    for (const [dx, dy, scale] of [[-1, -0.45, 0.8], [0.95, 0.35, 0.68], [-0.35, 0.72, 0.58]] as const) {
      ctx.beginPath();
      ctx.ellipse(center.x + dx * spreadX, center.y + dy * spreadY, 4 * z * scale, 1.8 * z * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha * 0.62;
    ctx.fillStyle = colors.dark;
    ctx.beginPath();
    ctx.ellipse(center.x + spreadX * 0.18, center.y + spreadY * 1.22, spreadX * 0.45, spreadY * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function regionDiamond(
  x: number,
  y: number,
  cam: Camera,
  elev: number,
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const top = tileToScreen(x, y, cam, elev);
  const right = tileToScreen(x + 1, y, cam, elev);
  const bottom = tileToScreen(x + 1, y + 1, cam, elev);
  const left = tileToScreen(x, y + 1, cam, elev);
  return [top, right, bottom, left];
}

function appendRegionDiamondPath(
  ctx: CanvasRenderingContext2D,
  points: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
): void {
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function landformColors(state: SimState): {
  water: string;
  waterEdge: string;
  ridge: string;
  ridgeEdge: string;
  road: string;
  concrete: string;
} {
  const colors = terrainFieldPalette(state.biome, campaignVisualFor(state.seed));
  const water = state.biome === "glass desert" || state.biome === "rust canyons" ? "#244953" : "#1c4b50";
  const waterEdge = state.biome === "tundra grid" ? "#a5c8bd" : "#6b978b";
  const road = state.biome === "tundra grid" ? "#486b70" : state.biome === "volcanic shelf" ? "#593832" : "#69523e";
  const concrete = state.biome === "glass desert" ? "#8a7c61" : colors.dark;
  return {
    water,
    waterEdge,
    ridge: colors.dark,
    ridgeEdge: colors.base,
    road,
    concrete,
  };
}

function paintContinuousRegion(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  matches: (x: number, y: number, kind: number, elev: number) => boolean,
  fill: string,
  edge: string,
  alpha: number,
): void {
  const x0 = -MAP_SKIRT;
  const y0 = -MAP_SKIRT;
  const x1 = state.width + MAP_SKIRT;
  const y1 = state.height + MAP_SKIRT;
  const z = cam.zoom;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineJoin = "round";
  for (const visible of [2, 1] as const) {
    const cells = new Set<string>();
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (fogAt(state, x, y) !== visible) continue;
        const scenery = memoScenery(state, x, y);
        if (matches(x, y, scenery.kind, scenery.elev)) cells.add(`${x},${y}`);
      }
    }

    const seen = new Set<string>();
    for (const seedKey of cells) {
      if (seen.has(seedKey)) continue;
      const component: Array<[number, number]> = [];
      const queue = [seedKey];
      seen.add(seedKey);
      while (queue.length) {
        const key = queue.pop()!;
        const comma = key.indexOf(",");
        const x = Number(key.slice(0, comma));
        const y = Number(key.slice(comma + 1));
        component.push([x, y]);
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
          const neighbor = `${x + dx},${y + dy}`;
          if (cells.has(neighbor) && !seen.has(neighbor)) {
            seen.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const componentSet = new Set(component.map(([x, y]) => `${x},${y}`));
      const edgeMap = new Map<string, Array<[number, number]>>();
      const addEdge = (a: [number, number], b: [number, number]) => {
        const key = `${a[0]},${a[1]}`;
        const edges = edgeMap.get(key) ?? [];
        edges.push(b);
        edgeMap.set(key, edges);
      };
      for (const [x, y] of component) {
        if (!componentSet.has(`${x},${y - 1}`)) addEdge([x, y], [x + 1, y]);
        if (!componentSet.has(`${x + 1},${y}`)) addEdge([x + 1, y], [x + 1, y + 1]);
        if (!componentSet.has(`${x},${y + 1}`)) addEdge([x + 1, y + 1], [x, y + 1]);
        if (!componentSet.has(`${x - 1},${y}`)) addEdge([x, y + 1], [x, y]);
      }

      const used = new Set<string>();
      for (const [startKey, starts] of edgeMap) {
        for (let edgeIndex = 0; edgeIndex < starts.length; edgeIndex++) {
          const firstEdgeKey = `${startKey}:${edgeIndex}`;
          if (used.has(firstEdgeKey)) continue;
          const [sx, sy] = startKey.split(",").map(Number) as [number, number];
          const logical: Array<[number, number]> = [[sx, sy]];
          let current: [number, number] = [sx, sy];
          let currentKey = startKey;
          let currentIndex = edgeIndex;
          for (let guard = 0; guard < edgeMap.size + component.length + 4; guard++) {
            const outgoing = edgeMap.get(currentKey);
            if (!outgoing || !outgoing[currentIndex]) break;
            const edgeKey = `${currentKey}:${currentIndex}`;
            used.add(edgeKey);
            current = outgoing[currentIndex]!;
            logical.push(current);
            currentKey = `${current[0]},${current[1]}`;
            if (currentKey === startKey) break;
            currentIndex = 0;
          }
          if (logical.length < 4 || logical[logical.length - 1]![0] !== sx || logical[logical.length - 1]![1] !== sy) continue;
          const elevation = component.reduce((sum, [, y], index) => sum + memoScenery(state, component[index]![0], y).elev, 0) / component.length;
          const projected = logical.slice(0, -1).map(([x, y]) => tileToScreen(x, y, cam, elevation));
          smoothClosedPath(ctx, projected);
          ctx.globalAlpha = alpha * (visible === 1 ? 0.45 : 1);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.globalAlpha = alpha * (visible === 1 ? 0.45 : 1) * 0.38;
          ctx.strokeStyle = edge;
          ctx.lineWidth = Math.max(0.7, z * 0.8);
          ctx.stroke();
        }
      }
    }
  }
  ctx.restore();
}

function paintSurfaceRegions(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  const colors = landformColors(state);
  for (const surface of [SURFACE_ROAD, SURFACE_CONCRETE] as const) {
    if (surface === SURFACE_ROAD) {
      ctx.save();
      ctx.strokeStyle = colors.road;
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = TILE_H * cam.zoom * 0.72;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          if (state.surfaces[y * state.width + x] !== surface || fogAt(state, x, y) === 0) continue;
          const here = tileToScreen(x, y, cam, heightAt(state, x, y));
          for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= state.width || ny >= state.height || state.surfaces[ny * state.width + nx] !== surface) continue;
            const there = tileToScreen(nx, ny, cam, heightAt(state, nx, ny));
            ctx.beginPath();
            ctx.moveTo(here.x, here.y + TILE_H * cam.zoom * 0.5);
            ctx.lineTo(there.x, there.y + TILE_H * cam.zoom * 0.5);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    paintContinuousRegion(
      ctx,
      state,
      cam,
      (x, y) => x >= 0 && y >= 0 && x < state.width && y < state.height && state.surfaces[y * state.width + x] === surface,
      surface === SURFACE_ROAD ? colors.road : colors.concrete,
      surface === SURFACE_ROAD ? colors.waterEdge : colors.ridge,
      surface === SURFACE_ROAD ? 0.72 : 0.42,
    );
  }
}

function paintLandforms(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  const colors = landformColors(state);
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < state.width && y < state.height;
  paintContinuousRegion(ctx, state, cam, (x, y, kind) => inMap(x, y) && kind === TILE_WATER, colors.water, colors.waterEdge, 0.82);
  paintContinuousRegion(ctx, state, cam, (x, y, kind) => inMap(x, y) && kind === TILE_RESOURCE, "#6d5725", "#c7a648", 0.4);
  paintContinuousRegion(ctx, state, cam, (x, y, kind, elev) => inMap(x, y) && kind !== TILE_WATER && elev >= 2, colors.ridge, colors.ridgeEdge, 0.16);
  paintSurfaceRegions(ctx, state, cam);
}

function paintTileRange(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  mode: "skirt" | "map",
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const margin = TILE_W * cam.zoom * 2;
  const depth0 = x0 + y0;
  const depth1 = (x1 - 1) + (y1 - 1);
  for (let depth = depth0; depth <= depth1; depth++) {
    const xs = Math.max(x0, depth - (y1 - 1));
    const xe = Math.min(x1 - 1, depth - y0);
    for (let x = xs; x <= xe; x++) {
      const y = depth - x;
      const inMap = x >= 0 && y >= 0 && x < state.width && y < state.height;
      const fog = fogAt(state, x, y);
      if (fog === 0) continue;
      if (mode === "skirt" && inMap) continue;
      if (mode === "map" && !inMap) continue;
      const elev = memoScenery(state, x, y).elev;
      const s = tileToScreen(x, y, cam, elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      drawTile(ctx, state, cam, x, y);
    }
  }
}

function paintTerrain(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  paintTerrainField(ctx, state, cam);
  paintTerrainAdornments(ctx, state, cam);
  paintFogOverlay(ctx, state, cam);
  paintLandforms(ctx, state, cam);
  ctx.imageSmoothingEnabled = false;
  sceneryMemo.clear();

  const x0 = -MAP_SKIRT;
  const y0 = -MAP_SKIRT;
  const x1 = state.width + MAP_SKIRT;
  const y1 = state.height + MAP_SKIRT;
  // The continuous field already supplies the surrounding theater. Rendering
  // the skirt as individual tiles recreated the exact stepped puzzle outline
  // this layer is meant to replace.
  paintTileRange(ctx, state, cam, x0, y0, x1, y1, "map");
}

export function invalidateTerrainCache(): void {
  terrainLayer.key = "";
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  selected: Set<number>,
  hoverTile: { x: number; y: number } | null,
  extras: RenderExtras = {},
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;

  const key = terrainCacheKey(state, cam, w, h);
  const layer = ensureTerrainCanvas(w, h);
  if (layer && terrainLayer.key !== key) {
    const tctx = layer.getContext("2d");
    if (tctx) {
      paintTerrain(tctx, state, cam);
      terrainLayer.key = key;
    }
  }
  if (layer && terrainLayer.key === key) {
    ctx.drawImage(layer, 0, 0);
  } else {
    paintTerrain(ctx, state, cam);
  }
  drawWaterFx(ctx, state, cam, extras.clockMs);
  drawBuildingPlates(ctx, state, cam);

  if (extras.placeKind && hoverTile) {
    const fp = footprintOf(extras.placeKind);
    const ok = canPlaceBuilding(state, extras.placeKind, hoverTile.x, hoverTile.y);
    for (let oy = 0; oy < fp.h; oy++) {
      for (let ox = 0; ox < fp.w; ox++) {
        const tx = hoverTile.x + ox;
        const ty = hoverTile.y + oy;
        const elev = heightAt(state, tx, ty);
        const s = tileToScreen(tx, ty, cam, elev);
        ctx.strokeStyle = ok ? "rgba(90,220,120,0.95)" : "rgba(220,70,70,0.95)";
        ctx.fillStyle = ok ? "rgba(90,220,120,0.18)" : "rgba(220,70,70,0.18)";
        ctx.lineWidth = 2;
        drawDiamond(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  entityById.clear();
  drawList.length = 0;
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    entityById.set(e.id, e);
    drawList.push(e);
  }
  drawList.sort((a, b) => depthOf(a) - depthOf(b));

  const z = cam.zoom;
  const cullPad = 80 * z;
  const clock = extras.clockMs;
  const timeMs = animClock(state.tick, clock);
  drawFxLayer(ctx, state, cam, extras.fx, timeMs, "ground");
  for (const e of drawList) {
    const entityAlpha = renderEntityOpacity(state, e, timeMs);
    if (entityAlpha <= 0.01) continue;
    const pal = state.factions[e.owner]!.palette;
    const profile = generateVisualProfile(state.seed, e.owner);
    const facing = facingFor(state, e);
    const uAnim = e.class === "unit" ? unitAnim(e, state.tick, clock) : null;
    const bAnim = e.class === "building" ? buildingAnim(e, state.tick, clock) : null;
    const damageStage = bAnim?.damageStage ?? (e.hp / e.maxHp < 0.34 ? 2 : e.hp / e.maxHp < 0.67 ? 1 : 0);
    const spec = e.class === "unit"
      ? unitSprite(e.kind as UnitKind, pal, {
          variant: entityVariant(state, e),
          facing,
          animationFrame: uAnim?.frame,
          damageStage,
          profile,
        })
      : buildingSprite(e.kind as BuildingKind, pal, {
          variant: entityVariant(state, e),
          damageStage,
          constructionStage: constructionStage(e),
          profile,
        });
    let cx = e.x;
    let cy = e.y;
    if (e.class === "building") {
      const fp = footprintOf(e.kind as BuildingKind);
      cx = e.x + (fp.w - 1) / 2;
      cy = e.y + (fp.h - 1) / 2;
    }
    const elev = entityElev(state, e);
    const s = tileToScreen(cx, cy, cam, elev);
    if (s.x < -cullPad || s.y < -cullPad || s.x > w + cullPad || s.y > h + cullPad) continue;
    if (isLockedContactUnit(state, e)) drawRescueHalo(ctx, s.x, s.y, z, timeMs);
    const img = rasterize(spec);
    const ax = (spec.anchorX ?? spec.w / 2) * z;
    const ay = (spec.anchorY ?? spec.h) * z;
    const dir = facingVector(facing);
    const recoil = uAnim?.recoil ?? 0;
    const dx = Math.round(s.x - ax + (uAnim?.swayX ?? 0) * z - dir.x * recoil * 3 * z);
    const dy = Math.round(s.y + (TILE_H / 2) * z - ay - (uAnim?.bobY ?? 0) * z + dir.y * recoil * 3 * z);
    if (e.class === "building") {
      drawBuildingShadow(ctx, state, cam, e, z);
    }
    ctx.globalAlpha = entityAlpha * (e.constructing > 0 ? 0.72 : 1);
    drawSprite(ctx, spec, img, dx, dy, spec.w * z, spec.h * z);
    ctx.globalAlpha = 1;
    if (uAnim?.pose === "move") {
      paintUnitMovementFx(
        ctx,
        e.kind as UnitKind,
        dx,
        dy,
        spec.w * z,
        spec.h * z,
        s.y + (TILE_H / 2) * z,
        z,
        uAnim.frame,
        entityAlpha,
      );
    }
    drawDamageOverlay(
      ctx,
      spec,
      dx,
      dy,
      spec.w * z,
      spec.h * z,
      damageStage,
      timeMs,
      e.id,
      entityAlpha * (e.constructing > 0 ? 0.72 : 1),
    );

    if (bAnim) drawBuildingFx(ctx, e, s, z, bAnim);
    if (uAnim?.pose === "work") drawHarvestFx(ctx, state, e, cam, timeMs);
    if (uAnim?.pose === "attack" && recoil > 0.45) {
      ctx.fillStyle = "#fff4c4";
      ctx.fillRect(Math.round(s.x + dir.x * 16 * z - 2), Math.round(s.y + dir.y * 16 * z), 4, 4);
    }

    if (selected.has(e.id)) {
      const pulse = selectionPulse(timeMs);
      ctx.strokeStyle = "#f5e6a8";
      ctx.globalAlpha = 0.6 + pulse * 0.4;
      ctx.lineWidth = 3;
      if (e.class === "building") {
        const fp = footprintOf(e.kind as BuildingKind);
        strokeFootprint(ctx, state, cam, e.x, e.y, fp.w, fp.h);
      } else {
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + (TILE_H / 2) * z, (16 + pulse * 3) * z, (6 + pulse * 1.5) * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (e.marked) {
      ctx.strokeStyle = "#ffcf33";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.65 + selectionPulse(timeMs + e.id * 40) * 0.35;
      ctx.beginPath();
      ctx.arc(s.x, dy + 12 * z, 11 * z, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const barW = e.class === "building" ? 36 * z : 24 * z;
    const hpRatio = e.hp / e.maxHp;
    ctx.fillStyle = "#111";
    ctx.fillRect(s.x - barW / 2, s.y + (TILE_H / 2) * z + 4, barW, 3);
    ctx.fillStyle = e.repairing ? "#5ec8e8" : hpRatio > 0.4 ? "#3dba6a" : "#d45";
    ctx.fillRect(s.x - barW / 2, s.y + (TILE_H / 2) * z + 4, barW * hpRatio, 3);
    if (e.constructing > 0) {
      ctx.fillStyle = "#9cf";
      ctx.fillRect(s.x - barW / 2, s.y + (TILE_H / 2) * z + 8, barW * constructionProgress(e), 2);
    } else if (e.producing) {
      const total = UNIT_STATS[e.producing.kind].buildTicks || 1;
      ctx.fillStyle = "#d4c56f";
      ctx.fillRect(s.x - barW / 2, s.y + (TILE_H / 2) * z + 8, barW * (1 - e.producing.remaining / total), 2);
    }
  }

  for (const id of selected) {
    const selectedEntity = entityById.get(id);
    if (!selectedEntity || selectedEntity.hp <= 0 || selectedEntity.class !== "unit") continue;
    const center = tileToScreen(selectedEntity.x, selectedEntity.y, cam, entityElev(state, selectedEntity));
    const range = UNIT_STATS[selectedEntity.kind as UnitKind].range;
    if (range > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(245, 230, 168, 0.28)";
      ctx.setLineDash([4 * z, 4 * z]);
      ctx.lineWidth = Math.max(1, z);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y + TILE_H * z * 0.5, range * TILE_W * z * 0.5, range * TILE_H * z * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if ((selectedEntity.suppression ?? 0) > 0) {
      ctx.fillStyle = "#d6a45b";
      ctx.fillRect(center.x - 12 * z, center.y - 22 * z, 24 * z * (selectedEntity.suppression ?? 0) / 100, 2 * z);
    }
  }

  drawCombatEffects(ctx, state, cam, clock);
  drawFxLayer(ctx, state, cam, extras.fx, timeMs, "burst");
  drawSelectBox(ctx, extras.selectBox);

  if (hoverTile && !extras.placeKind && (extras.repairMode || extras.sellMode)) {
    const hovered = visibleBuildingAt(state, hoverTile.x, hoverTile.y);
    if (hovered && hovered.hp > 0) {
      const fp = footprintOf(hovered.kind as BuildingKind);
      const ok = hovered.owner === 0 && (
        extras.repairMode
          ? hovered.repairing || canRepair(hovered)
          : canSell(hovered)
      );
      const tone = extras.repairMode ? "90,220,200" : "220,190,70";
      ctx.strokeStyle = ok ? `rgba(${tone},0.95)` : "rgba(220,70,70,0.95)";
      ctx.fillStyle = ok ? `rgba(${tone},0.16)` : "rgba(220,70,70,0.16)";
      ctx.lineWidth = 2;
      for (let oy = 0; oy < fp.h; oy++) {
        for (let ox = 0; ox < fp.w; ox++) {
          const tx = hovered.x + ox;
          const ty = hovered.y + oy;
          const elev = heightAt(state, tx, ty);
          const s = tileToScreen(tx, ty, cam, elev);
          drawDiamond(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  if (hoverTile && !extras.placeKind && !extras.repairMode && !extras.sellMode) {
    const s = tileToScreen(hoverTile.x, hoverTile.y, cam, heightAt(state, hoverTile.x, hoverTile.y));
    ctx.strokeStyle = "rgba(255,255,200,0.7)";
    ctx.lineWidth = 1.5;
    drawDiamondStroke(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
    const hovered = visibleBuildingAt(state, hoverTile.x, hoverTile.y);
    if (hovered) {
      const fp = footprintOf(hovered.kind as BuildingKind);
      ctx.strokeStyle = "rgba(245,230,168,0.45)";
      strokeFootprint(ctx, state, cam, hovered.x, hovered.y, fp.w, fp.h);
    }
  }

  const cursor = extras.cursor;
  if (cursor) {
    const ent = entityAtPointer(state, cursor.x, cursor.y, cam);
    if (ent) drawTooltip(ctx, cursor.x, cursor.y, tooltipLines(state, ent, extras), w, h);
    else if (hoverTile) drawTooltip(ctx, cursor.x, cursor.y, tileTooltipLines(state, hoverTile.x, hoverTile.y), w, h);
  }
}

function isLockedContactUnit(state: SimState, e: Entity): boolean {
  return e.class === "unit"
    && e.neutral === true
    && (state.runtime?.kind === "rescue" || state.runtime?.kind === "extraction")
    && state.runtime.targetIds.includes(e.id);
}

function drawRescueHalo(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, timeMs: number): void {
  const pulse = selectionPulse(timeMs);
  ctx.save();
  ctx.globalAlpha = 0.14 + pulse * 0.08;
  ctx.fillStyle = "#67e0d0";
  ctx.beginPath();
  ctx.ellipse(
    x,
    y + (TILE_H / 2) * z,
    RESCUE_CONTACT_RADIUS * (TILE_W / 2) * z,
    RESCUE_CONTACT_RADIUS * (TILE_H / 2) * z,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalAlpha = 0.8 + pulse * 0.2;
  ctx.strokeStyle = "#67e0d0";
  ctx.lineWidth = Math.max(2, 2.5 * z);
  ctx.shadowColor = "#67e0d0";
  ctx.shadowBlur = 7 * z;
  ctx.setLineDash([4 * z, 4 * z]);
  ctx.stroke();
  ctx.restore();
}

function entityVariant(state: SimState, e: Entity): number {
  return ((state.seed * 2654435761) ^ (e.id * 2246822519)) >>> 0;
}

function drawDamageOverlay(
  ctx: CanvasRenderingContext2D,
  spec: { w: number; h: number; rotation?: number; anchorX?: number; anchorY?: number },
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  damageStage: 0 | 1 | 2,
  timeMs: number,
  id: number,
  baseAlpha: number,
): void {
  if (damageStage <= 0) return;
  const sx = dw / spec.w;
  const sy = dh / spec.h;
  const ax = (spec.anchorX ?? spec.w / 2) * sx;
  const ay = (spec.anchorY ?? spec.h) * sy;
  const pulse = (Math.sin(timeMs * 0.006 + id * 1.7) + 1) * 0.5;
  ctx.save();
  ctx.translate(dx + ax, dy + ay);
  if (spec.rotation) ctx.rotate(spec.rotation);
  ctx.globalAlpha = baseAlpha * 0.6;
  ctx.fillStyle = "#2b2520";
  ctx.beginPath();
  ctx.ellipse(-8 * sx, -8 * sy, 9 * sx, 4 * sy, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#171514";
  ctx.lineWidth = Math.max(1, 1.8 * sx);
  ctx.beginPath();
  ctx.moveTo(-4 * sx, -20 * sy);
  ctx.lineTo(4 * sx, 5 * sy);
  ctx.lineTo(13 * sx, -1 * sy);
  ctx.stroke();
  if (damageStage > 1) {
    ctx.globalAlpha = baseAlpha * (0.22 + pulse * 0.16);
    ctx.fillStyle = "#1b1d1c";
    for (let i = 0; i < 3; i++) {
      const rise = (i * 8 + pulse * 5) * sy;
      ctx.beginPath();
      ctx.arc((8 + i * 5) * sx, -22 * sy - rise, (3 + i) * sx, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function facingFor(state: SimState, e: Entity): Facing {
  let target: { x: number; y: number } | undefined;
  if (e.attackTarget !== undefined) target = entityById.get(e.attackTarget);
  if (!target && e.path.length) target = e.path[0];
  if (!target) {
    // Once a unit has stopped, use the south-facing asset so its idle pose
    // reads as looking toward the player. Combat and movement still take
    // priority above this fallback, and therefore keep their live direction.
    if (e.class === "unit" && e.attackTarget === undefined && e.path.length === 0) {
      e.facing = 2;
      return 2;
    }
    return e.facing ?? ((e.owner === 0 ? 0 : 4) as Facing);
  }
  const next = toFacing(target.x - e.x, target.y - e.y);
  e.facing = next;
  return next;
}

function constructionStage(e: Entity): 0 | 1 | 2 | 3 {
  if (e.constructing <= 0 || e.class !== "building") return 3;
  const total = BUILDING_STATS[e.kind as BuildingKind].buildTicks || 1;
  return Math.max(0, Math.min(2, Math.floor((1 - e.constructing / total) * 3))) as 0 | 1 | 2;
}

function drawCombatEffects(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera, clockMs?: number): void {
  const z = cam.zoom;
  const t = animClock(state.tick, clockMs);
  for (const e of drawList) {
    if (e.attackTarget === undefined || e.cooldown <= 0) continue;
    const target = entityById.get(e.attackTarget);
    if (!target || target.hp <= 0) continue;
    const maxCooldown = e.class === "unit" ? UNIT_STATS[e.kind as UnitKind].cooldown : e.kind === "turret" ? 14 : 0;
    if (maxCooldown <= 0 || e.cooldown < maxCooldown - 3) continue;
    const facing = facingFor(state, e);
    const dir = facingVector(facing);
    const a = tileToScreen(e.x, e.y, cam, entityElev(state, e));
    const b = tileToScreen(target.x, target.y, cam, entityElev(state, target));
    const age = maxCooldown - e.cooldown;
    const u = Math.max(0, Math.min(1, (age + (t % 80) / 80) / 2.4));
    const muzzle = e.class === "building" ? 18 : e.kind === "infantry" ? 14 : 20;
    const ax = a.x + dir.x * muzzle * z;
    const ay = a.y + 6 * z + dir.y * muzzle * z;
    const bx = b.x;
    const by = b.y + 9 * z;
    const px = ax + (bx - ax) * u;
    const py = ay + (by - ay) * u;
    const anti = e.kind === "antiArmor";
    const heavy = e.kind === "tank" || e.kind === "turret";
    ctx.save();
    ctx.globalAlpha = 0.55 + (1 - u) * 0.35;
    ctx.strokeStyle = anti ? "#ff8b3d" : heavy ? "#ffe08a" : "#f6d06c";
    ctx.lineWidth = Math.max(1, Math.round(z * (heavy ? 3 : anti ? 2 : 1)));
    ctx.shadowColor = anti ? "#ff5a28" : "#ffd56a";
    ctx.shadowBlur = (heavy ? 7 : 4) * z;
    ctx.beginPath();
    ctx.moveTo(Math.round(ax), Math.round(ay));
    ctx.lineTo(Math.round(px), Math.round(py));
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (anti) {
      for (let i = 1; i <= 3; i++) {
        const trail = Math.max(0, u - i * 0.045);
        const tx = ax + (bx - ax) * trail;
        const ty = ay + (by - ay) * trail;
        ctx.globalAlpha = 0.22 * (1 - i / 4);
        ctx.fillStyle = "#9aa09a";
        ctx.beginPath();
        ctx.ellipse(tx, ty, (2 + i) * z, (1.2 + i * 0.55) * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 0.55 + (1 - u) * 0.35;
    ctx.fillStyle = heavy ? "#fff4c4" : "#fff0a0";
    const shell = heavy ? 5 : 3;
    ctx.fillRect(Math.round(px - shell / 2), Math.round(py - shell / 2), shell, shell);
    if (age < 1) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath();
      ctx.arc(ax, ay, Math.max(2, 3 * z), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = anti ? "#ff8b3d" : "#fff4c4";
      ctx.lineWidth = Math.max(1, z);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + facing * 0.3;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(ang) * 8 * z, ay + Math.sin(ang) * 5 * z);
        ctx.stroke();
      }
    }
    if (u > 0.72) {
      const burst = (u - 0.72) / 0.28;
      ctx.globalAlpha = 0.85 * (1 - burst);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + e.id;
        const rad = (4 + burst * 10) * z;
        ctx.fillStyle = i % 2 ? "#ffe08a" : "#a54b25";
        ctx.fillRect(
          Math.round(bx + Math.cos(ang) * rad - 2),
          Math.round(by + Math.sin(ang) * rad * 0.55 - 2),
          Math.max(2, 3 * z),
          Math.max(2, 3 * z),
        );
      }
    }
    ctx.restore();
  }
}

function depthOf(e: Entity): number {
  if (e.class === "building") {
    const fp = footprintOf(e.kind as BuildingKind);
    return e.x + fp.w - 1 + (e.y + fp.h - 1);
  }
  return e.x + e.y;
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
): void {
  const inMap = x >= 0 && y >= 0 && x < state.width && y < state.height;
  const fog = fogAt(state, x, y);
  if (fog === 0) return;
  const scenery = memoScenery(state, x, y);
  const elev = scenery.elev;
  const s = tileToScreen(x, y, cam, elev);
  const tw = TILE_W * cam.zoom;
  const th = TILE_H * cam.zoom;
  const prev = ctx.globalAlpha;
  const surface = inMap ? (state.surfaces[y * state.width + x] ?? SURFACE_NONE) : SURFACE_NONE;
  ctx.globalAlpha = prev * (fog === 1 ? 0.45 : 1);

  const east = memoScenery(state, x + 1, y).elev;
  const south = memoScenery(state, x, y + 1).elev;
  const dropE = Math.max(0, elev - east);
  const dropS = Math.max(0, elev - south);
  if (elev >= 2 || dropE > 0 || dropS > 0) {
    ctx.save();
    ctx.globalAlpha *= Math.min(0.22, 0.08 + elev * 0.025 + (dropE + dropS) * 0.03);
    ctx.fillStyle = "#071014";
    ctx.beginPath();
    ctx.ellipse(
      s.x,
      s.y + th * 0.55 + Math.max(1, HEIGHT_STEP * cam.zoom * 0.12),
      tw * 0.4,
      th * 0.17,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
  if (dropE > 0 || dropS > 0) {
    drawElevationFaces(
      ctx,
      s.x,
      s.y,
      tw,
      th,
      HEIGHT_STEP * cam.zoom,
      dropE,
      dropS,
      tileVariant(state.seed, x, y),
      cliffFaces(state.biome, elev, campaignVisualFor(state.seed)),
    );
  }

  const water = scenery.kind === TILE_WATER;
  const mountain = isMountainScenery(scenery);
  let edgeMask = 0;
  let contour: TileContour = "none";
  let kind: "clear" | "water" | "resource" | "blocked" = tileKind(scenery.kind);
  const differs = (dx: number, dy: number): boolean => {
    const n = memoScenery(state, x + dx, y + dy);
    if (water) return n.kind !== TILE_WATER;
    if (mountain) return !isMountainScenery(n);
    return n.kind !== scenery.kind;
  };
  if (water) {
    kind = "water";
    contour = "bank";
  } else if (mountain) {
    kind = "clear";
    contour = "ridge";
  }
  if (differs(0, -1)) edgeMask |= 1;
  if (differs(1, 0)) edgeMask |= 2;
  if (differs(0, 1)) edgeMask |= 4;
  if (differs(-1, 0)) edgeMask |= 8;
  if (differs(1, -1)) edgeMask |= 16;
  if (differs(1, 1)) edgeMask |= 32;
  if (differs(-1, 1)) edgeMask |= 64;
  if (differs(-1, -1)) edgeMask |= 128;
  const amount = inMap ? (state.resourceAmount[y * state.width + x] ?? 0) : 0;
  const opts = {
    biome: state.biome,
    variant: terrainVariant(state.seed, x, y),
    edgeMask,
    surfaceMask: inMap ? (surface === SURFACE_NONE ? -1 : surfaceBoundaryMask(state, x, y, surface)) : -1,
    surface,
    resourceLevel: amount > 700 ? 4 : amount > 450 ? 3 : amount > 200 ? 2 : 1,
    contour,
    campaignProfile: campaignVisualFor(state.seed),
  };
  if (surface !== SURFACE_NONE) {
    ctx.globalAlpha = prev;
    return;
  }
  // The continuous field is the base material. Keep sprites for tactical
  // landmarks and terrain boundaries only; repainting every clear cell here
  // recreates the visible diamond mosaic the field is meant to replace.
  if (kind === "clear" && !mountain) {
    ctx.globalAlpha = prev;
    return;
  }
  if (kind === "water") {
    ctx.globalAlpha = prev;
    return;
  }
  const id = tileSpriteId(kind, elev, opts);
  const img = cachedSprite(id) ?? rasterize(tileSprite(kind, elev, opts));
  const padX = TILE_SPRITE_PAD_X * cam.zoom;
  const padY = TILE_SPRITE_PAD_Y * cam.zoom;
  ctx.drawImage(
    img,
    Math.round(s.x - tw / 2 - padX),
    Math.round(s.y - padY),
    Math.ceil(tw + padX * 2),
    Math.ceil(th + padY * 2),
  );
  ctx.globalAlpha = prev;
}

function strokeFootprint(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
  fw: number,
  fh: number,
): void {
  footprintPath(ctx, state, cam, x, y, fw, fh);
  ctx.stroke();
}

function footprintPath(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
  fw: number,
  fh: number,
): void {
  const elev = heightAt(state, x, y);
  const n = tileToScreen(x, y, cam, elev);
  const e = tileToScreen(x + fw - 1, y, cam, elev);
  const s = tileToScreen(x + fw - 1, y + fh - 1, cam, elev);
  const ww = tileToScreen(x, y + fh - 1, cam, elev);
  const tw = TILE_W * cam.zoom;
  const th = TILE_H * cam.zoom;
  ctx.beginPath();
  ctx.moveTo(n.x, n.y);
  ctx.lineTo(e.x + tw / 2, e.y + th / 2);
  ctx.lineTo(s.x, s.y + th);
  ctx.lineTo(ww.x - tw / 2, ww.y + th / 2);
  ctx.closePath();
}

function tileTooltipLines(state: SimState, x: number, y: number): string[] {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return ["Map edge"];
  const fog = fogAt(state, x, y);
  if (fog === 0) return ["Unexplored"];
  const scenery = memoScenery(state, x, y);
  const surface = state.surfaces[y * state.width + x] ?? SURFACE_NONE;
  let terrain = "Open ground";
  if (scenery.kind === TILE_WATER) terrain = "Water";
  else if (scenery.kind === TILE_RESOURCE) terrain = "Ore field";
  else if (isMountainScenery(scenery)) terrain = "Ridge";
  else if (scenery.kind === TILE_BLOCKED) terrain = "Impassable";
  if (surface === SURFACE_ROAD) terrain = "Dirt road";
  else if (surface === SURFACE_CONCRETE) terrain = "Concrete pad";
  const access = terrainAccess(state, x, y);
  const lines = [terrain, state.biome, `Elevation ${scenery.elev}`, access.traversable ? "Passable" : "Impassable"];
  if (scenery.kind === TILE_RESOURCE) lines.push(`Ore ${state.resourceAmount[y * state.width + x] ?? 0}`);
  if (!access.buildable) lines.push("Construction blocked");
  if (fog === 1) lines.push("Shrouded");
  return lines;
}

export function tooltipLines(state: SimState, e: Entity, extras: RenderExtras): string[] {
  const name = labelFor(e.kind as UnitKind | BuildingKind);
  const cls = e.class === "unit" ? "Unit" : "Building";
  const faction = state.factions[e.owner]?.name ?? (e.owner === 0 ? "Player" : "Enemy");
  const lines = [
    `${name} · ${cls}`,
    `${e.owner === 0 ? "Friendly" : "Hostile"} · ${faction}`,
    `HP ${Math.max(0, Math.round(e.hp))} / ${e.maxHp}`,
  ];
  if (isLockedContactUnit(state, e)) lines.push("Stranded");
  if (e.kind === "harvester") {
    lines.push(`Carry ${e.carry} / ${UNIT_STATS.harvester.carryMax}`);
  }
  if (e.constructing > 0) {
    lines.push(`Constructing (${Math.ceil(e.constructing / TICKS_PER_SECOND)}s)`);
  }
  if (e.producing) {
    lines.push(`Producing ${labelFor(e.producing.kind)} (${Math.ceil(e.producing.remaining / TICKS_PER_SECOND)}s)`);
    const queued = e.queue?.length ?? 0;
    if (queued > 0) lines.push(`Queued ${queued}`);
  }
  if (e.repairing) lines.push("Repairing");
  if (e.marked) lines.push("Marked objective");
  if (extras.sellMode && e.owner === 0 && canSell(e)) {
    lines.push(`Sell for ${sellRefundFor(e.kind as BuildingKind, e.hp)}`);
  }
  return lines;
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lines: string[],
  canvasW: number,
  canvasH: number,
): void {
  const pad = 8;
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  let textW = 0;
  for (const l of lines) textW = Math.max(textW, ctx.measureText(l).width);
  const width = Math.min(240, textW + pad * 2);
  const lineH = 16;
  const height = lines.length * lineH + pad * 2 - 2;
  let tx = x + 18;
  let ty = y + 18;
  if (tx + width > canvasW - 10) tx = x - width - 14;
  if (ty + height > canvasH - 10) ty = y - height - 14;
  if (tx < 8) tx = 8;
  if (ty < 8) ty = 8;
  ctx.fillStyle = "#101510";
  ctx.strokeStyle = "#b0a263";
  ctx.lineWidth = 1;
  ctx.fillRect(tx, ty, width, height);
  ctx.strokeRect(tx, ty, width, height);
  ctx.fillStyle = "#d8cfaa";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = i === 0 ? "#e1d59f" : "#aeb49a";
    ctx.fillText(lines[i]!, tx + pad, ty + pad + 11 + i * lineH);
  }
}

function drawWaterFx(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera, clockMs?: number): void {
  const t = animClock(state.tick, clockMs);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const margin = TILE_W * cam.zoom;
  const tw = TILE_W * cam.zoom;
  const th = TILE_H * cam.zoom;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (state.tiles[y * state.width + x] !== TILE_WATER) continue;
      const fog = fogAt(state, x, y);
      if (fog === 0) continue;
      const elev = heightAt(state, x, y);
      const s = tileToScreen(x, y, cam, elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      const sh = waterShimmer(t, x, y);
      const sh2 = waterShimmer(t * 1.35 + 90, x + 1, y);
      ctx.save();
      ctx.globalAlpha = sh.alpha * (fog === 1 ? 0.45 : 1);
      ctx.strokeStyle = "#d7eef2";
      ctx.lineWidth = Math.max(1, cam.zoom);
      ctx.beginPath();
      ctx.moveTo(s.x - tw * 0.28, s.y + th * 0.42 + sh.offset);
      ctx.lineTo(s.x + tw * 0.22, s.y + th * 0.28 + sh.offset);
      ctx.stroke();
      ctx.globalAlpha = sh2.alpha * 0.7 * (fog === 1 ? 0.45 : 1);
      ctx.beginPath();
      ctx.moveTo(s.x - tw * 0.18, s.y + th * 0.52 + sh2.offset);
      ctx.lineTo(s.x + tw * 0.3, s.y + th * 0.38 + sh2.offset);
      ctx.stroke();
      const bank =
        (x > 0 && state.tiles[y * state.width + (x - 1)] !== TILE_WATER)
        || (x + 1 < state.width && state.tiles[y * state.width + (x + 1)] !== TILE_WATER)
        || (y > 0 && state.tiles[(y - 1) * state.width + x] !== TILE_WATER)
        || (y + 1 < state.height && state.tiles[(y + 1) * state.width + x] !== TILE_WATER);
      if (bank) {
        ctx.globalAlpha = (0.18 + sh.alpha) * (fog === 1 ? 0.45 : 1);
        ctx.strokeStyle = "#e8e0c8";
        ctx.beginPath();
        ctx.moveTo(s.x - tw * 0.32, s.y + th * 0.55);
        ctx.lineTo(s.x + tw * 0.12, s.y + th * 0.72);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawBuildingFx(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  s: { x: number; y: number },
  z: number,
  anim: BuildingAnim,
): void {
  const kind = e.kind as BuildingKind;
  ctx.save();
  if (anim.lightOn && (kind === "power" || kind === "constructionYard" || kind === "objective" || kind === "turret")) {
    ctx.fillStyle = kind === "objective" ? "#f3dc79" : "#c7f0d4";
    ctx.globalAlpha = 0.5 + anim.smoke * 0.3;
    ctx.beginPath();
    ctx.ellipse(s.x + 6 * z, s.y - 12 * z, 3.5 * z, 2.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === "refinery" || kind === "power" || kind === "factory" || anim.damageStage > 0) {
    const puff = anim.smoke;
    const columns = anim.damageStage > 1 ? 3 : anim.damageStage > 0 ? 2 : 1;
    for (let i = 0; i < columns; i++) {
      const rise = (12 + puff * (14 + anim.damageStage * 6) + i * 7) * z;
      ctx.globalAlpha = (0.2 + puff * 0.22) * (1 - i * 0.18);
      ctx.fillStyle = anim.damageStage > 0 ? "rgba(40,36,32,0.78)" : "rgba(190,190,180,0.55)";
      ctx.beginPath();
      ctx.ellipse(
        s.x - (8 - i * 6) * z,
        s.y - rise,
        (4 + puff * 4 + i * 2) * z,
        (3 + puff * 3 + i) * z,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  if (anim.spark > 0.55 && (anim.constructing || anim.producing || anim.repairing)) {
    ctx.globalAlpha = anim.spark;
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(s.x + (anim.frame - 1.5) * 5 * z, s.y + 2 * z, 2 * z, 2 * z);
    ctx.fillStyle = "#ff9a3a";
    ctx.fillRect(s.x - 7 * z, s.y + 5 * z, 2 * z, 2 * z);
  }
  if ((kind === "barracks" || kind === "factory") && anim.doorOpen) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffc14a";
    ctx.fillRect(s.x - 6 * z, s.y + 4 * z, 12 * z, 5 * z);
  }
  if (kind === "constructionYard") {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "#c3a65d";
    ctx.lineWidth = Math.max(1, z);
    ctx.beginPath();
    ctx.moveTo(s.x - 4 * z, s.y - 16 * z);
    ctx.lineTo(s.x - 4 * z + anim.antenna * z, s.y - 24 * z);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHarvestFx(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  e: Entity,
  cam: Camera,
  timeMs: number,
): void {
  if (e.gatherX === undefined || e.gatherY === undefined) return;
  const z = cam.zoom;
  const a = tileToScreen(e.gatherX, e.gatherY, cam, heightAt(state, e.gatherX, e.gatherY));
  const b = tileToScreen(e.x, e.y, cam, groundHeight(state, e.x, e.y));
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const u = (((timeMs * 0.0018 + e.id * 0.2 + i * 0.33) % 1) + 1) % 1;
    const x = a.x + (b.x - a.x) * u;
    const y = a.y + (b.y - a.y) * u - 10 * z * Math.sin(u * Math.PI);
    ctx.globalAlpha = 0.75 * (1 - u);
    ctx.fillStyle = i % 2 ? "#f6de7a" : "#c4a040";
    ctx.fillRect(Math.round(x - 1), Math.round(y - 2), Math.max(2, 2 * z), Math.max(3, 3 * z));
  }
  ctx.restore();
}

function drawDiamond(
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
  ctx.fill();
}

function drawDiamondStroke(
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
  ctx.stroke();
}

function drawBuildingShadow(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  e: Entity,
  z: number,
): void {
  const fp = footprintOf(e.kind as BuildingKind);
  ctx.save();
  ctx.translate(5 * z, 4 * z);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#000";
  footprintPath(ctx, state, cam, e.x, e.y, fp.w, fp.h);
  ctx.fill();
  ctx.restore();
}

function drawSelectBox(
  ctx: CanvasRenderingContext2D,
  box?: { x0: number; y0: number; x1: number; y1: number } | null,
): void {
  if (!box) return;
  if (Math.hypot(box.x1 - box.x0, box.y1 - box.y0) <= 8) return;
  const x = Math.min(box.x0, box.x1);
  const y = Math.min(box.y0, box.y1);
  const w = Math.abs(box.x1 - box.x0);
  const h = Math.abs(box.y1 - box.y0);
  ctx.save();
  ctx.fillStyle = "rgba(212, 191, 106, 0.12)";
  ctx.strokeStyle = "rgba(245, 230, 168, 0.95)";
  ctx.lineWidth = 1;
  ctx.fillRect(x + 0.5, y + 0.5, w, h);
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.restore();
}

function drawFxLayer(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  fx: FxBurst[] | undefined,
  nowMs: number,
  layer: "ground" | "burst",
): void {
  if (!fx?.length) return;
  const z = cam.zoom;
  for (const burst of fx) {
    if (layer === "ground" && burst.kind !== "rubble") continue;
    if (layer === "burst" && burst.kind === "rubble") continue;
    const p = fxProgress(burst, nowMs);
    let cx = burst.x;
    let cy = burst.y;
    if (burst.entityClass === "building" && isBuildingKind(burst.entityKind)) {
      const fp = footprintOf(burst.entityKind);
      cx = burst.x + (fp.w - 1) / 2;
      cy = burst.y + (fp.h - 1) / 2;
    }
    const s = tileToScreen(cx, cy, cam, burst.elev);
    if (burst.kind === "rubble") {
      const pal = state.factions[burst.owner]?.palette ?? state.factions[0]!.palette;
      const spec = isBuildingKind(burst.entityKind)
        ? rubbleSprite(burst.entityKind, pal)
        : isUnitKind(burst.entityKind)
          ? wreckSprite(burst.entityKind, pal)
          : rubbleSprite("turret", pal);
      const img = rasterize(spec);
      const ax = (spec.anchorX ?? spec.w / 2) * z;
      const ay = (spec.anchorY ?? spec.h) * z;
      ctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      drawSprite(ctx, spec, img, Math.round(s.x - ax), Math.round(s.y + (TILE_H / 2) * z - ay), spec.w * z, spec.h * z);
      ctx.globalAlpha = 1;
      continue;
    }
    if (burst.kind === "explosion") {
      const pal = state.factions[burst.owner]?.palette ?? state.factions[0]!.palette;
      if (burst.entityClass === "unit" && isUnitKind(burst.entityKind) && p < 0.65) {
        const wreck = wreckSprite(burst.entityKind, pal);
        const img = rasterize(wreck);
        const ax = (wreck.anchorX ?? wreck.w / 2) * z;
        const ay = (wreck.anchorY ?? wreck.h) * z;
        ctx.globalAlpha = 1 - p;
        drawSprite(ctx, wreck, img, Math.round(s.x - ax), Math.round(s.y + (TILE_H / 2) * z - ay), wreck.w * z, wreck.h * z);
        ctx.globalAlpha = 1;
      }
      const radius = (6 + p * 22) * z;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.9 * (1 - p);
      ctx.fillStyle = "#a54b25";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 6 * z, radius, radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.28 * (1 - p);
      ctx.fillStyle = "#20252a";
      for (let i = 0; i < 5; i++) {
        const drift = ((burst.id + i * 7) % 9) - 4;
        ctx.beginPath();
        ctx.ellipse(
          s.x + drift * z + Math.cos(i * 2.2) * radius * 0.35,
          s.y - (5 + p * 24 + i * 2) * z,
          radius * (0.28 + i * 0.035),
          radius * (0.2 + i * 0.03),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 0.74 * (1 - p);
      ctx.strokeStyle = p < 0.42 ? "#ffd38a" : "#6b4a38";
      ctx.lineWidth = Math.max(1, 1.3 * z);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + burst.id * 0.7;
        const inner = radius * 0.32;
        const outer = radius * (0.7 + (i % 3) * 0.16);
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(ang) * inner, s.y + 4 * z + Math.sin(ang) * inner * 0.55);
        ctx.lineTo(s.x + Math.cos(ang) * outer, s.y + 4 * z + Math.sin(ang) * outer * 0.55);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4 * z, radius * 0.45, radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + burst.id;
        const rad = radius * (0.7 + (i % 2) * 0.25);
        ctx.fillStyle = i % 2 ? "#ff9a3a" : "#3a322c";
        ctx.fillRect(
          Math.round(s.x + Math.cos(ang) * rad - 2),
          Math.round(s.y + Math.sin(ang) * rad * 0.5 - 2),
          Math.max(2, 3 * z),
          Math.max(2, 3 * z),
        );
      }
      ctx.restore();
    }
  }
}
