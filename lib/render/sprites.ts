import type { ShapeSpec, SpriteSpec } from "../types";

export function paintShapes(ctx: CanvasRenderingContext2D, shapes: ShapeSpec[]): void {
  for (const s of shapes) {
    ctx.fillStyle = s.fill;
    ctx.beginPath();
    if (s.type === "rect") {
      ctx.fillRect(s.x, s.y, s.w, s.h);
    } else if (s.type === "ellipse") {
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.type === "diamond") {
      ctx.moveTo(s.x + s.w / 2, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h / 2);
      ctx.lineTo(s.x + s.w / 2, s.y + s.h);
      ctx.lineTo(s.x, s.y + s.h / 2);
      ctx.closePath();
      ctx.fill();
    } else if (s.type === "poly" && s.points) {
      ctx.moveTo(s.points[0]!, s.points[1]!);
      for (let i = 2; i < s.points.length; i += 2) {
        ctx.lineTo(s.points[i]!, s.points[i + 1]!);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>();

export function rasterize(spec: SpriteSpec): HTMLCanvasElement {
  const hit = cache.get(spec.id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = spec.w;
  c.height = spec.h;
  const ctx = c.getContext("2d")!;
  paintShapes(ctx, spec.shapes);
  cache.set(spec.id, c);
  return c;
}

export function clearSpriteCache(): void {
  cache.clear();
}
