import {
  type BiomeName,
  type CampaignVisualProfile,
  type Palette,
  type ShapeSpec,
} from "../types";
import { generateCampaignVisualProfile } from "./visualProfile";

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

export function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return (x ^ (x >>> 16)) >>> 0;
}

export function pick(v: number, lane: number, mod: number): number {
  return hash(v + lane * 374761) % Math.max(1, mod);
}

export function signed(v: number, lane: number, span: number): number {
  return pick(v, lane, span * 2 + 1) - span;
}

export function mixHex(a: string, b: string, amount: number): string {
  const parse = (value: string): [number, number, number] => [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const from = parse(a);
  const to = parse(b);
  const t = Math.max(0, Math.min(1, amount));
  return `#${[0, 1, 2].map((i) => Math.round(from[i]! + (to[i]! - from[i]!) * t).toString(16).padStart(2, "0")).join("")}`;
}

export const TERRAIN: Record<BiomeName, [string, string, string, string]> = {
  "ash plains": ["#586b5c", "#303d36", "#8b9e83", "#202b28"],
  "crystal flats": ["#4f7772", "#2d4d4d", "#9ac8ba", "#1e3739"],
  "rust canyons": ["#89553b", "#4c2a25", "#ba8051", "#2a1b1b"],
  "salt marshes": ["#4f7059", "#2c4439", "#849d72", "#1e2e29"],
  "glass desert": ["#a0855b", "#5b4934", "#d0b783", "#3a2a21"],
  "tundra grid": ["#5f7f83", "#334c56", "#a8c9c6", "#1d3038"],
  "jungle wreckage": ["#3d6544", "#203c29", "#67945b", "#13251b"],
  "volcanic shelf": ["#624844", "#332326", "#9a7062", "#241719"],
};

export const ORE = {
  stainLo: "#4a3c18",
  stain: "#6e5a28",
  stainHi: "#9a7a34",
  south: "#8a6a24",
  east: "#c4a040",
  top: "#e8c45a",
  lit: "#f6de7a",
  glint: "#fff4c4",
  crystal: "#d8c24c",
  crystalLit: "#f3e89a",
  ink: "#2a220e",
} as const;

export function terrainPalette(biome: BiomeName, elev: number, campaign: CampaignVisualProfile): Palette {
  const [base, dark, light, outline] = TERRAIN[biome];
  const tier = Math.max(0, Math.min(3, elev));
  const mid = tier === 2;
  const high = tier >= 3;
  const palette = {
    primary: high ? light : mid ? mixHex(base, light, 0.34) : tier === 0 ? dark : base,
    secondary: high ? base : mid ? mixHex(dark, base, 0.42) : dark,
    accent: light,
    outline,
    light: high ? mixHex(light, "#f4f1d8", 0.28) : mid ? mixHex(light, "#e7e2c2", 0.12) : light,
    dark,
  };
  const campaignAccent = campaign.terrainAccent === "amber"
    ? "#e7ae63"
    : campaign.terrainAccent === "red"
      ? "#d87868"
      : "#79d5df";
  if (campaign.family === 0) {
    return { ...palette, accent: mixHex(palette.accent, campaignAccent, 0.64), outline: "#263640" };
  }
  if (campaign.family === 1) {
    return { ...palette, primary: mixHex(palette.primary, "#67727e", 0.14), accent: mixHex(palette.accent, campaignAccent, 0.4), outline: "#222a31" };
  }
  return { ...palette, primary: mixHex(palette.primary, "#7e6a52", 0.16), accent: mixHex(palette.accent, campaignAccent, 0.58), outline: "#302a25" };
}

export function terrainZonePalette(palette: Palette, variant: number): Palette {
  // The high bits are supplied by the renderer from a coarse map coordinate.
  // They let several neighboring tiles share a material drift while the low
  // bits continue to provide local detail.
  const zone = hash((variant >>> 8) + 173) % 7;
  if (zone === 0) {
    return {
      ...palette,
      primary: mixHex(palette.primary, palette.dark, 0.22),
      secondary: mixHex(palette.secondary, palette.dark, 0.26),
      light: mixHex(palette.light, palette.primary, 0.12),
    };
  }
  if (zone === 1 || zone === 2) {
    return {
      ...palette,
      primary: mixHex(palette.primary, palette.light, zone === 1 ? 0.18 : 0.12),
      secondary: mixHex(palette.secondary, palette.primary, 0.18),
    };
  }
  if (zone === 3) {
    return {
      ...palette,
      primary: mixHex(palette.primary, palette.accent, 0.12),
      secondary: mixHex(palette.secondary, palette.accent, 0.08),
      outline: mixHex(palette.outline, "#152329", 0.26),
    };
  }
  if (zone === 4) {
    return {
      ...palette,
      primary: mixHex(palette.primary, palette.secondary, 0.2),
      light: mixHex(palette.light, palette.accent, 0.1),
    };
  }
  return palette;
}

export function terrainFieldPalette(
  biome: BiomeName,
  campaign: CampaignVisualProfile = generateCampaignVisualProfile(0),
): { base: string; dark: string; light: string } {
  const palette = terrainPalette(biome, 1, campaign);
  return {
    base: mixHex(palette.primary, palette.light, 0.22),
    dark: mixHex(palette.dark, palette.primary, 0.28),
    light: mixHex(palette.light, "#d0e2d4", 0.14),
  };
}
