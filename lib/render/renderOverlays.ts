import { TICKS_PER_SECOND, UNIT_STATS, labelFor, sellRefundFor } from "../catalog";
import { inObjectiveZone, missionUsesObjectiveZone, OBJECTIVE_ZONE_RADIUS, RESCUE_CONTACT_RADIUS, SURFACE_CONCRETE, SURFACE_NONE, SURFACE_ROAD, TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";
import { selectionPulse } from "./anim";
import { TILE_H, TILE_W, tileToScreen, type Camera } from "./iso";
import { drawSprite } from "./sprites";
import { fogAt } from "../sim/fog";
import { isMountainScenery, sceneryAt, type ScenerySample } from "../gen/map";
import { terrainAccess } from "../sim/world";
import { canSell } from "../sim/sell";
import { isExtractableUnit, isLockedContactUnit } from "./renderCombat";
import type { FxBurst } from "./fx";
import type { BuildingKind, Entity, SimState, SpriteSpec, UnitKind } from "../types";

export type RenderExtras = {
  cursor?: { x: number; y: number } | null;
  placeKind?: BuildingKind | null;
  repairMode?: boolean;
  sellMode?: boolean;
  clockMs?: number;
  selectBox?: { x0: number; y0: number; x1: number; y1: number } | null;
  fx?: FxBurst[];
  subTickAlpha?: number;
  render3dUnits?: boolean;
};

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

export function drawDiamond(
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

export function drawDiamondStroke(
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

function drawZoneHalo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  timeMs: number,
  radius: number,
  color: string,
): void {
  const pulse = selectionPulse(timeMs);
  ctx.save();
  ctx.globalAlpha = 0.14 + pulse * 0.08;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(
    x,
    y + (TILE_H / 2) * z,
    radius * (TILE_W / 2) * z,
    radius * (TILE_H / 2) * z,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.globalAlpha = 0.8 + pulse * 0.2;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, 2.5 * z);
  ctx.shadowColor = color;
  ctx.shadowBlur = 7 * z;
  ctx.setLineDash([4 * z, 4 * z]);
  ctx.stroke();
  ctx.restore();
}

export function drawRescueHalo(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, timeMs: number): void {
  drawZoneHalo(ctx, x, y, z, timeMs, RESCUE_CONTACT_RADIUS, "#67e0d0");
}

export function drawObjectiveZone(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  timeMs: number,
  heightAt: (state: SimState, x: number, y: number) => number,
): void {
  const runtime = state.runtime;
  const zone = runtime?.zone;
  if (!zone || !missionUsesObjectiveZone(runtime?.kind)) return;
  if (runtime.kind === "escort" && fogAt(state, Math.round(zone.x), Math.round(zone.y)) === 0) return;
  const s = tileToScreen(zone.x, zone.y, cam, heightAt(state, Math.round(zone.x), Math.round(zone.y)));
  drawZoneHalo(ctx, s.x, s.y, cam.zoom, timeMs, OBJECTIVE_ZONE_RADIUS, "#e8c86a");
}

export function drawUnitGlow(
  ctx: CanvasRenderingContext2D,
  spec: SpriteSpec,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  timeMs: number,
  alpha: number,
  z: number,
): void {
  const pulse = selectionPulse(timeMs);
  ctx.save();
  ctx.globalAlpha = alpha * (0.72 + pulse * 0.28);
  ctx.shadowColor = "#f6e39a";
  ctx.shadowBlur = (14 + pulse * 10) * Math.max(1, z);
  drawSprite(ctx, spec, img, dx, dy, dw, dh);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = (7 + pulse * 5) * Math.max(1, z);
  ctx.globalAlpha = alpha * (0.28 + pulse * 0.22);
  drawSprite(ctx, spec, img, dx, dy, dw, dh);
  ctx.restore();
}

export function drawDamageOverlay(
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

export function drawSelectBox(
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

export function tileTooltipLines(state: SimState, x: number, y: number): string[] {
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
  if (missionUsesObjectiveZone(state.runtime?.kind) && inObjectiveZone(x, y, state.runtime?.zone)) {
    lines.push(state.runtime?.kind === "escort" ? "Convoy destination" : "Extraction zone");
  }
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
  if (isExtractableUnit(state, e) && !e.neutral) {
    lines.push("Return to extraction zone");
  }
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
  if (e.marked && e.class === "building") lines.push("Marked objective");
  if (extras.sellMode && e.owner === 0 && canSell(e)) {
    lines.push(`Sell for ${sellRefundFor(e.kind as BuildingKind, e.hp)}`);
  }
  return lines;
}

export function drawTooltip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lines: string[],
  canvasW: number,
  canvasH: number,
  anchorAbove = false,
): void {
  const pad = 8;
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  let textW = 0;
  for (const l of lines) textW = Math.max(textW, ctx.measureText(l).width);
  const width = Math.min(260, textW + pad * 2);
  const lineH = 16;
  const height = lines.length * lineH + pad * 2 - 2;

  let tx: number;
  let ty: number;

  if (anchorAbove) {
    tx = Math.round(x - width / 2);
    ty = Math.round(y - height - 8);
    if (ty < 8) {
      ty = Math.round(y + 36);
    }
  } else {
    tx = x + 18;
    ty = y + 18;
    if (tx + width > canvasW - 10) tx = x - width - 14;
    if (ty + height > canvasH - 10) ty = y - height - 14;
  }

  if (tx + width > canvasW - 10) tx = canvasW - width - 10;
  if (tx < 8) tx = 8;
  if (ty + height > canvasH - 10) ty = canvasH - height - 10;
  if (ty < 8) ty = 8;

  ctx.fillStyle = "rgba(16, 21, 16, 0.94)";
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

export function healthMeterColors(ratio: number): { top: string; bottom: string } {
  if (ratio > 0.5) {
    return { top: "#4ade80", bottom: "#16a34a" };
  }
  if (ratio > 0.25) {
    return { top: "#fde047", bottom: "#d97706" };
  }
  return { top: "#f87171", bottom: "#dc2626" };
}

export function drawUnitHealthMeter(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  hp: number,
  maxHp: number,
  z: number,
  alpha = 1,
  isSelected = false,
  barWidth?: number,
): void {
  if (maxHp <= 0 || hp <= 0) return;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const w = barWidth ?? Math.max(16, Math.round(20 * z));
  const h = Math.max(3, Math.round(3.5 * z));
  const x = Math.round(centerX - w / 2);
  const y = Math.round(topY);

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background frame
  ctx.fillStyle = "rgba(8, 12, 14, 0.9)";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

  // Border outline
  ctx.strokeStyle = isSelected ? "rgba(245, 230, 168, 0.95)" : "rgba(30, 38, 44, 0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);

  // Empty track
  ctx.fillStyle = "rgba(18, 22, 26, 0.95)";
  ctx.fillRect(x, y, w, h);

  // Health fill
  const fillW = Math.max(0, Math.min(w, Math.round(w * ratio)));
  if (fillW > 0) {
    const { top, bottom } = healthMeterColors(ratio);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, fillW, h);

    if (h >= 3) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(x, y, fillW, 1);
    }
  }

  // Selected indicator top accent
  if (isSelected) {
    ctx.fillStyle = "#f5e6a8";
    ctx.fillRect(x, y - 2, w, 1);
  }

  ctx.restore();
}
