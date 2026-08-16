import { TICKS_PER_SECOND, UNIT_STATS, footprintOf, labelFor } from "../catalog";
import { buildingSprite, tileSprite, unitSprite } from "../gen/assets";
import type { BuildingKind, Entity, SimState, UnitKind } from "../types";
import { TILE_RESOURCE, TILE_WATER } from "../types";
import { HEIGHT_STEP, TILE_H, TILE_W, tileToScreen, type Camera } from "./iso";
import { rasterize } from "./sprites";
import { buildingAt, canPlaceBuilding, heightAt } from "../sim/world";

function tileKind(t: number): "clear" | "water" | "resource" {
  if (t === TILE_WATER) return "water";
  if (t === TILE_RESOURCE) return "resource";
  return "clear";
}

function tileVariant(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
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
  let best: { x: number; y: number } | null = null;
  let bestDepth = -Infinity;
  const tw = TILE_W * cam.zoom;
  const th = TILE_H * cam.zoom;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const elev = heightAt(state, x, y);
      const s = tileToScreen(x, y, cam, elev);
      if (!pointInDiamond(sx, sy, s.x, s.y, tw, th)) continue;
      const depth = x + y + elev * 8;
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
  const fog = state.fog[ty * state.width + tx] ?? 0;
  if (e.owner === 1 && fog !== 2) return false;
  return true;
}

export function entityAtPointer(state: SimState, sx: number, sy: number, cam: Camera): Entity | undefined {
  const tile = pickTile(state, sx, sy, cam);
  let bestUnit: Entity | undefined;
  let bestD = 28 * cam.zoom;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit" || !entityVisible(state, e)) continue;
    const elev = heightAt(state, Math.round(e.x), Math.round(e.y));
    const s = tileToScreen(e.x, e.y, cam, elev);
    const d = Math.hypot(sx - s.x, sy - (s.y + (TILE_H / 2) * cam.zoom - 12 * cam.zoom));
    if (d < bestD) {
      bestD = d;
      bestUnit = e;
    }
  }
  if (bestUnit) return bestUnit;
  if (!tile) return undefined;
  const b = buildingAt(state, tile.x, tile.y);
  if (b && entityVisible(state, b)) return b;
  return undefined;
}

