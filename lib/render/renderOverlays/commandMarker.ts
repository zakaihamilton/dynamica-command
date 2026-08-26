import { TILE_H, tileToScreen, type Camera } from "../../iso";
import { heightAt } from "../../sim/world";
import type { SimState } from "../../types";
import type { CommandMarker } from "./types";

export const COMMAND_MARKER_DURATION_MS = 650;

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

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = fade;
  ctx.strokeStyle = "#8dffc8";
  ctx.shadowColor = "#43e69a";
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

  ctx.fillStyle = "#d7ffe9";
  ctx.beginPath();
  ctx.moveTo(s.x, groundY - 5 * z);
  ctx.lineTo(s.x + 5 * z, groundY);
  ctx.lineTo(s.x, groundY + 5 * z);
  ctx.lineTo(s.x - 5 * z, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
