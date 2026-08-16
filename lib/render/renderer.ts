import { buildingSprite, tileSprite, unitSprite } from "../gen/assets";
import type { BuildingKind, SimState, UnitKind } from "../types";
import { TILE_RESOURCE, TILE_WATER } from "../types";
import { TILE_H, TILE_W, tileToScreen, type Camera } from "./iso";
import { rasterize } from "./sprites";

function tileKind(t: number): "clear" | "water" | "resource" {
  if (t === TILE_WATER) return "water";
  if (t === TILE_RESOURCE) return "resource";
  return "clear";
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  selected: Set<number>,
  hoverTile: { x: number; y: number } | null,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = "#07090c";
  ctx.fillRect(0, 0, w, h);

  const margin = TILE_W * cam.zoom;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const s = tileToScreen(x, y, cam);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      const fog = state.fog[y * state.width + x] ?? 0;
      if (fog === 0) {
        ctx.fillStyle = "#050608";
        drawDiamond(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
        continue;
      }
      const spec = tileSprite(tileKind(state.tiles[y * state.width + x]!));
      const img = rasterize(spec);
      ctx.globalAlpha = fog === 1 ? 0.45 : 1;
      ctx.drawImage(img, s.x - (TILE_W / 2) * cam.zoom, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
      ctx.globalAlpha = 1;
    }
  }

  const drawables = state.entities
    .filter((e) => e.hp > 0)
    .sort((a, b) => a.x + a.y - (b.x + b.y));

  for (const e of drawables) {
    const tx = Math.round(e.x);
    const ty = Math.round(e.y);
    const fog = state.fog[ty * state.width + tx] ?? 0;
    if (e.owner === 1 && fog !== 2) continue;
    const pal = state.factions[e.owner]!.palette;
    const spec =
      e.class === "unit"
        ? unitSprite(e.kind as UnitKind, pal)
        : buildingSprite(e.kind as BuildingKind, pal);
    const img = rasterize(spec);
    const s = tileToScreen(e.x, e.y, cam);
    const dw = spec.w * cam.zoom * 0.7;
    const dh = spec.h * cam.zoom * 0.7;
    ctx.drawImage(img, s.x - dw / 2, s.y - dh + 8 * cam.zoom, dw, dh);
    if (selected.has(e.id)) {
      ctx.strokeStyle = "#f5e6a8";
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - dw / 2, s.y - dh + 8 * cam.zoom, dw, dh);
    }
    if (e.marked) {
      ctx.strokeStyle = "#ffcf33";
      ctx.beginPath();
      ctx.arc(s.x, s.y - dh / 2, 10 * cam.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
    const hpRatio = e.hp / e.maxHp;
    ctx.fillStyle = "#111";
    ctx.fillRect(s.x - 12 * cam.zoom, s.y + 4, 24 * cam.zoom, 3);
    ctx.fillStyle = hpRatio > 0.4 ? "#3dba6a" : "#d45";
    ctx.fillRect(s.x - 12 * cam.zoom, s.y + 4, 24 * cam.zoom * hpRatio, 3);
    if (e.constructing > 0) {
      ctx.fillStyle = "#9cf";
      ctx.fillRect(s.x - 12 * cam.zoom, s.y + 8, 24 * cam.zoom * 0.5, 2);
    }
  }

  if (hoverTile) {
    const s = tileToScreen(hoverTile.x, hoverTile.y, cam);
    ctx.strokeStyle = "rgba(255,255,200,0.7)";
    ctx.lineWidth = 1.5;
    drawDiamondStroke(ctx, s.x, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
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
