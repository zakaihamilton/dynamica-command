import { isoDiamondPath } from "../isoDiamond";

export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  isoDiamondPath(ctx, x, y, w, h);
  ctx.fill();
}

export function drawDiamondStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  isoDiamondPath(ctx, x, y, w, h);
  ctx.stroke();
}
