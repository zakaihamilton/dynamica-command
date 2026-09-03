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
    fillFaceStrata(ctx, originX, originY, geo.south.points, colors.south);
    strokeRim(ctx, originX, originY, geo.south.points, colors.south);
    strokeCracks(ctx, originX, originY, geo.south.cracks, colors.southInk);
  }
  if (geo.east) {
    fillElevationPoly(ctx, originX, shadowY, geo.east.points, mixHex(colors.east, "#0d1519", 0.48));
    fillElevationPoly(ctx, originX, originY, geo.east.points, colors.east);
    fillFaceStrata(ctx, originX, originY, geo.east.points, colors.east);
    strokeRim(ctx, originX, originY, geo.east.points, colors.east);
    strokeCracks(ctx, originX, originY, geo.east.cracks, colors.eastInk);
  }
  if (geo.wedge) {
    const fill = mixHex(colors.south, colors.east, 0.42);
    fillElevationPoly(ctx, originX, shadowY, geo.wedge, mixHex(fill, "#0d1519", 0.48));
    fillElevationPoly(ctx, originX, originY, geo.wedge, mixHex(fill, "#f2efe4", 0.08));
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

function fillFaceStrata(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  points: number[],
  color: string,
): void {
  if (points.length < 12 || points.length % 4 !== 0) return;
  const samples = points.length / 4;
  const band: number[] = [];
  const t0 = 0.32;
  const t1 = 0.54;
  for (let i = 0; i < samples; i++) {
    const tx = points[i * 2]!;
    const ty = points[i * 2 + 1]!;
    const botIndex = points.length / 2 - 1 - i;
    const bx = points[botIndex * 2]!;
    const by = points[botIndex * 2 + 1]!;
    band.push(tx + (bx - tx) * t0, ty + (by - ty) * t0);
  }
  for (let i = samples - 1; i >= 0; i--) {
    const tx = points[i * 2]!;
    const ty = points[i * 2 + 1]!;
    const botIndex = points.length / 2 - 1 - i;
    const bx = points[botIndex * 2]!;
    const by = points[botIndex * 2 + 1]!;
    band.push(tx + (bx - tx) * t1, ty + (by - ty) * t1);
  }
  fillElevationPoly(ctx, ox, oy, band, mixHex(color, "#0d1519", 0.28));
}

function strokeRim(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  points: number[],
  color: string,
): void {
  if (points.length < 8 || points.length % 4 !== 0) return;
  const samples = points.length / 4;
  ctx.strokeStyle = mixHex(color, "#f2efe4", 0.38);
  ctx.lineWidth = 1.15;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ox + points[0]!, oy + points[1]!);
  for (let i = 1; i < samples; i++) {
    ctx.lineTo(ox + points[i * 2]!, oy + points[i * 2 + 1]!);
  }
  ctx.stroke();
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