export type RenderExtras = {
  cursor?: { x: number; y: number } | null;
  placeKind?: BuildingKind | null;
};

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
  ctx.fillStyle = "#07090c";
  ctx.fillRect(0, 0, w, h);

  const margin = TILE_W * cam.zoom * 2;
  const tiles: { x: number; y: number; depth: number }[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const elev = heightAt(state, x, y);
      const s = tileToScreen(x, y, cam, elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      tiles.push({ x, y, depth: x + y });
    }
  }
  tiles.sort((a, b) => a.depth - b.depth);

  for (const t of tiles) {
    drawTile(ctx, state, cam, t.x, t.y);
  }

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

  const drawables = state.entities
    .filter((e) => e.hp > 0)
    .sort((a, b) => {
      const da = depthOf(a);
      const db = depthOf(b);
      return da - db;
    });

  for (const e of drawables) {
    if (!entityVisible(state, e)) continue;
    const pal = state.factions[e.owner]!.palette;
    const spec =
      e.class === "unit"
        ? unitSprite(e.kind as UnitKind, pal)
        : buildingSprite(e.kind as BuildingKind, pal);
    const img = rasterize(spec);
    const elev = heightAt(state, Math.round(e.x), Math.round(e.y));
    let cx = e.x;
    let cy = e.y;
    if (e.class === "building") {
      const fp = footprintOf(e.kind as BuildingKind);
      cx = e.x + (fp.w - 1) / 2;
      cy = e.y + (fp.h - 1) / 2;
    }
    const s = tileToScreen(cx, cy, cam, elev);
    const z = cam.zoom;
    const ax = (spec.anchorX ?? spec.w / 2) * z;
    const ay = (spec.anchorY ?? spec.h) * z;
    const dx = s.x - ax;
    const dy = s.y + (TILE_H / 2) * z - ay;
    ctx.globalAlpha = e.constructing > 0 ? 0.72 : 1;
    ctx.drawImage(img, dx, dy, spec.w * z, spec.h * z);
    ctx.globalAlpha = 1;

    if (selected.has(e.id)) {
      ctx.strokeStyle = "#f5e6a8";
      ctx.lineWidth = 2;
      if (e.class === "building") {
        const fp = footprintOf(e.kind as BuildingKind);
        strokeFootprint(ctx, state, cam, e.x, e.y, fp.w, fp.h);
      } else {
        ctx.strokeRect(dx, dy, spec.w * z, spec.h * z);
      }
    }
    if (e.marked) {
      ctx.strokeStyle = "#ffcf33";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, dy + 12 * z, 11 * z, 0, Math.PI * 2);
      ctx.stroke();
    }
    const barW = e.class === "building" ? 36 * z : 24 * z;
    const hpRatio = e.hp / e.maxHp;
    ctx.fillStyle = "#111";
    ctx.fillRect(s.x - barW / 2, s.y + (TILE_H / 2) * z + 4, barW, 3);
    ctx.fillStyle = hpRatio > 0.4 ? "#3dba6a" : "#d45";
    ctx.fillRect(s.x - barW / 2, s.y + (TILE_H / 2) * z + 4, barW * hpRatio, 3);
    if (e.constructing > 0) {
      ctx.fillStyle = "#9cf";
      ctx.fillRect(s.x - barW / 2, s.y + (TILE_H / 2) * z + 8, barW * 0.55, 2);
    }
  }

  if (hoverTile && !extras.placeKind) {
    const s = tileToScreen(hoverTile.x, hoverTile.y, cam, heightAt(state, hoverTile.x, hoverTile.y));
    ctx.strokeStyle = "rgba(255,255,200,0.7)";
    ctx.lineWidth = 1.5;
    drawDiamondStroke(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
    const hovered = buildingAt(state, hoverTile.x, hoverTile.y);
    if (hovered) {
      const fp = footprintOf(hovered.kind as BuildingKind);
      ctx.strokeStyle = "rgba(245,230,168,0.45)";
      strokeFootprint(ctx, state, cam, hovered.x, hovered.y, fp.w, fp.h);
    }
  }

  const cursor = extras.cursor;
  if (cursor) {
    const ent = entityAtPointer(state, cursor.x, cursor.y, cam);
    if (ent) drawTooltip(ctx, cursor.x, cursor.y, tooltipLines(state, ent), w, h);
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
  const fog = state.fog[y * state.width + x] ?? 0;
  const elev = heightAt(state, x, y);
  const s = tileToScreen(x, y, cam, elev);
  const tw = TILE_W * cam.zoom;
  const th = TILE_H * cam.zoom;
  if (fog === 0) {
    ctx.fillStyle = "#050608";
    drawDiamond(ctx, s.x, s.y, tw, th);
    return;
  }

  const east = heightAt(state, x + 1, y);
  const south = heightAt(state, x, y + 1);
  const dropE = Math.max(0, elev - east);
  const dropS = Math.max(0, elev - south);
  if (dropS > 0) {
    const drop = dropS * HEIGHT_STEP * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(s.x - tw / 2, s.y + th / 2);
    ctx.lineTo(s.x, s.y + th);
    ctx.lineTo(s.x, s.y + th + drop);
    ctx.lineTo(s.x - tw / 2, s.y + th / 2 + drop);
    ctx.closePath();
    ctx.fillStyle = elev >= 3 ? "#2a241c" : "#1a2216";
    ctx.fill();
  }
  if (dropE > 0) {
    const drop = dropE * HEIGHT_STEP * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(s.x + tw / 2, s.y + th / 2);
    ctx.lineTo(s.x, s.y + th);
    ctx.lineTo(s.x, s.y + th + drop);
    ctx.lineTo(s.x + tw / 2, s.y + th / 2 + drop);
    ctx.closePath();
    ctx.fillStyle = elev >= 3 ? "#4a4034" : "#2c3826";
    ctx.fill();
  }

  const spec = tileSprite(tileKind(state.tiles[y * state.width + x]!), elev, tileVariant(x, y) % 8);
  const img = rasterize(spec);
  ctx.globalAlpha = fog === 1 ? 0.45 : 1;
  const west = heightAt(state, x - 1, y);
  const shade = Math.max(0.7, Math.min(1, 0.92 + (west - east) * 0.06));
  ctx.filter = shade < 0.95 ? `brightness(${shade})` : "none";
  ctx.drawImage(img, s.x - tw / 2, s.y, tw, th);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
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
  ctx.stroke();
}

function tooltipLines(state: SimState, e: Entity): string[] {
  const name = labelFor(e.kind as UnitKind | BuildingKind);
  const cls = e.class === "unit" ? "Unit" : "Building";
  const faction = state.factions[e.owner]?.name ?? (e.owner === 0 ? "Player" : "Enemy");
  const lines = [
    `${name} · ${cls}`,
    `${e.owner === 0 ? "Friendly" : "Hostile"} · ${faction}`,
    `HP ${Math.max(0, Math.round(e.hp))} / ${e.maxHp}`,
  ];
  if (e.kind === "harvester") {
    lines.push(`Carry ${e.carry} / ${UNIT_STATS.harvester.carryMax}`);
  }
  if (e.constructing > 0) {
    lines.push(`Constructing (${Math.ceil(e.constructing / TICKS_PER_SECOND)}s)`);
  }
  if (e.producing) {
    lines.push(`Producing ${labelFor(e.producing.kind)} (${Math.ceil(e.producing.remaining / TICKS_PER_SECOND)}s)`);
  }
  if (e.marked) lines.push("Marked objective");
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
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
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
  ctx.fillStyle = "rgba(12,14,10,0.92)";
  ctx.strokeStyle = "rgba(196,179,122,0.55)";
  ctx.lineWidth = 1;
  ctx.fillRect(tx, ty, width, height);
  ctx.strokeRect(tx, ty, width, height);
  ctx.fillStyle = "#f3e6c4";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = i === 0 ? "#f3e6c4" : "#c8c2a8";
    ctx.fillText(lines[i]!, tx + pad, ty + pad + 11 + i * lineH);
  }
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
