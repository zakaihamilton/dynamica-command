import { MAP_SKIRT } from "../gen/map";
import type { Entity, SimState } from "../types";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";
import { fogAt } from "../sim/fog";
import { atlasPixelAtTile, fogTerrainGain, getTerrainAtlas, terrainColors } from "./terrainAtlas";

const MINIMAP_RENDER_REV = "world-atlas-v1";

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

export { terrainColors };

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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const atlas = getTerrainAtlas(state);
  const colors = terrainColors(state.biome);
  ctx.fillStyle = colors.low;
  ctx.fillRect(0, 0, w, h);
  if (atlas.canvas) {
    const sx = MAP_SKIRT * atlas.cell;
    const sy = MAP_SKIRT * atlas.cell;
    const sw = state.width * atlas.cell;
    const sh = state.height * atlas.cell;
    ctx.drawImage(atlas.canvas, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    const cellW = w / state.width;
    const cellH = h / state.height;
    const baked = atlas;
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const [r, g, b] = atlasPixelAtTile(baked, x, y);
        const gain = fogTerrainGain(fogAt(state, x, y));
        ctx.fillStyle = `rgb(${Math.round(r * gain)},${Math.round(g * gain)},${Math.round(b * gain)})`;
        ctx.fillRect(x * cellW, y * cellH, cellW + 0.6, cellH + 0.6);
      }
    }
  }
  if (atlas.canvas) {
    const cellW = w / state.width;
    const cellH = h / state.height;
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const gain = fogTerrainGain(fogAt(state, x, y));
        if (gain >= 0.98) continue;
        ctx.fillStyle = `rgba(8,13,17,${1 - gain})`;
        ctx.fillRect(x * cellW, y * cellH, cellW + 0.6, cellH + 0.6);
      }
    }
  }
  const sx = w / state.width;
  const sy = h / state.height;
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
