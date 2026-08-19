import { BUILDING_STATS, TICKS_PER_SECOND, UNIT_STATS, footprintOf, labelFor, sellRefundFor } from "../catalog";
import { buildingSprite, rubbleSprite, unitSprite, wreckSprite } from "../gen/assets";
import { generateVisualProfile } from "../gen/visualProfile";
import { isMountainScenery, sceneryAt, type ScenerySample } from "../gen/map";
import { RESCUE_CONTACT_RADIUS } from "../types";
import type { BuildingKind, Entity, Facing, SimState, UnitKind } from "../types";
import { SURFACE_CONCRETE, SURFACE_NONE, SURFACE_ROAD, TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";
import {
  animClock,
  buildingAnim,
  constructionProgress,
  facingVector,
  selectionPulse,
  toFacing,
  unitAnim,
  type BuildingAnim,
} from "./anim";
import { HEIGHT_STEP, TILE_H, TILE_W, screenToGroundTile, tileToScreen, type Camera } from "./iso";
import { drawSprite, rasterize } from "./sprites";
import { paintUnitMovementFx } from "./unitMotion";
import { buildingAt, canPlaceBuilding, groundHeight, heightAt, terrainAccess } from "../sim/world";
import { fogAt } from "../sim/fog";
import { canRepair } from "../sim/repair";
import { canSell } from "../sim/sell";
import { fxProgress, isBuildingKind, isUnitKind, type FxBurst } from "./fx";
import { resourceSignature, terrainGrainGeneration } from "./terrainAtlas";
import { paintBuildingPlates, paintTerrainWorld } from "./terrainPaint";
import { paintOreGlints, paintTerrainWeather, paintWaterFx } from "./terrainWeather";

const TERRAIN_RENDER_REV = "world-atlas-v2";

function entityElev(state: SimState, e: Entity): number {
  return e.class === "unit" ? groundHeight(state, e.x, e.y) : heightAt(state, Math.round(e.x), Math.round(e.y));
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

type TerrainLayer = {
  canvas: HTMLCanvasElement | null;
  key: string;
};

const terrainLayer: TerrainLayer = { canvas: null, key: "" };
const sceneryMemo = new Map<number, ScenerySample>();
const entityById = new Map<number, Entity>();
const entityVisibility = new Map<number, { alpha: number; target: number; timeMs: number }>();
const drawList: Entity[] = [];

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

function terrainCacheKey(state: SimState, cam: Camera, w: number, h: number): string {
  return `${TERRAIN_RENDER_REV}:${state.seed}:${state.missionIndex}:${w}x${h}:${cam.x | 0}:${cam.y | 0}:${cam.zoom}:${fogSignature(state.fog)}:${resourceSignature(state.resourceAmount)}:${terrainGrainGeneration()}`;
}

function ensureTerrainCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  let canvas = terrainLayer.canvas;
  if (!canvas) {
    canvas = document.createElement("canvas");
    terrainLayer.canvas = canvas;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    terrainLayer.key = "";
  }
  return canvas;
}

function paintTerrain(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera): void {
  paintTerrainWorld(ctx, state, cam);
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

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
  const clock = extras.clockMs;
  const timeMs = animClock(state.tick, clock);
  paintWaterFx(ctx, state, cam, timeMs);
  paintOreGlints(ctx, state, cam, timeMs);
  paintTerrainWeather(ctx, state, cam, timeMs);
  paintBuildingPlates(ctx, state, cam, footprintOf, entityVisible, entityElev);

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
