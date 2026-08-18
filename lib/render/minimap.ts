import type { Entity, SimState } from "../types";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";
import { fogAt } from "../sim/fog";

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
  const key = `${state.seed}:${state.tick}:${state.result}:${w}x${h}:${viewKey}:${state.entities.length}:${palKey}`;
  if (key === lastMinimapKey) return;
  lastMinimapKey = key;
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);
  const sx = w / state.width;
  const sy = h / state.height;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const fog = fogAt(state, x, y);
      if (fog === 0) continue;
      const t = state.tiles[y * state.width + x]!;
      const elev = state.heights[y * state.width + x] ?? 1;
      ctx.fillStyle =
        t === TILE_WATER
          ? "#1a3a55"
          : t === TILE_RESOURCE
            ? "#c4a040"
            : t === TILE_BLOCKED
              ? "#171b17"
            : elev >= 3
              ? "#6a5a48"
              : elev === 2
                ? "#3d4a30"
                : elev <= 0
                  ? "#1e2a1c"
                  : "#2a3324";
      ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
    }
  }
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
