import {
  SURFACE_CONCRETE,
  SURFACE_ROAD,
  type BiomeName,
  type CampaignVisualProfile,
  type Palette,
  type ShapeSpec,
  type SpriteSpec,
  type SurfaceKind,
  type TileContour,
  type TileSpriteOptions,
} from "../types";
import { campaignProfileKey, generateCampaignVisualProfile } from "./visualProfile";

export { buildingSprite, rubbleSprite, unitSprite, wreckSprite } from "./svgArt";

const TW = 64;
const TH = 32;
export const TILE_SPRITE_PAD_X = 4;
export const TILE_SPRITE_PAD_Y = 4;
const SPRITE_W = TW + TILE_SPRITE_PAD_X * 2;
const SPRITE_H = TH + TILE_SPRITE_PAD_Y * 2;
const INK = "#202a32";
const ART_PIXEL_SCALE = 1;
const TERRAIN_ART_REV = "tactical-surface-v7-organic-landforms";

function tileCx(): number {
  return TILE_SPRITE_PAD_X + TW / 2;
}

function tileCy(): number {
  return TILE_SPRITE_PAD_Y + TH / 2;
}

function poly(points: number[], fill: string, stroke?: string, strokeWidth = 1): ShapeSpec {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { type: "poly", x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, fill, stroke, strokeWidth, points };
}

function ell(x: number, y: number, w: number, h: number, fill: string, stroke?: string): ShapeSpec {
  return { type: "ellipse", x, y, w, h, fill, stroke, strokeWidth: stroke ? 1 : undefined };
}

function line(x: number, y: number, x2: number, y2: number, stroke: string, width = 2): ShapeSpec {
  return { type: "line", x, y, w: x2 - x, h: y2 - y, fill: "transparent", stroke, strokeWidth: width };
}

function irregularIso(cx: number, cy: number, w: number, h: number, _seed: number, out = 1): number[] {
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

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return (x ^ (x >>> 16)) >>> 0;
}

function pick(v: number, lane: number, mod: number): number {
  return hash(v + lane * 374761) % Math.max(1, mod);
}

function signed(v: number, lane: number, span: number): number {
  return pick(v, lane, span * 2 + 1) - span;
}

