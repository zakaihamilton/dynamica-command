import type { SpriteSpec } from "../types";

export type SpriteBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export function rotatedSpriteBounds(
  spec: Pick<SpriteSpec, "w" | "h" | "rotation" | "anchorX" | "anchorY">,
): SpriteBounds {
  if (!spec.rotation) return { minX: 0, minY: 0, width: spec.w, height: spec.h };

  const angle = spec.rotation;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const anchorX = spec.anchorX ?? spec.w / 2;
  const anchorY = spec.anchorY ?? spec.h;
  const corners = [
    [0, 0],
    [spec.w, 0],
    [spec.w, spec.h],
    [0, spec.h],
  ].map(([x, y]) => [
    anchorX + (x - anchorX) * cos - (y - anchorY) * sin,
    anchorY + (x - anchorX) * sin + (y - anchorY) * cos,
  ]);
  const xs = corners.map(([x]) => x!);
  const ys = corners.map(([, y]) => y!);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    minX,
    minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}
