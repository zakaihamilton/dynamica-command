import type { AnimFrame, UnitKind } from "../types";

export function paintUnitMovementFx(
  ctx: CanvasRenderingContext2D,
  kind: UnitKind,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  groundY: number,
  scale: number,
  frame: AnimFrame,
  alpha: number,
): void {
  const infantry = kind === "infantry" || kind === "antiArmor";
  ctx.save();
  // The ground contact stays fixed while the sprite animates above it. This
  // gives the eye a stable reference and prevents movement marks from making
  // the unit look like it is drifting.
  ctx.globalAlpha = alpha * (infantry ? 0.2 : 0.28);
  ctx.fillStyle = "#05090c";
  ctx.beginPath();
  ctx.ellipse(
    dx + dw * 0.5,
    groundY + scale * 1.5,
    dw * (infantry ? 0.18 : 0.34),
    scale * (infantry ? 1.8 : 3.2),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.globalAlpha = alpha * (infantry ? 0.36 : 0.22);
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
    ctx.fillStyle = "#b7d6d7";
    // Keep small horizontal highlights inside the visible tread band. The
    // old diagonal strokes could land in transparent padding and read as
    // stray lines beside the unit.
    const treadY = dy + dh * 0.78;
    const left = dx + dw * 0.3;
    const right = dx + dw * 0.7;
    const spacing = Math.max(6 * scale, dw * 0.14);
    const offset = (frame % 2) * spacing * 0.5;
    for (let x = left - spacing + offset; x < right + spacing; x += spacing) {
      const width = Math.min(4 * scale, spacing * 0.55);
      ctx.fillRect(Math.round(x), Math.round(treadY), Math.max(1, Math.round(width)), Math.max(1, Math.round(scale * 0.7)));
    }
  }
  ctx.restore();
}
