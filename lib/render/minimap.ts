import type { SimState } from "../types";
import { TILE_RESOURCE, TILE_WATER } from "../types";

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  view: { x0: number; y0: number; x1: number; y1: number },
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);
  const sx = w / state.width;
  const sy = h / state.height;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const fog = state.fog[y * state.width + x] ?? 0;
      if (fog === 0) continue;
      const t = state.tiles[y * state.width + x]!;
      ctx.fillStyle =
        t === TILE_WATER ? "#1a3a55" : t === TILE_RESOURCE ? "#2f8a3a" : "#2a3324";
      ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
    }
  }
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    const fog = state.fog[Math.round(e.y) * state.width + Math.round(e.x)] ?? 0;
    if (e.owner === 1 && fog !== 2) continue;
    ctx.fillStyle = e.marked ? "#ffe066" : e.owner === 0 ? "#7ec8ff" : "#e35";
    ctx.fillRect(e.x * sx - 1, e.y * sy - 1, 3, 3);
  }
  ctx.strokeStyle = "#fff8";
  ctx.strokeRect(view.x0 * sx, view.y0 * sy, (view.x1 - view.x0) * sx, (view.y1 - view.y0) * sy);
}
