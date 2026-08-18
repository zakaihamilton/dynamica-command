import type { AnimFrame, UnitKind } from "../types";

export function paintUnitMovementFx(
  ctx: CanvasRenderingContext2D,
  kind: UnitKind,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  scale: number,
  frame: AnimFrame,
  alpha: number,
): void {
  const infantry = kind === "infantry" || kind === "antiArmor";
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.globalAlpha = alpha * (infantry ? 0.48 : 0.34);
  ctx.lineCap = "square";
  if (infantry) {
    ctx.strokeStyle = "#a9c1c4";
    ctx.lineWidth = Math.max(1, scale * 0.8);
    const stride = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    const y = dy + dh * 0.91;
    for (const leg of [0.39, 0.61]) {
      const x = dx + dw * leg + stride * scale;
      ctx.beginPath();
      ctx.moveTo(x - 2 * scale, y);
      ctx.lineTo(x + 2 * scale, y);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "#b7d6d7";
    ctx.lineWidth = Math.max(1, scale * 0.9);
    const treadY = dy + dh * 0.86;
    const left = dx + dw * 0.19;
    const right = dx + dw * 0.81;
    const spacing = Math.max(4 * scale, dw * 0.11);
    const offset = frame * spacing * 0.25;
    for (let x = left - spacing + offset; x < right + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, treadY - 1.5 * scale);
      ctx.lineTo(x + 2.5 * scale, treadY + 1.5 * scale);
      ctx.stroke();
    }
  }
  ctx.restore();
}
