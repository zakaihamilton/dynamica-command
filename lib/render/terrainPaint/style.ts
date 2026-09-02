import type { Rgb } from "../terrainMaterials";

export function rgbOf(c: Rgb): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: Math.round(a.r + (b.r - a.r) * u),
    g: Math.round(a.g + (b.g - a.g) * u),
    b: Math.round(a.b + (b.b - a.b) * u),
  };
}

/** Scale the current alpha for a nested fill without resetting parent fog. */
export function withAlpha(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  paint: () => void,
): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  paint();
  ctx.restore();
}
