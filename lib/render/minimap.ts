import type { Entity, SimState } from "../types";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";
import { fogAt } from "../sim/fog";
import { terrainFieldPalette } from "../gen/assets";

const MINIMAP_RENDER_REV = "landforms-v3-organic-regions";

export type MinimapRegion = "ground" | "elevation-mid" | "elevation-high" | "water" | "resource" | "blocked" | "road" | "concrete";

export function minimapRegionForCell(state: SimState, x: number, y: number): MinimapRegion {
  const i = y * state.width + x;
  const surface = state.surfaces[i] ?? 0;
  if (surface === 1) return "road";
  if (surface === 2) return "concrete";
  const tile = state.tiles[i];
  if (tile === TILE_WATER) return "water";
  if (tile === TILE_RESOURCE) return "resource";
  if (tile === TILE_BLOCKED) return "blocked";
  const elev = state.heights[i] ?? 1;
  if (elev >= 3) return "elevation-high";
  if (elev === 2) return "elevation-mid";
  return "ground";
}

export function terrainColors(biome: SimState["biome"]): {
  low: string;
  mid: string;
  high: string;
  water: string;
  road: string;
  concrete: string;
  blocked: string;
} {
  const field = terrainFieldPalette(biome);
  const water = biome === "glass desert" || biome === "rust canyons" ? "#244953" : "#1c4b50";
  const road = biome === "tundra grid" ? "#486b70" : biome === "volcanic shelf" ? "#593832" : "#69523e";
  const concrete = biome === "glass desert" ? "#8a7c61" : field.dark;
  return {
    low: field.dark,
    mid: field.base,
    high: field.light,
    water,
    road,
    concrete,
    blocked: field.dark,
  };
}

function paintMinimapRegion(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  sx: number,
  sy: number,
  matches: (x: number, y: number) => boolean,
  fill: string,
  alpha = 1,
): void {
  const overlap = Math.max(0.35, Math.min(sx, sy) * 0.24);
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const fog = fogAt(state, x, y);
      if (fog === 0 || !matches(x, y)) continue;
      ctx.globalAlpha = alpha * (fog === 1 ? 0.42 : 1);
      ctx.fillStyle = fill;
      ctx.fillRect(x * sx - overlap, y * sy - overlap, sx + overlap * 2, sy + overlap * 2);
    }
  }
  ctx.globalAlpha = 1;
}

function entityColor(e: Entity, state: SimState): string {
  if (e.marked) return "#ffe066";
  const pal = state.factions[e.owner]?.palette;
  if (!pal) return "#888";
  if (e.class === "building") {
    if (e.kind === "turret") return pal.accent;
    if (e.kind === "constructionYard" || e.kind === "objective") return pal.light;
    return pal.primary;
  }
  if (e.kind === "harvester") return pal.accent;
  return pal.light;
}

let lastMinimapKey = "";

export function invalidateMinimap(): void {
  lastMinimapKey = "";
}

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  view: { x: number; y: number }[],
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const viewKey = view.length
    ? `${view[0]!.x.toFixed(2)},${view[0]!.y.toFixed(2)}:${view[2] ? `${view[2].x.toFixed(2)},${view[2].y.toFixed(2)}` : ""}`
    : "";
  const palKey = `${state.factions[0]?.palette.primary ?? ""}:${state.factions[1]?.palette.primary ?? ""}`;
  const key = `${MINIMAP_RENDER_REV}:${state.seed}:${state.tick}:${state.result}:${w}x${h}:${viewKey}:${state.entities.length}:${palKey}`;
  if (key === lastMinimapKey) return;
  lastMinimapKey = key;
  const colors = terrainColors(state.biome);
  const sx = w / state.width;
  const sy = h / state.height;
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, colors.high);
  base.addColorStop(0.48, colors.mid);
  base.addColorStop(1, colors.low);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  paintMinimapRegion(ctx, state, sx, sy, (x, y) => minimapRegionForCell(state, x, y) === "elevation-mid", colors.mid, 0.76);
  paintMinimapRegion(ctx, state, sx, sy, (x, y) => minimapRegionForCell(state, x, y) === "elevation-high", colors.high, 0.86);
  paintMinimapRegion(ctx, state, sx, sy, (x, y) => minimapRegionForCell(state, x, y) === "water", colors.water);
  paintMinimapRegion(ctx, state, sx, sy, (x, y) => minimapRegionForCell(state, x, y) === "blocked", colors.blocked, 0.9);
  paintMinimapRegion(ctx, state, sx, sy, (x, y) => minimapRegionForCell(state, x, y) === "road", colors.road, 0.95);
  paintMinimapRegion(ctx, state, sx, sy, (x, y) => minimapRegionForCell(state, x, y) === "concrete", colors.concrete, 0.95);
  paintMinimapRegion(ctx, state, sx, sy, (x, y) => minimapRegionForCell(state, x, y) === "resource", "#c4a040", 0.95);
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    const fog = fogAt(state, Math.round(e.x), Math.round(e.y));
    if (e.owner === 1 && fog !== 2) continue;
    ctx.fillStyle = entityColor(e, state);
    const bw = e.class === "building" ? 6 : 3;
    const bh = e.class === "building" ? 6 : 3;
    ctx.fillRect(e.x * sx - 1, e.y * sy - 1, bw, bh);
  }
  if (view.length >= 2) {
    ctx.beginPath();
    for (let i = 0; i < view.length; i++) {
      const p = view[i]!;
      const px = p.x * sx;
      const py = p.y * sy;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 248, 210, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "#fff8e8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
