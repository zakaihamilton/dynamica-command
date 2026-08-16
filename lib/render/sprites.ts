import type { ShapeSpec, SpriteSpec } from "../types";
import { paintSvg } from "./svgPaint";

export function paintShapes(ctx: CanvasRenderingContext2D, shapes: ShapeSpec[]): void {
  for (const s of shapes) {
    ctx.save();
    if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
    ctx.fillStyle = s.fill;
    ctx.strokeStyle = s.stroke ?? s.fill;
    ctx.lineWidth = s.strokeWidth ?? 1;
    ctx.beginPath();
    if (s.type === "rect") {
      if (s.fill !== "transparent") ctx.fillRect(s.x, s.y, s.w, s.h);
      if (s.stroke) ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === "ellipse") {
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      if (s.fill !== "transparent") ctx.fill();
      if (s.stroke) ctx.stroke();
    } else if (s.type === "diamond") {
      ctx.moveTo(s.x + s.w / 2, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h / 2);
      ctx.lineTo(s.x + s.w / 2, s.y + s.h);
      ctx.lineTo(s.x, s.y + s.h / 2);
      ctx.closePath();
      if (s.fill !== "transparent") ctx.fill();
      if (s.stroke) ctx.stroke();
    } else if (s.type === "line") {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      ctx.stroke();
    } else if (s.type === "poly" && s.points) {
      ctx.moveTo(s.points[0]!, s.points[1]!);
      for (let i = 2; i < s.points.length; i += 2) {
        ctx.lineTo(s.points[i]!, s.points[i + 1]!);
      }
      ctx.closePath();
      if (s.fill !== "transparent") ctx.fill();
      if (s.stroke) ctx.stroke();
    }
    ctx.restore();
  }
}

const cache = new Map<string, HTMLCanvasElement>();
const SVG_RASTER_SCALE = 2;

export function rasterize(spec: SpriteSpec): HTMLCanvasElement {
  const hit = cache.get(spec.id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  if (spec.svg) {
    c.width = spec.w * SVG_RASTER_SCALE;
    c.height = spec.h * SVG_RASTER_SCALE;
    const ctx = c.getContext("2d")!;
    ctx.scale(SVG_RASTER_SCALE, SVG_RASTER_SCALE);
    paintSvg(ctx, spec.svg);
  } else {
    c.width = spec.w;
    c.height = spec.h;
    paintShapes(c.getContext("2d")!, spec.shapes);
  }
  cache.set(spec.id, c);
  return c;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spec: SpriteSpec,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const smooth = Boolean(spec.svg);
  ctx.imageSmoothingEnabled = smooth;
  if (smooth && "imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = false;
}

export function cachedSprite(id: string): HTMLCanvasElement | undefined {
  return cache.get(id);
}

export function clearSpriteCache(): void {
  cache.clear();
}