function mixHex(a: string, b: string, amount: number): string {
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

const TERRAIN: Record<BiomeName, [string, string, string, string]> = {
  "ash plains": ["#586b5c", "#303d36", "#8b9e83", "#202b28"],
  "crystal flats": ["#4f7772", "#2d4d4d", "#9ac8ba", "#1e3739"],
  "rust canyons": ["#89553b", "#4c2a25", "#ba8051", "#2a1b1b"],
  "salt marshes": ["#4f7059", "#2c4439", "#849d72", "#1e2e29"],
  "glass desert": ["#a0855b", "#5b4934", "#d0b783", "#3a2a21"],
  "tundra grid": ["#5f7f83", "#334c56", "#a8c9c6", "#1d3038"],
  "jungle wreckage": ["#3d6544", "#203c29", "#67945b", "#13251b"],
  "volcanic shelf": ["#624844", "#332326", "#9a7062", "#241719"],
};

const ORE = {
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

function terrainPalette(biome: BiomeName, elev: number, campaign: CampaignVisualProfile): Palette {
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

function terrainZonePalette(palette: Palette, variant: number): Palette {
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

export function cliffFaces(biome: BiomeName, elev: number, campaign = generateCampaignVisualProfile(0)): {
  south: string;
  east: string;
  southInk: string;
  eastInk: string;
} {
  const [base, dark, , outline] = TERRAIN[biome];
  const tier = Math.max(0, Math.min(3, elev));
  const mid = tier === 2;
  const high = tier >= 3;
  const faces = {
    south: high ? dark : mid ? mixHex(outline, dark, 0.35) : outline,
    east: high ? base : mid ? mixHex(dark, base, 0.4) : dark,
    southInk: outline,
    eastInk: high ? dark : mid ? mixHex(outline, dark, 0.45) : outline,
  };
  if (campaign.family === 0) return { ...faces, southInk: "#263640", eastInk: "#263640" };
  if (campaign.family === 1) return { ...faces, south: mixHex(faces.south, "#3b4650", 0.2), east: mixHex(faces.east, "#3b4650", 0.16) };
  return { ...faces, south: mixHex(faces.south, "#5b4635", 0.18), east: mixHex(faces.east, "#5b4635", 0.12) };
}

export type ElevationFace = {
  points: number[];
  cracks: number[][];
};

function faceJitter(seed: number, i: number, span: number): number {
  const n = hash(seed + i * 101);
  return (n % (span * 2 + 1)) - span;
}

export function elevationFace(
  side: "south" | "east",
  dropSteps: number,
  tw: number,
  th: number,
  heightStep: number,
  seed: number,
): ElevationFace {
  const hillside = dropSteps <= 1;
  const drop = dropSteps * heightStep * (hillside ? 0.8 : 1);
  const inset = hillside ? heightStep * 0.32 : 0;
  const southTop: [number, number] = [0, th];
  const westTop: [number, number] = [-tw / 2, th / 2];
  const eastTop: [number, number] = [tw / 2, th / 2];
  const topA = side === "south" ? westTop : eastTop;
  const topB = southTop;
  const botA: [number, number] = [
    topA[0] + (side === "south" ? inset * 0.45 : -inset * 0.45),
    topA[1] + drop - inset * 0.15,
  ];
  const botB: [number, number] = [
    topB[0],
    topB[1] + drop - inset * 0.2,
  ];
  const points = [topA[0], topA[1], topB[0], topB[1], botB[0], botB[1], botA[0], botA[1]];
  const cracks: number[][] = [];
  if (!hillside) {
    // Controlled strata follow the face contour, giving tall drops a clean
    // engineered escarpment rather than a sketchy zig-zag silhouette.
    for (let i = 1; i < dropSteps; i++) {
      const t = i / dropSteps;
      const offset = faceJitter(seed, 50 + i, 2);
      cracks.push([
        topA[0] + (botA[0] - topA[0]) * t + offset,
        topA[1] + (botA[1] - topA[1]) * t,
        topB[0] + (botB[0] - topB[0]) * t + offset,
        topB[1] + (botB[1] - topB[1]) * t,
      ]);
    }
  }
  return { points, cracks };
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
): void {
  if (dropS > 0) {
    const face = elevationFace("south", dropS, tw, th, heightStep, seed);
    fillFace(ctx, originX, originY + Math.max(1, heightStep * 0.08), face.points, mixHex(colors.south, "#0d1519", 0.48));
    fillFace(ctx, originX, originY, face.points, colors.south);
    strokeCracks(ctx, originX, originY, face.cracks, colors.southInk);
  }
  if (dropE > 0) {
    const face = elevationFace("east", dropE, tw, th, heightStep, seed);
    fillFace(ctx, originX, originY + Math.max(1, heightStep * 0.08), face.points, mixHex(colors.east, "#0d1519", 0.48));
    fillFace(ctx, originX, originY, face.points, colors.east);
    strokeCracks(ctx, originX, originY, face.cracks, colors.eastInk);
  }
}

function fillFace(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  points: number[],
  fill: string,
): void {
  if (points.length < 6) return;
  ctx.beginPath();
  ctx.moveTo(ox + points[0]!, oy + points[1]!);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(ox + points[i]!, oy + points[i + 1]!);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
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

function defaultContour(kind: "clear" | "water" | "resource" | "blocked", elev: number): TileContour {
  if (kind === "water") return "bank";
  if (kind === "blocked" && elev >= 2) return "ridge";
  if (elev >= 3) return "ridge";
  return "none";
}

function arid(biome: BiomeName): boolean {
  return biome === "glass desert" || biome === "rust canyons" || biome === "volcanic shelf";
}

function lush(biome: BiomeName): boolean {
  return biome === "jungle wreckage" || biome === "salt marshes";
}

export function tileSprite(
  kind: "clear" | "water" | "resource" | "blocked",
  elev = 1,
  variantOrOptions: number | TileSpriteOptions = 0,
): SpriteSpec {
  const opts = typeof variantOrOptions === "number" ? { variant: variantOrOptions } : variantOrOptions;
  const biome = opts.biome ?? "ash plains";
  const variant = opts.variant ?? 0;
  const campaign = opts.campaignProfile ?? generateCampaignVisualProfile(0);
  const v = hash((variant & 0xff) + elev * 17);
  const contour = opts.contour ?? defaultContour(kind, elev);
  const floorElev = contour === "bank" || kind === "water" ? 0 : elev;
  const p = terrainZonePalette(terrainPalette(biome, floorElev, campaign), variant);
  const cx = tileCx();
  const cy = tileCy();
  const mask = opts.edgeMask ?? 0;
  const surfaceMask = opts.surfaceMask ?? 15;
  const shapes: ShapeSpec[] = [];

  paintFloor(shapes, biome, p, v, kind, contour, opts.surface, surfaceMask);
  if (opts.surface === SURFACE_ROAD) paintRoad(shapes, biome, v, surfaceMask);
  else if (opts.surface === SURFACE_CONCRETE) paintConcrete(shapes, biome, p, v, campaign, surfaceMask);
  else if (kind !== "water" && kind !== "resource") paintGroundCover(shapes, biome, p, v, contour);

  if (kind === "water" && surfaceMask !== 0) {
    paintWater(shapes, biome, v, mask);
  }

  if (contour === "ridge") paintRidge(shapes, biome, p, v, mask);
  if (kind === "resource") paintOreField(shapes, biome, v, opts.resourceLevel ?? 4, surfaceMask === -1 || surfaceMask === 0);
  else if (kind === "blocked" && contour !== "ridge") paintBlocker(shapes, biome, p, v, cx, cy);

  return {
    id: tileSpriteId(kind, elev, { ...opts, biome, variant, contour, campaignProfile: campaign }),
    kind: "tile",
    w: SPRITE_W,
    h: SPRITE_H,
    palette: p,
    shapes,
    pixelScale: ART_PIXEL_SCALE,
  };
}

export function tileSpriteId(
  kind: "clear" | "water" | "resource" | "blocked",
  elev = 1,
  opts: TileSpriteOptions = {},
): string {
  const biome = opts.biome ?? "ash plains";
  const variant = opts.variant ?? 0;
  const contour = opts.contour ?? defaultContour(kind, elev);
  const campaign = opts.campaignProfile ?? generateCampaignVisualProfile(0);
  return `tile:${TERRAIN_ART_REV}:${kind}:${biome}:${campaignProfileKey(campaign)}:${elev}:${variant}:${opts.edgeMask ?? 0}:${opts.surfaceMask ?? 15}:${opts.surface ?? 0}:${opts.resourceLevel ?? 0}:${contour}`;
}

function paintFloor(
  shapes: ShapeSpec[],
  biome: BiomeName,
  p: Palette,
  v: number,
  kind: "clear" | "water" | "resource" | "blocked",
  contour: TileContour,
  surface?: SurfaceKind,
  surfaceMask?: number,
): void {
  const cx = tileCx();
  const cy = tileCy();
  const base = kind === "water" || contour === "bank" ? wetGround(biome) : p.primary;
  const continuousBase = surfaceMask !== undefined
    && (surfaceMask === -1 || (surfaceMask === 0 && (kind === "water" || kind === "resource")));
  const engineered = surface === SURFACE_CONCRETE || surface === SURFACE_ROAD;
  // Overlap the logical diamond so terrain reads as one field, not a mosaic.
  if (!continuousBase && !engineered) shapes.push(poly(irregularIso(cx, cy, TW + 16, TH + 10, v, 3), base));
  if (engineered) return;
  if (!continuousBase) {
    shapes.push(poly(irregularIso(cx + signed(v, 1, 3), cy + signed(v, 2, 1), 70, 30, v >> 1, 2), base));
  }
  if (kind !== "water" && contour !== "bank") {
    const macroDensity = pick(v, 18, 6);
    const patches = macroDensity < 2 ? 1 : 2 + pick(v, 3, 2);
    for (let i = 0; i < patches; i++) {
      const ox = signed(v, 10 + i, 12);
      const oy = signed(v, 40 + i, 5);
      const ew = 9 + pick(v, 70 + i, 18);
      const eh = 4 + pick(v, 90 + i, 6);
      const fill = [p.light, p.dark, p.secondary, p.primary][pick(v, 110 + i, 4)]!;
      if (pick(v, 130 + i, 3) === 0) {
        shapes.push(poly(irregularIso(cx + ox, cy + oy, ew + 6, eh + 5, v + i * 19, 2), fill));
      } else {
        shapes.push(ell(cx + ox - ew / 2, cy + oy - eh / 2, ew, eh, fill));
      }
    }
    if (pick(v, 238, 4) !== 0) {
      const relief = pick(v, 239, 3);
      const reliefFill = relief === 0
        ? mixHex(p.secondary, p.dark, 0.32)
        : relief === 1
          ? mixHex(p.primary, p.light, 0.26)
          : mixHex(p.accent, p.primary, 0.32);
      shapes.push(poly(
        irregularIso(
          cx + signed(v, 240, 10),
          cy + signed(v, 241, 4),
          48 + pick(v, 242, 18),
          14 + pick(v, 243, 8),
          v >> 5,
          2,
        ),
        reliefFill,
      ));
    }
    const specks = macroDensity < 4 ? 1 : 2;
    for (let i = 0; i < specks; i++) {
      const ox = signed(v, 150 + i, 11);
      const oy = signed(v, 170 + i, 4);
      shapes.push(ell(cx + ox, cy + oy, 2 + pick(v, 190 + i, 3), 1 + pick(v, 200 + i, 2), i % 2 ? p.light : p.dark));
    }
  }
  // Water banks are painted only at actual shore edges. Filling every water
  // tile with sand made lakes read as a tiled slab instead of a continuous basin.
  if (kind !== "water" && contour === "bank") {
    shapes.push(poly(irregularIso(cx + signed(v, 4, 3), cy + 1, 54, 24, v, 3), shoreSand(biome)));
    shapes.push(ell(cx - 12 + signed(v, 5, 6), cy - 2 + signed(v, 6, 2), 18 + pick(v, 7, 8), 8 + pick(v, 8, 4), shoreSand(biome)));
    shapes.push(ell(cx + 4 + signed(v, 9, 6), cy + 2 + signed(v, 10, 2), 16 + pick(v, 11, 8), 7 + pick(v, 12, 4), wetGround(biome)));
    shapes.push(poly(irregularIso(cx + signed(v, 13, 3), cy + 2, 40, 16, v >> 4, 2), wetGround(biome)));
  }
  if (!continuousBase && pick(v, 14, 10) === 0) {
    shapes.push(ell(cx + signed(v, 15, 10), cy + signed(v, 16, 3), 8 + pick(v, 17, 6), 4, p.dark));
  }
}

function paintGroundCover(shapes: ShapeSpec[], biome: BiomeName, p: Palette, v: number, contour: TileContour): void {
  const cx = tileCx();
  const cy = tileCy();
  const dense = lush(biome);
  const dry = arid(biome);
  const density = pick(v, 260, 6);
  const clumps = density < 3 ? 1 : dense ? 2 + pick(v, 1, 2) : 1 + pick(v, 1, 2);
  for (let i = 0; i < clumps; i++) {
    const ox = signed(v, 20 + i, 12);
    const oy = signed(v, 50 + i, 4);
    if (dry) {
      shapes.push(ell(cx + ox - 3, cy + oy, 6 + pick(v, 80 + i, 5), 3, i % 2 ? p.light : p.dark));
    } else {
      shapes.push(ell(cx + ox - 2, cy + oy, 6 + pick(v, 80 + i, 6), 3 + pick(v, 90 + i, 2), i % 2 ? p.accent : p.dark));
      if (pick(v, 100 + i, 3) !== 0) shapes.push(ell(cx + ox, cy + oy - 1, 4 + pick(v, 110 + i, 3), 2, p.light));
    }
  }
  if (density >= 4 && pick(v, 120, 5) === 0) {
    const ox = signed(v, 121, 12);
    const oy = signed(v, 122, 3);
    shapes.push(ell(cx + ox - 5, cy + oy - 1, 10, 4, p.dark));
    shapes.push(ell(cx + ox - 2, cy + oy - 2, 5, 2, p.light));
  }
  if (dense && density >= 5 && pick(v, 4, 6) === 0) {
    pushBush(shapes, cx + signed(v, 5, 8), cy + signed(v, 6, 3), v, biome);
  }
  if (pick(v, 7, 14) === 0) {
    const lx = cx + signed(v, 8, 8);
    const ly = cy + signed(v, 9, 2);
    shapes.push(ell(lx - 7, ly - 2, 14, 5, p.dark));
    shapes.push(ell(lx - 3, ly - 2, 7, 2, p.secondary));
  }
  if (contour === "ridge" || pick(v, 10, 12) === 0) {
    shapes.push(ell(cx + signed(v, 11, 6), cy + 2, 6 + pick(v, 12, 4), 3, p.dark));
    shapes.push(ell(cx + signed(v, 13, 6), cy + 1, 3 + pick(v, 14, 3), 2, p.light));
  }
  if (density >= 4 && pick(v, 261, 5) === 0) paintBiomeSignature(shapes, biome, p, v, cx, cy);
  if (pick(v, 262, 8) === 0) paintBiomeLandmark(shapes, biome, p, v, cx, cy);
}

function paintBiomeLandmark(shapes: ShapeSpec[], biome: BiomeName, p: Palette, v: number, cx: number, cy: number): void {
  const feature = pick(v, 263, 3);
  if (biome === "jungle wreckage") {
    if (feature === 0) {
      shapes.push(line(cx - 23, cy + 5, cx + 20, cy - 3, "#17271b", 4));
      shapes.push(line(cx - 8, cy + 2, cx - 2, cy - 9, "#4f7743", 2));
      shapes.push(ell(cx + 8, cy - 8, 16, 8, "#315b35", INK));
    } else if (feature === 1) {
      shapes.push(ell(cx - 20, cy - 7, 40, 14, "#18372f", "#10281f"));
      shapes.push(ell(cx - 11, cy - 5, 20, 7, "#397365"));
      shapes.push(ell(cx + 9, cy - 1, 8, 4, "#6a8458"));
    } else {
      shapes.push(poly([cx - 20, cy + 4, cx - 9, cy - 7, cx + 19, cy, cx + 7, cy + 7], "#5a4939", "#1b201c", 1));
      shapes.push(line(cx - 13, cy - 2, cx + 13, cy + 3, "#b0733d", 2));
      shapes.push(ell(cx - 14, cy - 7, 9, 5, "#3c633a"));
    }
  } else if (biome === "ash plains") {
    if (feature === 0) {
      shapes.push(ell(cx - 23, cy - 8, 46, 17, "#292f2d", "#171b19"));
      shapes.push(ell(cx - 12, cy - 4, 24, 8, "#111614"));
    } else if (feature === 1) {
      shapes.push(line(cx - 24, cy + 5, cx + 22, cy - 5, "#242a27", 5));
      shapes.push(line(cx - 18, cy + 3, cx + 18, cy - 4, "#7b8179", 1));
    } else {
      shapes.push(poly(irregularIso(cx, cy, 42, 16, v >> 2, 3), "#657069", "#202623", 1));
      shapes.push(line(cx - 12, cy + 4, cx + 9, cy - 5, "#313835", 2));
    }
  } else if (biome === "crystal flats") {
    for (let i = 0; i < 3 + feature; i++) {
      const ox = -16 + i * 8;
      shapes.push(poly([cx + ox - 4, cy + 5, cx + ox, cy - 10 - (i % 3) * 2, cx + ox + 4, cy + 4], i % 2 ? "#79b9ad" : "#9ce4d5", "#263c38", 1));
    }
  } else if (biome === "rust canyons") {
    shapes.push(line(cx - 25, cy + 5, cx + 23, cy - 5 + feature * 3, "#43281d", 5));
    shapes.push(line(cx - 20, cy + 3, cx + 19, cy - 4 + feature * 3, feature === 2 ? "#d38345" : "#8f4c2d", 2));
    if (feature === 1) shapes.push(poly([cx - 10, cy + 3, cx - 2, cy - 9, cx + 12, cy + 1], "#885334", "#2c1b14", 1));
  } else if (biome === "salt marshes") {
    shapes.push(ell(cx - 23, cy - 8, 46, 16, feature === 0 ? "#243f37" : "#586044", "#1a3029"));
    for (let i = 0; i < 4 + feature; i++) shapes.push(line(cx - 17 + i * 7, cy + 4, cx - 16 + i * 7, cy - 8 - (i % 2) * 3, "#879064", 1));
  } else if (biome === "glass desert") {
    shapes.push(poly([cx - 24, cy + 4, cx - 8, cy - 10 - feature, cx + 24, cy + 2, cx + 6, cy + 9], feature === 1 ? "#292f31" : "#75664f", "#b9aa8b", 1));
    shapes.push(line(cx - 7, cy - 9, cx + 14, cy, "#e3d4b2", 1));
  } else if (biome === "tundra grid") {
    shapes.push(poly(irregularIso(cx, cy, 48, 19, v >> 2, 2), feature === 0 ? "#85a4aa" : "#a6bcb9", "#39545b", 1));
    shapes.push(line(cx - 22, cy - 4, cx + 20, cy + 6, "#d4eeee", 2));
    if (feature === 2) shapes.push(line(cx - 13, cy + 5, cx + 4, cy - 7, "#526d72", 2));
  } else {
    shapes.push(line(cx - 24, cy - 4, cx - 3, cy + feature - 1, "#151313", 5));
    shapes.push(line(cx - 3, cy + feature - 1, cx + 23, cy - 4, feature === 1 ? "#8e2c22" : "#d04b2c", 3));
    shapes.push(line(cx - 2, cy + feature - 2, cx + 20, cy - 4, "#ff9a46", 1));
  }
  if (feature === 2) shapes.push(ell(cx + signed(v, 264, 12), cy + signed(v, 265, 4), 6, 3, p.dark));
}

function paintBiomeSignature(shapes: ShapeSpec[], biome: BiomeName, p: Palette, v: number, cx: number, cy: number): void {
  const ox = signed(v, 270, 10);
  const oy = signed(v, 271, 3);
  if (biome === "ash plains") {
    shapes.push(ell(cx + ox - 6, cy + oy - 2, 12, 5, "#2a302c", "#667068"));
    shapes.push(ell(cx + ox - 3, cy + oy - 1, 6, 2.5, "#151a18"));
  } else if (biome === "crystal flats") {
    shapes.push(poly([cx + ox - 4, cy + oy + 3, cx + ox - 1, cy + oy - 6, cx + ox + 1, cy + oy + 2], "#92b8ac", "#263c38", 1));
    shapes.push(poly([cx + ox, cy + oy + 3, cx + ox + 5, cy + oy - 3, cx + ox + 4, cy + oy + 4], "#6f9188", "#263c38", 1));
  } else if (biome === "rust canyons") {
    shapes.push(line(cx + ox - 7, cy + oy, cx + ox + 7, cy + oy + 3, "#3d2b22", 3));
    shapes.push(line(cx + ox - 5, cy + oy - 1, cx + ox + 5, cy + oy + 1, "#a7683f", 1));
  } else if (biome === "salt marshes") {
    for (let i = -2; i <= 2; i++) shapes.push(line(cx + ox + i * 2, cy + oy + 3, cx + ox + i * 2 + (i % 2), cy + oy - 5 - Math.abs(i), "#778465", 1));
  } else if (biome === "glass desert") {
    shapes.push(poly([cx + ox - 8, cy + oy + 3, cx + ox - 2, cy + oy - 4, cx + ox + 8, cy + oy + 2, cx + ox + 1, cy + oy + 4], "#262b2c", "#9a9d95", 1));
    shapes.push(line(cx + ox - 2, cy + oy - 3, cx + ox + 5, cy + oy + 1, "#d0c4aa", 1));
  } else if (biome === "tundra grid") {
    shapes.push(poly([cx + ox - 9, cy + oy + 1, cx + ox - 4, cy + oy - 4, cx + ox + 8, cy + oy - 1, cx + ox + 2, cy + oy + 3], "#718f94", "#46545a", 1));
    shapes.push(ell(cx + ox - 3, cy + oy - 1, 7, 2, "#a7b7ba"));
  } else if (biome === "jungle wreckage") {
    shapes.push(line(cx + ox - 8, cy + oy, cx + ox + 8, cy + oy + 2, "#17271b", 2));
    shapes.push(ell(cx + ox - 5, cy + oy - 4, 8, 4, "#547448", INK));
    shapes.push(ell(cx + ox + 1, cy + oy - 3, 7, 4, "#385f3d", INK));
  } else if (biome === "volcanic shelf") {
    shapes.push(line(cx + ox - 8, cy + oy - 2, cx + ox, cy + oy + 1, "#1c1716", 3));
    shapes.push(line(cx + ox, cy + oy + 1, cx + ox + 8, cy + oy - 1, "#c54f2b", 2));
    shapes.push(line(cx + ox + 1, cy + oy + 1, cx + ox + 6, cy + oy, "#ff9a42", 1));
  }
  if (pick(v, 272, 5) === 0) shapes.push(ell(cx - ox * 0.4, cy - oy, 4, 2, p.light));
}

function pushBush(shapes: ShapeSpec[], x: number, y: number, v: number, biome: BiomeName): void {
  const canopy = canopyColors(biome);
  const w = 9 + pick(v, 16, 6);
  shapes.push(ell(x - w / 2, y + 1, w, 4, "rgba(10,12,8,0.32)"));
  shapes.push(ell(x - w / 2 - 1, y - 5, w * 0.7, 6, canopy.dark, INK));
  shapes.push(ell(x - w / 2 + 3, y - 6, w * 0.55, 5, canopy.mid));
  if (pick(v, 17, 2) === 0) shapes.push(ell(x + 1, y - 4, 4, 3, canopy.hi));
}

function paintRoad(shapes: ShapeSpec[], biome: BiomeName, v: number, surfaceMask: number): void {
  const cx = tileCx();
  const cy = tileCy();
  const dirt = biome === "tundra grid" ? "#344c54" : biome === "volcanic shelf" ? "#4a302d" : "#59483b";
  const worn = biome === "tundra grid" ? "#789fa2" : biome === "volcanic shelf" ? "#a95b48" : "#9a7651";
  // Oversized fills bridge neighboring logical cells. Interior cells are kept
  // intentionally quiet; only the boundary of a route receives seams and
  // repairs, so a road reads as one continuous strip instead of a tile puzzle.
  const boundary = surfaceMask !== 0;
  shapes.push(poly(irregularIso(cx, cy, boundary ? 92 : 108, boundary ? 44 : 54, v, 3), dirt));
  if (boundary) {
    const detail = pick(v, 295, 6);
    if (detail <= 1) {
      shapes.push(poly(irregularIso(cx + signed(v, 296, 5), cy + signed(v, 297, 2), 38 + pick(v, 298, 20), 10, v >> 3, 2), worn));
      shapes.push(line(cx - 11, cy + 2, cx + 11, cy - 3, "#4a3c30", 1));
    } else if (detail === 2) {
      shapes.push(line(cx - 15, cy - 3, cx + 13, cy + 4, worn, 2));
    }
    if (biome === "tundra grid" && pick(v, 306, 3) === 0) {
      shapes.push(line(cx - 19, cy + 4, cx + 17, cy - 4, "#b9d6d2", 1));
      shapes.push(line(cx - 9, cy + 3, cx - 3, cy + 1, "#d7a956", 2));
      shapes.push(line(cx + 5, cy, cx + 11, cy - 2, "#d7a956", 2));
    }
    if (pick(v, 304, 9) === 0) paintRoadLandmark(shapes, biome, v, cx, cy);
  } else if (pick(v, 301, 9) === 0) {
    shapes.push(ell(cx + signed(v, 302, 14) - 5, cy + signed(v, 303, 4) - 2, 10, 4, mixHex(dirt, worn, 0.4)));
  }
}

function paintRoadLandmark(shapes: ShapeSpec[], biome: BiomeName, v: number, cx: number, cy: number): void {
  const feature = pick(v, 305, 4);
  if (feature === 0) {
    shapes.push(ell(cx - 17, cy - 7, 34, 12, biome === "tundra grid" ? "#55727b" : "#353d36", "#292b27"));
    shapes.push(line(cx - 10, cy - 5, cx + 9, cy - 2, biome === "tundra grid" ? "#accfd2" : "#788b73", 1));
  } else if (feature === 1) {
    for (let i = -1; i <= 1; i++) {
      shapes.push(line(cx - 22, cy - 5 + i * 4, cx + 21, cy + 5 + i * 4, i === 0 ? "#292820" : "#544838", i === 0 ? 2 : 1));
    }
  } else if (feature === 2) {
    shapes.push(poly([cx - 19, cy + 4, cx - 10, cy - 7, cx + 17, cy - 1, cx + 8, cy + 8], "#3c4441", "#202421", 1));
    for (let i = 0; i < 5; i++) shapes.push(line(cx - 12 + i * 6, cy - 4, cx - 9 + i * 6, cy + 4, i % 2 ? "#2c322f" : "#8b744c", 2));
  } else {
    const green = biome === "jungle wreckage" || biome === "salt marshes";
    shapes.push(line(cx - 23, cy + 5, cx + 18, cy - 5, green ? "#29452d" : "#3b3429", 3));
    shapes.push(ell(cx - 8, cy - 8, 17, 7, green ? "#527344" : "#76573c"));
    shapes.push(ell(cx + 7, cy + 1, 12, 5, green ? "#3c5f38" : "#4a3d30"));
  }
}

function paintConcrete(
  shapes: ShapeSpec[],
  biome: BiomeName,
  p: Palette,
  v: number,
  campaign: CampaignVisualProfile,
  surfaceMask: number,
): void {
  const cx = tileCx();
  const cy = tileCy();
  const materials: Record<BiomeName, [string, string, string, string]> = {
    "ash plains": ["#59605d", "#747d78", "#303735", "#9aa39c"],
    "crystal flats": ["#435d5d", "#63817c", "#223b3d", "#8fc9bd"],
    "rust canyons": ["#70503e", "#96684b", "#3e2d27", "#c58a5b"],
    "salt marshes": ["#45594e", "#657266", "#263a32", "#91a67d"],
    "glass desert": ["#83785f", "#aaa080", "#49463d", "#d1c49c"],
    "tundra grid": ["#425f68", "#93c0c1", "#22343d", "#d4efea"],
    "jungle wreckage": ["#34483d", "#536256", "#1d3028", "#77916a"],
    "volcanic shelf": ["#373535", "#5a5250", "#1c1b1d", "#d36a3d"],
  };
  const [rawBase, rawHi, rawLo, rawAccent] = materials[biome];
  const base = mixHex(rawBase, p.primary, 0.14);
  const hi = mixHex(rawHi, p.light, 0.14);
  const lo = mixHex(rawLo, p.dark, 0.12);
  const accent = mixHex(rawAccent, p.accent, 0.18);
  // Concrete must read as a continuous deployment surface rather than a noisy
  // checkerboard. Overlap every panel slightly and reserve seams for sparse,
  // campaign-specific service markings.
  // A deployment pad is a single continuous surface. Avoid dark bevels on
  // every logical cell: they made the board read as a giant checkerboard.
  const interior = surfaceMask === 0;
  shapes.push(poly(irregularIso(cx, cy, interior ? 108 : 88, interior ? 54 : 43, v, 1), mixHex(base, lo, interior ? 0.06 : 0.12)));
  const panel = pick(v, 307, 5);
  if (!interior && panel >= 2) {
    shapes.push(poly(
      irregularIso(
        cx + signed(v, 308, 5),
        cy + signed(v, 309, 2),
        56 + pick(v, 311, 18),
        22 + pick(v, 312, 7),
        v >> 3,
        1,
      ),
      mixHex(base, panel === 4 ? hi : lo, panel === 4 ? 0.18 : 0.22),
    ));
  }
  if (surfaceMask !== 0 && pick(v, 310, 11) <= 2) {
    const seam = campaign.terrainTreatment === "expeditionary" ? hi : accent;
    shapes.push(line(cx - 22 + signed(v, 313, 3), cy + 5, cx + 20, cy - 5 + signed(v, 314, 2), seam, panel === 4 ? 2 : 1));
    if (pick(v, 316, 3) === 0) {
      shapes.push(line(cx - 17, cy + 6, cx + 14, cy - 2, mixHex(seam, lo, 0.42), 1));
    }
  }
  if (pick(v, 317, interior ? 18 : 8) <= (interior ? 1 : 3)) {
    paintConcreteBiomeDetail(shapes, biome, v, cx, cy, 2);
  }
  if (pick(v, 318, interior ? 17 : 7) === 0) {
    shapes.push(ell(
      cx + signed(v, 319, 18) - 7,
      cy + signed(v, 320, 5) - 2,
      14 + pick(v, 321, 13),
      4 + pick(v, 322, 4),
      mixHex(lo, base, 0.32),
    ));
  }
  if (surfaceMask !== 0 && pick(v, 323, 11) === 0) {
    const hazard = campaign.terrainAccent === "red" ? "#d87868" : "#d5a64e";
    shapes.push(line(cx - 13, cy + 5, cx - 5, cy + 2, hazard, 2));
    shapes.push(line(cx - 3, cy + 1, cx + 5, cy - 2, hazard, 2));
  }
}

function paintConcreteBiomeDetail(
  shapes: ShapeSpec[],
  biome: BiomeName,
  v: number,
  cx: number,
  cy: number,
  split: number,
): void {
  const feature = pick(v, 315, 4);
  if (biome === "jungle wreckage") {
    if (feature === 0) {
      shapes.push(line(cx - 23, cy + 6, cx + 17, cy - 6, "#203b2c", 3));
      shapes.push(line(cx - 12, cy + 5, cx - 8, cy - 8, "#77a563", 2));
      shapes.push(ell(cx + 8, cy - 5, 12, 5, "#355e3d"));
    } else if (feature === 1) {
      shapes.push(ell(cx - 18, cy - 7, 36, 13, "#172f2d", "#294b43"));
      shapes.push(ell(cx - 10, cy - 5, 18, 6, "#315d55"));
      shapes.push(line(cx - 7, cy - 6, cx + 7, cy - 3, "#80a89a", 1));
    } else if (feature === 2) {
      shapes.push(poly([cx - 20, cy + 4, cx - 8, cy - 7, cx + 18, cy, cx + 7, cy + 8], "#66503b", "#231f1c", 1));
      for (let i = 0; i < 4; i++) shapes.push(line(cx - 12 + i * 7, cy - 4, cx - 8 + i * 7, cy + 4, i % 2 ? "#2a302a" : "#b57b3e", 2));
    } else {
      shapes.push(line(cx - 20, cy + 6, cx + 5, cy - 3, "#182d20", 3));
      shapes.push(line(cx - 5, cy - 2, cx + 18, cy + 3, "#182d20", 3));
      shapes.push(line(cx - 4, cy - 1, cx + 2, cy - 9, "#679451", 2));
      shapes.push(ell(cx + 11, cy - 5, 9, 5, "#4c7a45"));
    }
  } else if (biome === "crystal flats") {
    const shift = feature * 3 - 5;
    shapes.push(poly([cx - 12 + shift, cy + 5, cx - 6 + shift, cy - 10 - feature, cx - 1 + shift, cy + 3], "#8fcfc4", "#1c3435", 1));
    shapes.push(poly([cx + 2 - shift, cy + 5, cx + 9 - shift, cy - 5, cx + 13 - shift, cy + 4], feature % 2 ? "#6f9fff" : "#5e9e94", "#1c3435", 1));
    if (feature >= 2) shapes.push(line(cx - 20, cy + 4, cx + 20, cy - 5, "#a8f4e5", 1));
  } else if (biome === "rust canyons") {
    if (feature < 2) {
      shapes.push(line(cx - 22, cy - 5 + feature * 4, cx + 20, cy + 6 - feature * 3, "#35231d", 4));
      shapes.push(line(cx - 18, cy - 4 + feature * 4, cx + 17, cy + 5 - feature * 3, "#c16f3d", 1));
    } else {
      shapes.push(poly([cx - 18, cy + 5, cx - 11, cy - 7, cx + 16, cy - 2, cx + 10, cy + 8], "#754630", "#2b201c", 1));
      for (let i = 0; i < 5; i++) shapes.push(ell(cx - 12 + i * 7, cy - 3 + (i % 2) * 5, 3, 2, "#d0935d", "#35231d"));
    }
  } else if (biome === "salt marshes") {
    shapes.push(ell(cx - 20 + feature * 3, cy - 7, 34, 13, feature % 2 ? "#263f38" : "#625f44", "#1d302b"));
    for (let i = 0; i < 3 + feature; i++) shapes.push(line(cx - 12 + i * 6, cy + 3, cx - 11 + i * 6, cy - 7 - (i % 3), "#8d9565", 1));
  } else if (biome === "glass desert") {
    shapes.push(poly([cx - 22, cy + 3, cx - 7 + feature, cy - 9, cx + 22, cy + 1, cx + 5, cy + 9], feature % 2 ? "#313b3d" : "#806d52", "#d0c7aa", 1));
    shapes.push(line(cx - 7 + feature, cy - 8, cx + 14, cy, "#f0dfb6", 1));
  } else if (biome === "tundra grid") {
    shapes.push(poly(irregularIso(cx + feature * 2 - 3, cy, 42, 17, v >> 2, 2), feature % 2 ? "#6f8990" : "#9bb3b5", "#324c54", 1));
    shapes.push(line(cx - 22, cy - 4, cx + 20, cy + 6, "#d2efee", 2));
    if (feature >= 2) shapes.push(line(cx - 15, cy + 5, cx + 4, cy - 7, "#4c6970", 2));
  } else if (biome === "volcanic shelf") {
    shapes.push(line(cx - 22, cy - 4, cx - 4, cy + feature - 1, "#151417", 4));
    shapes.push(line(cx - 4, cy + feature - 1, cx + 21, cy - 3, feature % 2 ? "#9f3024" : "#d6572f", 3));
    shapes.push(line(cx - 3, cy + feature - 2, cx + 18, cy - 3, "#ff9a46", 1));
  } else {
    if (feature < 2) {
      shapes.push(ell(cx + signed(v, 302, 10), cy + signed(v, 303, 3), 10 + split * 2, 5 + feature, "#343c39"));
      shapes.push(line(cx - 17, cy + 5, cx + 14, cy - 6, "#818b84", 1));
    } else {
      shapes.push(poly([cx - 19, cy + 3, cx - 6, cy - 8, cx + 19, cy, cx + 8, cy + 7], "#4a514e", "#272e2c", 1));
      shapes.push(line(cx - 12, cy - 3, cx + 12, cy + 3, "#9aa39c", 2));
    }
  }
}

function paintWater(shapes: ShapeSpec[], biome: BiomeName, v: number, mask: number): void {
  const cx = tileCx();
  const cy = tileCy();
  const deep = waterDeep(biome);
  const mid = waterMid(biome);
  const hi = waterHi(biome);
  // A recessed, continuous water plane: intentionally geometric instead of
  // irregular blue puddles, with subtle current lines for scale.
  shapes.push(poly(irregularIso(cx, cy, 80, 38, v, 2), deep));
  shapes.push(poly(irregularIso(cx, cy - 1, 72, 34, v, 2), mid));
  shapes.push(poly(irregularIso(cx + signed(v, 71, 2), cy - 2, 54, 24, v, 2), mixHex(mid, hi, 0.14)));
  const flow = signed(v, 72, 6);
  for (let i = 0; i < 3; i++) {
    const y = cy - 7 + i * 6 + signed(v, 73 + i, 1);
    const x = cx - 19 + i * 8 + flow;
    shapes.push(line(x, y, x + 13, y + 4, i === 1 ? hi : mixHex(mid, hi, 0.58), 1));
  }
  if ((v & 3) === 0) shapes.push(line(cx - 5, cy + 7, cx + 9, cy + 3, hi, 1));
  if (mask) paintBanks(shapes, biome, mask, v);
  else if ((v & 5) === 0) shapes.push(line(cx - 10 + flow, cy + 2, cx - 1 + flow, cy - 1, foam(biome), 1));
}

function paintBanks(shapes: ShapeSpec[], biome: BiomeName, mask: number, v: number): void {
  const sand = shoreSand(biome);
  const mud = wetGround(biome);
  const froth = foam(biome);
  const deep = waterDeep(biome);
  for (const edge of diamondEdges()) {
    if (!(mask & edge.bit)) continue;
    const band = insetBand(edge.a, edge.b, 7);
    shapes.push(poly([...edge.a, ...edge.b, ...band.b, ...band.a], sand, mud, 1));
    const inner = insetBand(edge.a, edge.b, 4);
    shapes.push(poly([...band.a, ...band.b, ...inner.b, ...inner.a], deep));
    shapes.push(line(inner.a[0]!, inner.a[1]!, inner.b[0]!, inner.b[1]!, froth, 2));
    if ((v + edge.bit) % 3 === 0) {
      const mx = (edge.a[0]! + edge.b[0]!) / 2;
      const my = (edge.a[1]! + edge.b[1]!) / 2;
      shapes.push(ell(mx - 2, my - 1, 5, 3, "#6a5a44", INK));
    }
  }
}

function paintRidge(shapes: ShapeSpec[], biome: BiomeName, p: Palette, v: number, mask: number): void {
  const rock = rockColors(biome, p);
  if (!mask) {
    shapes.push(ell(tileCx() + ((v % 7) - 3), tileCy() + 1, 7, 3, rock.dark));
    shapes.push(ell(tileCx() + ((v % 5) - 2), tileCy(), 4, 2, rock.hi));
    return;
  }
  for (const edge of diamondEdges()) {
    if (!(mask & edge.bit)) continue;
    const face = insetBand(edge.a, edge.b, 8);
    shapes.push(poly([...edge.a, ...edge.b, ...face.b, ...face.a], rock.mid, rock.ink, 1));
    const facet = insetBand(edge.a, edge.b, 4);
    shapes.push(poly([
      edge.a[0]!, edge.a[1]!,
      (edge.a[0]! + edge.b[0]!) / 2, (edge.a[1]! + edge.b[1]!) / 2,
      facet.a[0]!, facet.a[1]!,
    ], rock.hi));
    shapes.push(line(face.a[0]!, face.a[1]!, face.b[0]!, face.b[1]!, rock.dark, 2));
    const mx = (edge.a[0]! + edge.b[0]!) / 2 + ((v % 3) - 1);
    const my = (edge.a[1]! + edge.b[1]!) / 2;
    shapes.push(line(mx - 3, my, mx + 2, my + 2, rock.ink, 1));
  }
  if ((mask & 3) === 3) {
    const cx = tileCx();
    const cy = tileCy() - 14;
    shapes.push(poly([cx - 4, cy + 2, cx, cy, cx + 4, cy + 2, cx, cy + 8], rock.hi, rock.ink, 1));
    shapes.push(poly([cx - 2, cy + 2, cx, cy + 1, cx, cy + 7], rock.dark));
  }
}

function paintOreField(shapes: ShapeSpec[], biome: BiomeName, v: number, level: number, continuous = false): void {
  const cx = tileCx();
  const cy = tileCy();
  const n = Math.max(1, Math.min(4, level));
  const fieldTint = biome === "crystal flats" ? "#34594f"
    : biome === "rust canyons" ? "#5f321d"
      : biome === "tundra grid" ? "#465b5c"
        : biome === "volcanic shelf" ? "#2c1e1a"
          : biome === "jungle wreckage" ? "#2a3c22"
            : ORE.stainLo;
  const density = 1 + pick(v, 401, 4);
  // Low mineral seams keep the resource readable while leaving it visibly
  // traversable for harvesters and infantry.
  if (!continuous) {
    shapes.push(poly(irregularIso(cx, cy + 1, 76, 36, v, 2), fieldTint));
    shapes.push(poly(irregularIso(cx, cy, 66, 29, v, 2), mixHex(fieldTint, ORE.stain, 0.54)));
  }
  for (let i = 0; i < density; i++) {
    const ox = -16 + i * 11 + signed(v, 404 + i, 2);
    const oy = 4 - i * 5 + signed(v, 410 + i, 2);
    const seam = 10 + pick(v, 416 + i, 7);
    shapes.push(line(cx + ox, cy + oy, cx + ox + seam, cy + oy - Math.max(2, Math.round(seam * 0.28)), ORE.south, 3));
    shapes.push(line(cx + ox + 1, cy + oy - 1, cx + ox + seam - 1, cy + oy - Math.max(3, Math.round(seam * 0.28)) - 1, ORE.lit, 1));
  }

  const slots: Array<[number, number, number, number]> = [
    [-11, 2, 8, 5],
    [8, -4, 9, 6],
    [1, 5, 7, 4],
    [14, 3, 6, 5],
    [-7, -5, 7, 5],
    [5, 1, 8, 6],
    [-15, 4, 5, 4],
  ];
  const picked = slots
    .map((slot, i) => ({ slot, order: slot[1]! * 8 + slot[0]!, mix: hash(v + i * 19) }))
    .sort((a, b) => a.mix - b.mix)
    .slice(0, 1 + Math.floor(n / 2))
    .sort((a, b) => a.order - b.order);

  for (let i = 0; i < picked.length; i++) {
    const [ox, oy, rw, zh] = picked[i]!.slot;
    const seed = hash(v + i * 31);
    const width = rw + (seed % 3) - 1;
    const z = Math.min(zh + (seed % 2), 6);
    const x = cx + ox;
    const y = cy + oy;
    const half = Math.max(3, Math.round(width * 0.38));
    // Deposit nodes stay below vehicle silhouette height; they are resources,
    // not miniature mountains or movement blockers.
    shapes.push(poly([x - half, y, x, y - z, x + half, y, x, y + Math.max(2, half * 0.42)], ORE.top, ORE.ink, 1));
    shapes.push(poly([x - half, y, x, y + Math.max(2, half * 0.42), x, y + Math.max(2, half * 0.42) + 2, x - half, y + 2], ORE.south, ORE.ink, 1));
    shapes.push(line(x - half + 1, y - 1, x - 1, y - z + 1, ORE.lit, 1));
  }

  shapes.push(line(cx - 20, cy + 8, cx + 20, cy - 8, ORE.ink, 1));
  shapes.push(line(cx - 18, cy + 8, cx + 18, cy - 7, ORE.glint, 1));
}

function paintBlocker(
  shapes: ShapeSpec[],
  biome: BiomeName,
  p: Palette,
  v: number,
  cx: number,
  cy: number,
): void {
  // A blocker is deliberately a solid tactical object, never visual noise.
  // Its dark base and amber hazard cap make impassability legible at a glance.
  const ox = signed(v, 3, 5);
  const oy = signed(v, 4, 2);
  const body = biome === "volcanic shelf" ? "#473331" : biome === "glass desert" ? "#675947" : mixHex(p.secondary, p.dark, 0.38);
  const side = mixHex(body, "#171d20", 0.48);
  const top = mixHex(p.light, "#a5b2ad", 0.28);
  shapes.push(ell(cx - 17 + ox, cy + 2 + oy, 34, 10, "rgba(8, 12, 14, 0.42)"));
  shapes.push(poly([cx - 17 + ox, cy + 2 + oy, cx + 16 + ox, cy + 2 + oy, cx + 12 + ox, cy + 9 + oy, cx - 13 + ox, cy + 9 + oy], side, INK, 1));
  shapes.push(poly([cx - 14 + ox, cy + 2 + oy, cx - 4 + ox, cy - 12 + oy, cx + 15 + ox, cy - 2 + oy, cx + 11 + ox, cy + 4 + oy, cx - 12 + ox, cy + 5 + oy], body, INK, 1));
  shapes.push(poly([cx - 4 + ox, cy - 12 + oy, cx + 15 + ox, cy - 2 + oy, cx + 8 + ox, cy, cx - 8 + ox, cy - 7 + oy], top, INK, 1));
  shapes.push(line(cx - 7 + ox, cy - 4 + oy, cx + 6 + ox, cy + 2 + oy, "#d6a94d", 2));
  shapes.push(line(cx - 4 + ox, cy - 7 + oy, cx + 9 + ox, cy - 1 + oy, "#f1cc69", 1));
}

type Edge = { bit: number; a: [number, number]; b: [number, number] };

function diamondEdges(): Edge[] {
  const ox = TILE_SPRITE_PAD_X;
  const oy = TILE_SPRITE_PAD_Y;
  return [
    { bit: 1, a: [4 + ox, 17 + oy], b: [32 + ox, 3 + oy] },
    { bit: 2, a: [32 + ox, 3 + oy], b: [60 + ox, 17 + oy] },
    { bit: 4, a: [60 + ox, 17 + oy], b: [32 + ox, 29 + oy] },
    { bit: 8, a: [4 + ox, 15 + oy], b: [32 + ox, 29 + oy] },
  ];
}

function insetBand(a: [number, number], b: [number, number], dist: number): { a: [number, number]; b: [number, number] } {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = tileCx() - mx;
  const dy = tileCy() - my;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (dx / len) * dist;
  const oy = (dy / len) * dist;
  return { a: [a[0] + ox, a[1] + oy], b: [b[0] + ox, b[1] + oy] };
}

function wetGround(biome: BiomeName): string {
  switch (biome) {
    case "salt marshes": return "#2a3a34";
    case "tundra grid": return "#3a4648";
    case "glass desert": return "#4a4236";
    case "volcanic shelf": return "#2c2624";
    case "jungle wreckage": return "#1e3024";
    default: return "#24362c";
  }
}

function shoreSand(biome: BiomeName): string {
  switch (biome) {
    case "glass desert": return "#c4b080";
    case "tundra grid": return "#8a9490";
    case "volcanic shelf": return "#6a5a4c";
    case "salt marshes": return "#7a7a58";
    default: return "#b8a478";
  }
}

function waterDeep(biome: BiomeName): string {
  switch (biome) {
    case "salt marshes": return "#1c3a32";
    case "tundra grid": return "#2a4a58";
    case "glass desert": return "#2a5a58";
    case "volcanic shelf": return "#1a2830";
    case "jungle wreckage": return "#1a3a30";
    default: return "#1a3c4c";
  }
}

function waterMid(biome: BiomeName): string {
  switch (biome) {
    case "salt marshes": return "#2e5a48";
    case "tundra grid": return "#4a7a88";
    case "glass desert": return "#3e8a80";
    case "volcanic shelf": return "#2a4048";
    default: return "#2e6a78";
  }
}

function waterHi(biome: BiomeName): string {
  switch (biome) {
    case "tundra grid": return "#b8d8e0";
    case "glass desert": return "#9ee0d0";
    default: return "#8ec8c4";
  }
}

function foam(biome: BiomeName): string {
  return biome === "volcanic shelf" ? "#8a8070" : "#e8e0c8";
}

function rockColors(biome: BiomeName, p: Palette): { mid: string; hi: string; dark: string; ink: string } {
  switch (biome) {
    case "rust canyons": return { mid: "#8a5a3a", hi: "#c48a58", dark: "#4a2e20", ink: "#2a1810" };
    case "volcanic shelf": return { mid: "#5a504c", hi: "#8a7a70", dark: "#2a2422", ink: "#141010" };
    case "tundra grid": return { mid: "#6a7478", hi: "#b0b8b4", dark: "#3a4448", ink: "#1c2224" };
    case "glass desert": return { mid: "#a08058", hi: "#d4b078", dark: "#5a4430", ink: "#2c2018" };
    default: return { mid: p.secondary, hi: p.light, dark: p.dark, ink: p.outline };
  }
}

function canopyColors(biome: BiomeName): { dark: string; mid: string; hi: string } {
  switch (biome) {
    case "jungle wreckage": return { dark: "#1e3a22", mid: "#2f5a30", hi: "#5a8a40" };
    case "salt marshes": return { dark: "#2a4030", mid: "#3e5a3c", hi: "#6a7a48" };
    case "tundra grid": return { dark: "#3a4a44", mid: "#4e6058", hi: "#7a8a78" };
    case "crystal flats": return { dark: "#2a3c32", mid: "#3e5844", hi: "#6a8a62" };
    default: return { dark: "#2a3a26", mid: "#3c5234", hi: "#5a7044" };
  }
}
