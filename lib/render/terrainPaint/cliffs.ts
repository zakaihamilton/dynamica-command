import { tileCliffGeometry } from "../../gen/cliffGeometry";
import { cliffFaces, mixHex } from "../../gen/tilePalette";

export function drawElevationFaces(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  tw: number,
  th: number,
  heightStep: number,
  dropE: number,
  dropS: number,
  seed: number,
  colors: ReturnType<typeof cliffFaces>,
  tileX = 0,
  tileY = 0,
): void {
  const geo = tileCliffGeometry(tw, th, heightStep, dropE, dropS, seed, tileX, tileY);
  const shadowY = originY + Math.max(1, heightStep * 0.08);
  if (geo.south) {
    fillElevationPoly(ctx, originX, shadowY, geo.south.points, mixHex(colors.south, "#0d1519", 0.48));
    fillElevationPoly(ctx, originX, originY, geo.south.points, colors.south);
    strokeCracks(ctx, originX, originY, geo.south.cracks, colors.southInk);
  }
  if (geo.east) {
    fillElevationPoly(ctx, originX, shadowY, geo.east.points, mixHex(colors.east, "#0d1519", 0.48));
    fillElevationPoly(ctx, originX, originY, geo.east.points, colors.east);
    strokeCracks(ctx, originX, originY, geo.east.cracks, colors.eastInk);
  }
  if (geo.wedge) {
    const fill = mixHex(colors.south, colors.east, 0.42);
    fillElevationPoly(ctx, originX, shadowY, geo.wedge, mixHex(fill, "#0d1519", 0.48));
    fillElevationPoly(ctx, originX, originY, geo.wedge, fill);
  }
}

export function fillElevationPoly(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  points: number[],
  fill?: string,
  stroke = false,
): void {
  if (points.length < 6) return;
  ctx.beginPath();
  ctx.moveTo(ox + points[0]!, oy + points[1]!);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(ox + points[i]!, oy + points[i + 1]!);
  }
  ctx.closePath();
  if (fill !== undefined) ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}

function strokeCracks(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cracks: number[][],
  stroke: string,
): void {
  if (!cracks.length) return;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  for (const crack of cracks) {
    ctx.beginPath();
    ctx.moveTo(ox + crack[0]!, oy + crack[1]!);
    ctx.lineTo(ox + crack[2]!, oy + crack[3]!);
    ctx.stroke();
  }
}
