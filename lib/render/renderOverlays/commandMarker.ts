import { TILE_H, tileToScreen, type Camera } from "../../iso";
import { heightAt } from "../../sim/world";
import type { SimState } from "../../types";
import type { CommandMarker, CommandMarkerKind } from "./types";

export const COMMAND_MARKER_DURATION_MS = 650;

export const COMMAND_MARKER_COLORS: Record<CommandMarkerKind, { stroke: string; shadow: string; fill: string }> = {
  move: { stroke: "#8dffc8", shadow: "#43e69a", fill: "#d7ffe9" },
  attack: { stroke: "#ff7a6e", shadow: "#e04538", fill: "#ffd4ce" },
  harvest: { stroke: "#ffd07a", shadow: "#e0a040", fill: "#ffe9c4" },
  support: { stroke: "#7ad4ff", shadow: "#3aa0e0", fill: "#d4f2ff" },
};

function ordersUnits(command: { type: string; unitIds?: number[] }): boolean {
  return (command.unitIds?.length ?? 0) > 0;
}

export function commandMarkerKind(commands: { type: string; unitIds?: number[] }[]): CommandMarkerKind | null {
  const issued = commands.filter(ordersUnits);
  if (issued.some((command) => command.type === "attack" || command.type === "attackMove")) return "attack";
  if (issued.some((command) => command.type === "harvest")) return "harvest";
  if (issued.some((command) => command.type === "support")) return "support";
  if (issued.some((command) => command.type === "move")) return "move";
  return null;
}

export function drawCommandMarker(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  marker: CommandMarker | null | undefined,
  nowMs: number,
): void {
  if (!marker) return;
  const progress = (nowMs - marker.bornMs) / COMMAND_MARKER_DURATION_MS;
  if (progress < 0 || progress >= 1) return;

  const z = cam.zoom;
  const s = tileToScreen(marker.x, marker.y, cam, heightAt(state, marker.x, marker.y));
  const groundY = s.y + (TILE_H / 2) * z;
  const fade = 1 - progress;
  const radius = (8 + progress * 18) * z;
  const colors = COMMAND_MARKER_COLORS[marker.kind ?? "move"];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = fade;
  ctx.strokeStyle = colors.stroke;
  ctx.shadowColor = colors.shadow;
  ctx.shadowBlur = 8 * z;
  ctx.lineWidth = Math.max(1.5, 2 * z);
  ctx.beginPath();
  ctx.ellipse(s.x, groundY, radius, radius * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, z);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const inner = radius * 0.9;
    const outer = radius * 1.28;
    ctx.beginPath();
    ctx.moveTo(s.x + Math.cos(angle) * inner, groundY + Math.sin(angle) * inner * 0.45);
    ctx.lineTo(s.x + Math.cos(angle) * outer, groundY + Math.sin(angle) * outer * 0.45);
    ctx.stroke();
  }

  ctx.fillStyle = colors.fill;
  ctx.beginPath();
  ctx.moveTo(s.x, groundY - 5 * z);
  ctx.lineTo(s.x + 5 * z, groundY);
  ctx.lineTo(s.x, groundY + 5 * z);
  ctx.lineTo(s.x - 5 * z, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
