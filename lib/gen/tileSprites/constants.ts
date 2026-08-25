import { type BiomeName, type ShapeSpec, type TileContour } from "../../types";

export const TW = 64;
export const TH = 32;
export const TILE_SPRITE_PAD_X = 4;
export const TILE_SPRITE_PAD_Y = 4;
export const SPRITE_W = TW + TILE_SPRITE_PAD_X * 2;
export const SPRITE_H = TH + TILE_SPRITE_PAD_Y * 2;
export const INK = "#202a32";
export const ART_PIXEL_SCALE = 1;
export const TERRAIN_ART_REV = "tactical-surface-v8-water-basin";

export function tileCx(): number {
  return TILE_SPRITE_PAD_X + TW / 2;
}

export function tileCy(): number {
  return TILE_SPRITE_PAD_Y + TH / 2;
}

export function poly(points: number[], fill: string, stroke?: string, strokeWidth = 1): ShapeSpec {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { type: "poly", x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, fill, stroke, strokeWidth, points };
}

export function ell(x: number, y: number, w: number, h: number, fill: string, stroke?: string): ShapeSpec {
  return { type: "ellipse", x, y, w, h, fill, stroke, strokeWidth: stroke ? 1 : undefined };
}

export function line(x: number, y: number, x2: number, y2: number, stroke: string, width = 2): ShapeSpec {
  return { type: "line", x, y, w: x2 - x, h: y2 - y, fill: "transparent", stroke, strokeWidth: width };
}

export function irregularIso(cx: number, cy: number, w: number, h: number, _seed: number, out = 1): number[] {
  const hw = w / 2;
  const hh = h / 2;
  const bevel = Math.max(1, out);
  return [
    cx, cy - hh,
    cx + hw - bevel, cy - bevel * 0.45,
    cx + hw, cy,
    cx + hw - bevel, cy + bevel * 0.45,
    cx, cy + hh,
    cx - hw + bevel, cy + bevel * 0.45,
    cx - hw, cy,
    cx - hw + bevel, cy - bevel * 0.45,
  ];
}

export function defaultContour(kind: "clear" | "water" | "resource" | "blocked", elev: number): TileContour {
  if (kind === "water") return "bank";
  if (kind === "blocked" && elev >= 2) return "ridge";
  if (elev >= 3) return "ridge";
  return "none";
}

export function arid(biome: BiomeName): boolean {
  return biome === "glass desert" || biome === "rust canyons" || biome === "volcanic shelf";
}

export function lush(biome: BiomeName): boolean {
  return biome === "jungle wreckage" || biome === "salt marshes";
}
