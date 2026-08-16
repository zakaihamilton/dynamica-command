import type { BuildingKind, Entity, Owner, SimState, UnitKind } from "../types";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";

const BUILDING_SHADES: Record<Owner, Record<BuildingKind, string>> = {
  0: {
    constructionYard: "#b9f3ff",
    power: "#63d8c3",
    refinery: "#80b7ff",
    barracks: "#b39aff",
    factory: "#64e68a",
    turret: "#ffe07a",
    objective: "#ffe066",
  },
  1: {
    constructionYard: "#ffb0a7",
    power: "#ff806f",
    refinery: "#ff9b73",
    barracks: "#e889b8",
    factory: "#ffbd68",
    turret: "#ff6f61",
    objective: "#ffe066",
  },
};

const UNIT_SHADES: Record<Owner, Record<UnitKind, string>> = {
  0: {
    harvester: "#b8f5bd",
    infantry: "#7ec8ff",
    antiArmor: "#59aaff",
    tank: "#c8b5ff",
  },
  1: {
    harvester: "#ffb8a5",
    infantry: "#ff7770",
    antiArmor: "#ff9c64",
    tank: "#f18bc4",
  },
};

function entityColor(e: Entity): string {
  if (e.marked) return "#ffe066";
  if (e.class === "building") return BUILDING_SHADES[e.owner][e.kind as BuildingKind];
  return UNIT_SHADES[e.owner][e.kind as UnitKind];
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
  const key = `${state.seed}:${state.tick}:${state.result}:${w}x${h}:${viewKey}:${state.entities.length}`;
  if (key === lastMinimapKey) return;
  lastMinimapKey = key;
  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);
  const sx = w / state.width;
  const sy = h / state.height;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const fog = state.fog[y * state.width + x] ?? 0;
      if (fog === 0) continue;
      const t = state.tiles[y * state.width + x]!;
      const elev = state.heights[y * state.width + x] ?? 1;
      ctx.fillStyle =
        t === TILE_WATER
          ? "#1a3a55"
          : t === TILE_RESOURCE
            ? "#a6c83b"
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
    const fog = state.fog[Math.round(e.y) * state.width + Math.round(e.x)] ?? 0;
    if (e.owner === 1 && fog !== 2) continue;
    ctx.fillStyle = entityColor(e);
    const bw = e.class === "building" ? 5 : 3;
    const bh = e.class === "building" ? 5 : 3;
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
