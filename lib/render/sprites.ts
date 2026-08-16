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

export function rasterize(spec: SpriteSpec): HTMLCanvasElement {
  const hit = cache.get(spec.id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = spec.w;
  c.height = spec.h;
  if (spec.svg) {
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    paintSvg(ctx, spec.svg);
    cache.set(spec.id, c);
    return c;
  }
  const pixelScale = Math.max(1, spec.pixelScale ?? 1);
  const source = document.createElement("canvas");
  source.width = Math.max(1, Math.ceil(spec.w / pixelScale));
  source.height = Math.max(1, Math.ceil(spec.h / pixelScale));
  const sourceCtx = source.getContext("2d")!;
  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.lineJoin = "round";
  sourceCtx.lineCap = "round";
  sourceCtx.scale(1 / pixelScale, 1 / pixelScale);
  paintShapes(sourceCtx, spec.shapes);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, spec.w, spec.h);
  cache.set(spec.id, c);
  return c;
}

export function cachedSprite(id: string): HTMLCanvasElement | undefined {
  return cache.get(id);
}

export function clearSpriteCache(): void {
  cache.clear();
}
