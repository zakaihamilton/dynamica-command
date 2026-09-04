import { tileCliffGeometry } from "../../gen/cliffGeometry";
import { cliffFaces, mixHex } from "../../gen/tilePalette";
import type { TerrainLightRig } from "../terrainLighting";

function shadeHex(value: string, factor: number): string {
  const r = Number.parseInt(value.slice(1, 3), 16);
  const g = Number.parseInt(value.slice(3, 5), 16);
  const b = Number.parseInt(value.slice(5, 7), 16);
  return `#${[r, g, b].map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor))).toString(16).padStart(2, "0")).join("")}`;
}

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
  light?: TerrainLightRig,
): void {
  const geo = tileCliffGeometry(tw, th, heightStep, dropE, dropS, seed, tileX, tileY);
  const shadowY = originY + Math.max(1, heightStep * 0.08);
  const southColor = light ? shadeHex(colors.south, 0.91 + light.directionY * 0.07) : colors.south;
  const eastColor = light ? shadeHex(colors.east, 0.96 + light.directionX * 0.07) : colors.east;
  if (geo.south) {
    fillElevationPoly(ctx, originX, shadowY, geo.south.points, mixHex(southColor, "#0d1519", 0.34));
    fillElevationPoly(ctx, originX, originY, geo.south.points, southColor);
    fillFaceStrata(ctx, originX, originY, geo.south.points, southColor, 0.26, 0.47, 0.24);
    fillFaceStrata(ctx, originX, originY, geo.south.points, southColor, 0.58, 0.71, 0.12);
    strokeRim(ctx, originX, originY, geo.south.points, southColor);
    strokeCracks(ctx, originX, originY, geo.south.cracks, colors.southInk);
  }
  if (geo.east) {
    fillElevationPoly(ctx, originX, shadowY, geo.east.points, mixHex(eastColor, "#0d1519", 0.34));
    fillElevationPoly(ctx, originX, originY, geo.east.points, eastColor);
    fillFaceStrata(ctx, originX, originY, geo.east.points, eastColor, 0.26, 0.47, 0.24);
    fillFaceStrata(ctx, originX, originY, geo.east.points, eastColor, 0.58, 0.71, 0.12);
    strokeRim(ctx, originX, originY, geo.east.points, eastColor);
    strokeCracks(ctx, originX, originY, geo.east.cracks, colors.eastInk);
  }
  if (geo.wedge) {
    const fill = mixHex(southColor, eastColor, 0.42);
    fillElevationPoly(ctx, originX, shadowY, geo.wedge, mixHex(fill, "#0d1519", 0.34));
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
  t0: number,
  t1: number,
  shade: number,
): void {
  if (points.length < 12 || points.length % 4 !== 0) return;
  const samples = points.length / 4;
  const band: number[] = [];
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
  fillElevationPoly(ctx, ox, oy, band, mixHex(color, "#0d1519", shade));
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
  const previousAlpha = typeof ctx.globalAlpha === "number" ? ctx.globalAlpha : 1;
  ctx.globalAlpha = previousAlpha * 0.62;
  ctx.strokeStyle = mixHex(color, "#e2ebe4", 0.24);
  ctx.lineWidth = 0.9;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ox + points[0]!, oy + points[1]!);
  for (let i = 1; i < samples; i++) {
    ctx.lineTo(ox + points[i * 2]!, oy + points[i * 2 + 1]!);
  }
  ctx.stroke();
  ctx.globalAlpha = previousAlpha;
}

function strokeCracks(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cracks: number[][],
  stroke: string,
): void {
  if (!cracks.length) return;
  const previousAlpha = typeof ctx.globalAlpha === "number" ? ctx.globalAlpha : 1;
  ctx.globalAlpha = previousAlpha * 0.66;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.85;
  for (const crack of cracks) {
    ctx.beginPath();
    ctx.moveTo(ox + crack[0]!, oy + crack[1]!);
    ctx.lineTo(ox + crack[2]!, oy + crack[3]!);
    ctx.stroke();
  }
  ctx.globalAlpha = previousAlpha;
}
