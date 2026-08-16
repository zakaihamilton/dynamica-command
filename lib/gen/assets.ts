import { BUILDING_STATS } from "../catalog";
import {
  SURFACE_CONCRETE,
  SURFACE_ROAD,
  type BiomeName,
  type BuildingKind,
  type BuildingSpriteOptions,
  type Facing,
  type Palette,
  type ShapeSpec,
  type SpriteSpec,
  type TileContour,
  type TileSpriteOptions,
  type UnitKind,
  type UnitSpriteOptions,
} from "../types";

const TW = 64;
const TH = 32;
const INK = "#11130f";
const STEEL = "#59605a";
const STEEL_LIGHT = "#7a8178";
const STEEL_DARK = "#303530";
const CONCRETE = "#68685e";
const CONCRETE_LIGHT = "#818277";
const RUST = "#74452f";
const RUST_LIGHT = "#8a5a3c";
const GLASS = "#5e7a6c";
const GLASS_LIT = "#c5e392";
const SAND = "#8a7a58";
const BRASS = "#c3a65d";
const GOLD = "#d3b846";
const ART_PIXEL_SCALE = 1;

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

function rec(x: number, y: number, w: number, h: number, fill: string, stroke?: string): ShapeSpec {
  return { type: "rect", x, y, w, h, fill, stroke, strokeWidth: stroke ? 1 : undefined };
}

function line(x: number, y: number, x2: number, y2: number, stroke: string, width = 2): ShapeSpec {
  return { type: "line", x, y, w: x2 - x, h: y2 - y, fill: "transparent", stroke, strokeWidth: width };
}

function diamondPts(cx: number, cy: number, w: number, h: number): number[] {
  return [cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy];
}

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return (x ^ (x >>> 16)) >>> 0;
}

const TERRAIN: Record<BiomeName, [string, string, string, string]> = {
  "ash plains": ["#4f5a43", "#3e4736", "#6a7558", "#2c3328"],
  "crystal flats": ["#5a6a58", "#465448", "#7a8a72", "#313c34"],
  "rust canyons": ["#7a5738", "#5c402c", "#9a7350", "#3a2a20"],
  "salt marshes": ["#4a5c42", "#354636", "#657854", "#243028"],
  "glass desert": ["#8c7856", "#6e5e46", "#ad9468", "#46382a"],
  "tundra grid": ["#6e7c74", "#586468", "#8e9a90", "#3a4448"],
  "jungle wreckage": ["#385236", "#283e28", "#547448", "#1a281c"],
  "volcanic shelf": ["#4c4440", "#372f2c", "#6a5a50", "#221c1c"],
};

const RESOURCE_PALETTE: Palette = {
  primary: "#4a5c38",
  secondary: "#2a3824",
  accent: "#b3d33f",
  outline: "#182015",
  light: "#e2ed72",
  dark: "#24301c",
};

function terrainPalette(biome: BiomeName, elev: number): Palette {
  const [base, dark, light, outline] = TERRAIN[biome];
  const high = elev >= 3;
  return {
    primary: high ? light : elev <= 0 ? dark : base,
    secondary: high ? base : dark,
    accent: light,
    outline,
    light: high ? "#c6c4b4" : light,
    dark,
  };
}

export function cliffFaces(biome: BiomeName, elev: number): {
  south: string;
  east: string;
  southInk: string;
  eastInk: string;
} {
  const [base, dark, , outline] = TERRAIN[biome];
  const high = elev >= 3;
  return {
    south: high ? dark : outline,
    east: high ? base : dark,
    southInk: outline,
    eastInk: high ? dark : outline,
  };
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
  const v = hash(variant + elev * 17);
  const contour = opts.contour ?? defaultContour(kind, elev);
  const floorElev = contour === "ridge" ? Math.min(elev, 1) : contour === "bank" || kind === "water" ? 0 : elev;
  const p = kind === "resource" ? RESOURCE_PALETTE : terrainPalette(biome, floorElev);
  const cx = TW / 2;
  const cy = TH / 2;
  const mask = opts.edgeMask ?? 0;
  const shapes: ShapeSpec[] = [];

  paintFloor(shapes, biome, p, v, kind, contour);
  if (opts.surface === SURFACE_ROAD) paintRoad(shapes, biome, v);
  else if (opts.surface === SURFACE_CONCRETE) paintConcrete(shapes, v);
  else if (kind !== "water") paintGroundCover(shapes, biome, p, v, contour);

  if (kind === "water") {
    paintWater(shapes, biome, v, mask);
  } else if (contour === "none" && mask) {
    paintSoftBlend(shapes, mask, p);
  }

  if (contour === "ridge") paintRidge(shapes, biome, p, v, mask);
  if (kind === "resource") paintCrystals(shapes, p, opts.resourceLevel ?? 4);
  else if (kind === "blocked" && contour !== "ridge") paintBlocker(shapes, biome, p, v, cx, cy);

  return {
    id: tileSpriteId(kind, elev, { ...opts, biome, variant, contour }),
    kind: "tile",
    w: TW,
    h: TH,
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
  return `tile:${kind}:${biome}:${elev}:${variant}:${opts.edgeMask ?? 0}:${opts.surface ?? 0}:${opts.resourceLevel ?? 0}:${contour}`;
}

function paintFloor(
  shapes: ShapeSpec[],
  biome: BiomeName,
  p: Palette,
  v: number,
  kind: "clear" | "water" | "resource" | "blocked",
  contour: TileContour,
): void {
  const cx = TW / 2;
  const cy = TH / 2;
  const base = kind === "water" || contour === "bank" ? wetGround(biome) : p.primary;
  shapes.push(poly(diamondPts(cx, cy, TW + 4, TH + 2), base));
  if (kind !== "water" && contour !== "bank") {
    shapes.push(poly([8, 14, 32, 2, 32, 6, 12, 16], p.light));
    shapes.push(poly([32, 26, 56, 16, 52, 14, 32, 22], p.dark));
    shapes.push(poly([28, 20, 58, 18, 32, 30, 10, 24], "rgba(12,14,10,0.28)"));
    for (let i = 0; i < 4; i++) {
      const ox = ((v >> (i * 4)) % 21) - 10;
      const oy = ((v >> (i * 3 + 1)) % 7) - 3;
      shapes.push(ell(cx + ox, cy + oy, 2 + (i % 2), 1 + (i % 2), i % 2 ? p.light : p.dark));
    }
  }
  if (kind === "water" || contour === "bank") {
    shapes.push(poly(diamondPts(cx, cy + 1, 58, 26), shoreSand(biome)));
    shapes.push(poly(diamondPts(cx - 1, cy + 2, 46, 18), wetGround(biome)));
  }
  if ((v & 3) === 0) shapes.push(ell(cx - 10 + (v % 7), cy - 2, 9, 4, p.dark));
}

function paintGroundCover(shapes: ShapeSpec[], biome: BiomeName, p: Palette, v: number, contour: TileContour): void {
  const cx = TW / 2;
  const cy = TH / 2;
  const clumps = lush(biome) ? 5 : arid(biome) ? 3 : 4;
  for (let i = 0; i < clumps; i++) {
    const ox = ((v >> (i * 3)) % 25) - 12;
    const oy = ((v >> (i * 2 + 2)) % 9) - 4;
    if (arid(biome)) {
      shapes.push(line(cx + ox - 4, cy + oy, cx + ox + 5, cy + oy + 1, i % 2 ? p.light : p.dark, 1));
    } else {
      shapes.push(ell(cx + ox, cy + oy, 5 + (i % 2), 2 + (i % 2), i % 2 ? p.accent : p.dark));
    }
  }
  const blades = lush(biome) ? 7 : contour === "ridge" ? 3 : 5;
  for (let i = 0; i < blades; i++) {
    const ox = ((v >> (i * 2 + 1)) % 23) - 11;
    const oy = ((v >> (i + 4)) % 7) - 3;
    shapes.push(line(cx + ox, cy + oy + 2, cx + ox + (i % 2 ? 1 : -1), cy + oy - 2, i % 3 ? p.accent : p.light, 1));
  }
  if (contour === "ridge" || (v % 5) === 0) {
    shapes.push(ell(cx + ((v % 9) - 4), cy + 2, 6, 3, p.dark));
    shapes.push(ell(cx + ((v % 9) - 3), cy + 1, 3, 2, p.light));
  }
  for (let i = 0; i < 3; i++) {
    const ox = ((v >> (i * 5 + 2)) % 19) - 9;
    const oy = ((v >> (i * 4 + 3)) % 6) - 2;
    shapes.push(ell(cx + ox, cy + oy + 1, 3, 2, i % 2 ? p.secondary : p.dark));
  }
}

function paintRoad(shapes: ShapeSpec[], biome: BiomeName, v: number): void {
  const cx = TW / 2;
  const cy = TH / 2;
  const dirt = biome === "tundra grid" ? "#5a605e" : biome === "volcanic shelf" ? "#4a4038" : "#6a5844";
  const worn = biome === "tundra grid" ? "#747a76" : "#8a7354";
  shapes.push(poly(diamondPts(cx, cy, 56, 24), dirt));
  shapes.push(poly(diamondPts(cx + 1, cy, 44, 16), worn));
  shapes.push(line(18, 12 + (v % 3), 46, 20 - (v % 2), "#4a3c30", 2));
  shapes.push(line(20, 14 + (v % 2), 44, 18, "#3a3028", 1));
  shapes.push(ell(cx - 8 + (v % 5), cy + 3, 4, 2, "#5a4a38"));
  shapes.push(ell(cx + 10, cy - 1, 3, 2, "#4a3c30"));
}

function paintConcrete(shapes: ShapeSpec[], v: number): void {
  const cx = TW / 2;
  const cy = TH / 2;
  shapes.push(poly(diamondPts(cx, cy, 58, 26), "#6a6c64", "#3a3c38", 1));
  shapes.push(poly(diamondPts(cx, cy - 1, 48, 18), "#7a7c74"));
  shapes.push(line(32, 4, 32, 28, "#50534c", 1));
  shapes.push(line(8, 16, 56, 16, "#7c8076", 1));
  if (v % 2 === 0) shapes.push(ell(cx + 8, cy + 4, 6, 3, "#5a5c54"));
  shapes.push(line(14, 10, 22, 14, "#8a8c82", 1));
}

function paintSoftBlend(shapes: ShapeSpec[], mask: number, p: Palette): void {
  if (mask & 1) shapes.push(poly([0, 16, 32, 0, 32, 4, 5, 18], p.dark));
  if (mask & 2) shapes.push(poly([32, 0, 64, 16, 59, 18, 32, 4], p.dark));
  if (mask & 4) shapes.push(poly([64, 16, 32, 32, 32, 28, 59, 14], p.secondary));
  if (mask & 8) shapes.push(poly([32, 32, 0, 16, 5, 14, 32, 28], p.secondary));
}

function paintWater(shapes: ShapeSpec[], biome: BiomeName, v: number, mask: number): void {
  const cx = TW / 2;
  const cy = TH / 2;
  const deep = waterDeep(biome);
  const mid = waterMid(biome);
  const hi = waterHi(biome);
  shapes.push(poly(diamondPts(cx, cy, 50, 20), deep));
  shapes.push(poly(diamondPts(cx + 1, cy - 1, 36, 12), mid));
  shapes.push(poly(diamondPts(cx - 1, cy + 2, 24, 8), mid));
  const flow = (v % 5) - 2;
  shapes.push(line(16 + flow, 13, 30 + flow, 18, hi, 1));
  shapes.push(line(28 - flow, 12, 46 - flow, 19, hi, 1));
  shapes.push(line(20, 17, 34, 22, deep, 1));
  if ((v & 2) === 0) shapes.push(ell(cx - 6 + (v % 4), cy, 10, 3, hi));
  shapes.push(ell(cx + 4 - (v % 5), cy + 2, 7, 2, hi));
  if (mask) paintBanks(shapes, biome, mask, v);
  else {
    shapes.push(line(12, 16, 22, 12, foam(biome), 1));
    shapes.push(line(42, 16, 52, 20, foam(biome), 1));
  }
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
    shapes.push(ell(TW / 2 + ((v % 7) - 3), TH / 2 + 1, 7, 3, rock.dark));
    shapes.push(ell(TW / 2 + ((v % 5) - 2), TH / 2, 4, 2, rock.hi));
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
    shapes.push(poly([28, 2, 32, 0, 36, 2, 32, 8], rock.hi, rock.ink, 1));
    shapes.push(poly([30, 2, 32, 1, 32, 7], rock.dark));
  }
}

function paintCrystals(shapes: ShapeSpec[], p: Palette, level: number): void {
  const n = Math.max(1, Math.min(4, level));
  const crystals = [[18, 18, 8, 12], [28, 10, 8, 18], [38, 16, 7, 13], [24, 20, 6, 9]].slice(0, n);
  shapes.push(ell(26, 18, 16, 7, p.dark));
  for (const [x, y, w, h] of crystals) {
    shapes.push(poly([x!, y! + h!, x! + w! / 2, y!, x! + w!, y! + h!], p.accent, p.outline, 1));
    shapes.push(poly([x! + w! / 2, y!, x! + w!, y! + h!, x! + w! * 0.62, y! + h! - 2], p.light));
    shapes.push(line(x! + w! * 0.45, y! + 2, x! + w! * 0.45, y! + h! - 2, "#f6f4a8", 1));
  }
}

function paintBlocker(
  shapes: ShapeSpec[],
  biome: BiomeName,
  p: Palette,
  v: number,
  cx: number,
  cy: number,
): void {
  const useTrees = biome === "jungle wreckage" || biome === "salt marshes" || biome === "ash plains"
    || biome === "crystal flats" || (biome === "tundra grid" && (v & 1) === 0);
  if (useTrees) {
    const count = lush(biome) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const ox = count === 1 ? (v % 5) - 2 : i === 0 ? -7 : 6;
      const oy = count === 1 ? 1 : i === 0 ? 2 : -1;
      pushTree(shapes, cx + ox, cy + oy, v + i * 9, biome);
    }
  } else {
    pushRocks(shapes, cx, cy, v, p);
  }
}

function pushTree(shapes: ShapeSpec[], x: number, y: number, v: number, biome: BiomeName): void {
  const canopy = canopyColors(biome);
  const trunk = biome === "tundra grid" ? "#4a4038" : "#3c2a1c";
  const trunkHi = biome === "tundra grid" ? "#6a6058" : "#6a4c32";
  const slim = biome === "tundra grid";
  const cw = slim ? 11 : 16;
  const ch = slim ? 12 : 10;
  shapes.push(ell(x - cw / 2 + 1, y + 2, cw - 1, 5, "rgba(10,12,8,0.4)"));
  shapes.push(rec(x - 1, y - 7, 3, 11, trunk, INK));
  shapes.push(line(x + 1, y - 6, x + 1, y + 3, trunkHi, 1));
  if ((v & 2) === 0) shapes.push(line(x - 1, y - 3, x - 4, y - 6, trunk, 1));
  shapes.push(ell(x - cw / 2, y - 16, cw, ch, canopy.dark, INK));
  shapes.push(ell(x - cw / 2 + 2, y - 17, cw - 5, ch - 3, canopy.mid));
  shapes.push(ell(x - 1, y - 16, slim ? 4 : 6, 3, canopy.hi));
}

function pushRocks(shapes: ShapeSpec[], cx: number, cy: number, v: number, p: Palette): void {
  shapes.push(ell(cx - 8 + (v % 4), cy + 2, 12, 6, "rgba(12,10,8,0.35)"));
  shapes.push(poly([cx - 8, cy + 3, cx - 2, cy - 4, cx + 6, cy + 1, cx + 3, cy + 5, cx - 6, cy + 6], p.secondary, INK, 1));
  shapes.push(poly([cx - 2, cy - 4, cx + 6, cy + 1, cx + 1, cy + 2], p.light));
  shapes.push(ell(cx + 8, cy + 3, 8, 4, p.dark, INK));
  shapes.push(ell(cx + 9, cy + 2, 4, 2, p.light));
  if ((v & 3) === 0) shapes.push(ell(cx - 2, cy + 5, 5, 3, p.dark));
}

type Edge = { bit: number; a: [number, number]; b: [number, number] };

function diamondEdges(): Edge[] {
  return [
    { bit: 1, a: [4, 17], b: [32, 3] },
    { bit: 2, a: [32, 3], b: [60, 17] },
    { bit: 4, a: [60, 17], b: [32, 29] },
    { bit: 8, a: [4, 15], b: [32, 29] },
  ];
}

function insetBand(a: [number, number], b: [number, number], dist: number): { a: [number, number]; b: [number, number] } {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = TW / 2 - mx;
  const dy = TH / 2 - my;
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

function facingVector(facing: Facing): { x: number; y: number } {
  const angle = (facing / 8) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) * 0.52 };
}

function fade(shape: ShapeSpec, alpha: number): ShapeSpec {
  return { ...shape, alpha };
}

function isoQuad(cx: number, cy: number, length: number, width: number, facing: number): number[] {
  const a = (facing / 8) * Math.PI * 2;
  const dx = Math.cos(a) * length * 0.5;
  const dy = Math.sin(a) * length * 0.26;
  const px = -Math.sin(a) * width * 0.5;
  const py = Math.cos(a) * width * 0.26;
  return [
    cx - dx + px, cy - dy + py,
    cx + dx + px, cy + dy + py,
    cx + dx - px, cy + dy - py,
    cx - dx - px, cy - dy - py,
  ];
}

function pushIsoBox(
  shapes: ShapeSpec[],
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  rise: number,
  roof: string,
  left: string,
  right: string,
): void {
  const n = [cx, cy - hh];
  const e = [cx + hw, cy];
  const s = [cx, cy + hh];
  const wpt = [cx - hw, cy];
  const ng = [n[0]!, n[1]! + rise];
  const eg = [e[0]!, e[1]! + rise];
  const sg = [s[0]!, s[1]! + rise];
  const wg = [wpt[0]!, wpt[1]! + rise];
  shapes.push(poly([ng[0]!, ng[1]!, eg[0]!, eg[1]!, sg[0]!, sg[1]!, wg[0]!, wg[1]!], STEEL_DARK, INK, 1));
  shapes.push(poly([wpt[0]!, wpt[1]!, s[0]!, s[1]!, sg[0]!, sg[1]!, wg[0]!, wg[1]!], left, INK, 1));
  shapes.push(poly([e[0]!, e[1]!, s[0]!, s[1]!, sg[0]!, sg[1]!, eg[0]!, eg[1]!], right, INK, 1));
  shapes.push(poly([n[0]!, n[1]!, e[0]!, e[1]!, s[0]!, s[1]!, wpt[0]!, wpt[1]!], roof, INK, 1));
}

function pushTower(
  shapes: ShapeSpec[],
  x: number,
  y: number,
  w: number,
  h: number,
  body: string,
  dark: string,
  light: string,
  core?: string,
): void {
  shapes.push(ell(x, y + h - 7, w, 10, dark, INK));
  shapes.push(ell(x + 1, y + 3, w - 2, h - 6, body, INK));
  shapes.push(ell(x + 3, y + 6, 4, h - 12, light));
  if (core) shapes.push(ell(x + 4, y + 8, w - 10, h - 16, core));
  shapes.push(ell(x, y, w, 9, dark, INK));
  shapes.push(ell(x + 3, y + 1, w - 8, 5, light));
}

function pushWindow(shapes: ShapeSpec[], x: number, y: number, lit: boolean, wide = false): void {
  const w = wide ? 7 : 5;
  const h = wide ? 6 : 7;
  shapes.push(rec(x, y, w, h, INK));
  shapes.push(rec(x + 1, y + 1, w - 2, h - 2, lit ? GLASS_LIT : GLASS));
  if (lit) shapes.push(rec(x + 1, y + 1, 2, 2, "#eef6c4"));
}

function insetDiamond(n: number[], e: number[], s: number[], west: number[], t: number): number[] {
  const mx = (n[0]! + s[0]!) / 2;
  const my = (n[1]! + s[1]!) / 2;
  const p = (q: number[]) => [mx + (q[0]! - mx) * t, my + (q[1]! - my) * t];
  const ni = p(n);
  const ei = p(e);
  const si = p(s);
  const wi = p(west);
  return [ni[0]!, ni[1]!, ei[0]!, ei[1]!, si[0]!, si[1]!, wi[0]!, wi[1]!];
}

const SKINS = ["#b58d68", "#c68642", "#e8c39e", "#8d5524", "#d4a574"];

export function unitSprite(kind: UnitKind, palette: Palette, options: UnitSpriteOptions = {}): SpriteSpec {
  const infantry = kind === "infantry" || kind === "antiArmor";
  const w = infantry ? 50 : 56;
  const h = infantry ? 46 : 48;
  const facing = options.facing ?? 0;
  const frame = options.animationFrame ?? 0;
  const variant = options.variant ?? 0;
  const dir = facingVector(facing);
  const team = palette.primary;
  const teamLight = palette.light;
  const cx = w / 2;
  const cy = infantry ? 22 : 23;
  const shapes: ShapeSpec[] = [ell(cx - 18, h - 13, 36, 9, "rgba(0,0,0,0.42)")];
  const dmg = options.damageStage ?? 0;

  if (kind === "harvester") pushHarvester(shapes, cx, cy, facing, dir, frame, team, teamLight);
  else if (kind === "tank") pushTank(shapes, cx, cy, facing, dir, frame, team, teamLight);
  else pushInfantry(shapes, kind, cx, cy, dir, frame, variant, team, teamLight);

  if (variant % 3 === 1) shapes.push(rec(cx - 16, cy - 2, 3, 2, GOLD));
  shapes.push(line(cx - 17, h - 10, cx - 8, h - 11, "rgba(220,230,210,0.32)", 1));
  shapes.push(line(cx + 8, h - 10, cx + 17, h - 11, "rgba(10,14,11,0.62)", 1));
  if (dmg > 0) shapes.push(ell(cx - 10, cy - 2, 14, 6, "rgba(30,24,18,0.65)"));
  if (dmg > 1) {
    shapes.push(line(cx - 8, cy - 4, cx + 4, cy + 6, "#1b1714", 2));
    shapes.push(fade(ell(cx + 2, cy - 10, 10, 12, "#3a3a36"), 0.45));
  }

  return {
    id: `unit:${kind}:${palette.primary}:${variant}:${facing}:${frame}:${dmg}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes,
    anchorX: w / 2,
    anchorY: h - 8,
    pixelScale: ART_PIXEL_SCALE,
  };
}

function pushTreads(
  shapes: ShapeSpec[],
  cx: number,
  cy: number,
  length: number,
  width: number,
  facing: Facing,
  frame: number,
): void {
  const tread = [0, 1, 0, -1][frame] ?? 0;
  shapes.push(poly(isoQuad(cx, cy + 4, length + 4, width + 8, facing), INK, INK, 1));
  shapes.push(poly(isoQuad(cx, cy + 4, length + 1, width + 6, facing), STEEL_DARK, INK, 1));
  const a = (facing / 8) * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a) * 0.26;
  for (let i = 0; i < 6; i++) {
    const t = (i - 2.5) / 3;
    const px = cx + dx * t * length * 0.42;
    const py = cy + 4 + dy * t * length * 0.42 + ((i + tread) & 1);
    shapes.push(ell(px - 3, py - 1, 6, 3, i % 2 ? "#3a403c" : "#262b27", INK));
  }
}

function pushHarvester(
  shapes: ShapeSpec[],
  cx: number,
  cy: number,
  facing: Facing,
  dir: { x: number; y: number },
  frame: number,
  team: string,
  teamLight: string,
): void {
  pushTreads(shapes, cx, cy, 34, 16, facing, frame);
  shapes.push(poly(isoQuad(cx, cy + 1, 32, 18, facing), STEEL_DARK, INK, 1));
  shapes.push(poly(isoQuad(cx, cy - 1, 28, 14, facing), STEEL, INK, 1));
  shapes.push(poly(isoQuad(cx - dir.x * 4, cy - dir.y * 4 - 3, 16, 10, facing), RUST, INK, 1));
  shapes.push(poly(isoQuad(cx - dir.x * 4, cy - dir.y * 4 - 5, 12, 7, facing), RUST_LIGHT, INK, 1));
  shapes.push(line(cx - dir.x * 8, cy - 1, cx + dir.x * 6, cy - 1 + dir.y * 6, team, 3));
  const hx = cx + dir.x * 10;
  const hy = cy + dir.y * 10 - 5;
  pushIsoBox(shapes, hx, hy, 7, 5, 9, STEEL_LIGHT, STEEL, STEEL_DARK);
  shapes.push(rec(hx - 3, hy - 2, 7, 4, "#83a6a0", INK));
  shapes.push(rec(hx - 2, hy - 1, 4, 2, teamLight));
  shapes.push(rec(cx - 6, cy - 3, 2, 2, STEEL_DARK));
  shapes.push(rec(cx + 4, cy - 2, 2, 2, STEEL_DARK));
  shapes.push(rec(cx - 2, cy + 2, 3, 2, team));
  const scoop = 7 + ([0, 2, 4, 2][frame] ?? 0);
  const sx = cx + dir.x * 16;
  const sy = cy + dir.y * 16 + 2;
  shapes.push(poly([
    sx - dir.y * 8, sy + dir.x * 4,
    sx + dir.x * scoop, sy + dir.y * scoop,
    sx + dir.y * 8, sy - dir.x * 4,
    sx + dir.x * 2, sy + dir.y * 2,
  ], "#474b46", INK, 1));
  shapes.push(line(sx, sy, sx + dir.x * (scoop + 2), sy + dir.y * (scoop + 2), STEEL_DARK, 2));
  shapes.push(rec(cx - 2, cy - 8, 3, 7, STEEL_DARK, INK));
  shapes.push(ell(cx - 3, cy - 11, 5, 4, RUST, INK));
}

function pushTank(
  shapes: ShapeSpec[],
  cx: number,
  cy: number,
  facing: Facing,
  dir: { x: number; y: number },
  frame: number,
  team: string,
  teamLight: string,
): void {
  pushTreads(shapes, cx, cy, 32, 15, facing, frame);
  shapes.push(poly(isoQuad(cx, cy + 1, 30, 16, facing), STEEL_DARK, INK, 1));
  shapes.push(poly(isoQuad(cx, cy - 1, 26, 12, facing), STEEL, INK, 1));
  shapes.push(poly(isoQuad(cx, cy - 3, 18, 8, facing), STEEL_LIGHT, INK, 1));
  shapes.push(line(cx - dir.x * 9, cy - 2, cx + dir.x * 8, cy - 2 + dir.y * 8, team, 3));
  for (let i = 0; i < 3; i++) {
    shapes.push(rec(cx - 8 + i * 6, cy - 5, 4, 2, STEEL_DARK));
  }
  const tx = cx + dir.x * 1;
  const ty = cy - 6;
  shapes.push(ell(tx - 10, ty - 4, 20, 13, STEEL_DARK, INK));
  shapes.push(ell(tx - 8, ty - 3, 16, 10, STEEL_LIGHT, INK));
  shapes.push(ell(tx - 6, ty - 2, 12, 7, team, INK));
  shapes.push(ell(tx - 2, ty, 5, 3, STEEL_DARK, INK));
  const bx = tx;
  const by = ty + 3;
  shapes.push(line(bx, by, bx + dir.x * 22, by + dir.y * 22, STEEL_DARK, 5));
  shapes.push(line(bx, by - 1, bx + dir.x * 21, by - 1 + dir.y * 21, STEEL_LIGHT, 2));
  shapes.push(ell(bx + dir.x * 10 - 2, by + dir.y * 10 - 1, 4, 3, STEEL, INK));
  shapes.push(ell(bx + dir.x * 16 - 2, by + dir.y * 16 - 1, 4, 3, STEEL_DARK, INK));
  shapes.push(ell(bx + dir.x * 21 - 2, by + dir.y * 21 - 2, 5, 4, STEEL, INK));
  shapes.push(rec(tx + 4, ty - 1, 3, 2, teamLight));
  shapes.push(ell(tx - 3, ty - 5, 6, 4, STEEL_DARK, INK));
  shapes.push(rec(cx - 5, cy + 1, 8, 2, team));
}

function pushInfantry(
  shapes: ShapeSpec[],
  kind: UnitKind,
  cx: number,
  cy: number,
  dir: { x: number; y: number },
  frame: number,
  variant: number,
  team: string,
  teamLight: string,
): void {
  const heavy = kind === "antiArmor";
  const left = [2, 0, -2, 0][frame] ?? 0;
  const right = [-2, 0, 2, 0][frame] ?? 0;
  const bob = frame % 2 === 0 ? 0 : 1;
  const leanX = dir.x * 2;
  const y = cy + bob;
  const skin = SKINS[variant % SKINS.length]!;
  const gunInFront = dir.y >= -0.05;
  const gx = cx + leanX + 1;
  const gy = y + 4;
  const gun = (): void => {
    if (heavy) {
      shapes.push(line(gx, gy, gx + dir.x * 18, gy + dir.y * 18, "#343a34", 6));
      shapes.push(line(gx, gy, gx + dir.x * 16, gy + dir.y * 16, STEEL, 3));
      shapes.push(ell(gx + dir.x * 17 - 2, gy + dir.y * 17 - 2, 5, 4, RUST, INK));
      shapes.push(rec(gx - 4 - dir.x * 4, gy - 3, 6, 5, STEEL_DARK, INK));
    } else {
      shapes.push(line(gx + 1, gy, gx + 1 + dir.x * 16, gy + dir.y * 16, INK, 3));
      shapes.push(line(gx + 1, gy - 1, gx + 1 + dir.x * 14, gy - 1 + dir.y * 14, teamLight, 1));
      shapes.push(rec(gx - 1, gy - 2, 4, 3, STEEL_DARK, INK));
    }
  };
  if (!gunInFront) gun();
  shapes.push(line(cx - 3 + leanX, y + 12, cx - 6 + left, y + 20, "#2c322e", 4));
  shapes.push(line(cx + 2 + leanX, y + 12, cx + 5 + right, y + 20, "#2c322e", 4));
  shapes.push(rec(cx - 5 + left, y + 18, 5, 3, STEEL_DARK, INK));
  shapes.push(rec(cx + 1 + right, y + 18, 5, 3, STEEL_DARK, INK));
  const bw = heavy ? 16 : 13;
  shapes.push(rec(cx - bw / 2 + leanX, y, bw, 14, heavy ? "#4c5148" : STEEL, INK));
  shapes.push(rec(cx - bw / 2 + 1 + leanX, y + 2, 4, 10, team));
  shapes.push(line(cx - 4 + leanX, y + 4, cx + 4 + leanX, y + 4, STEEL_DARK, 1));
  shapes.push(line(cx - 4 + leanX, y + 8, cx + 4 + leanX, y + 8, STEEL_DARK, 1));
  shapes.push(line(cx - 3 + leanX, y + 3, cx + 2 + leanX, y + 11, "#2a322c", 1));
  shapes.push(rec(cx + bw / 2 - 6 + leanX, y + 6, 4, 4, STEEL_DARK, INK));
  shapes.push(rec(cx + bw / 2 - 5 + leanX, y + 1, 5, 7, STEEL_DARK, INK));
  if (heavy) shapes.push(rec(cx - bw / 2 - 2 + leanX, y + 3, 5, 9, RUST, INK));
  shapes.push(ell(cx - 6 + leanX, y - 11, 12, 12, skin, INK));
  const helm = [
    cx - 7 + leanX, y - 8,
    cx - 4 + leanX, y - 14,
    cx + 6 + leanX, y - 14,
    cx + 9 + leanX, y - 7,
  ];
  shapes.push(poly(helm, heavy ? "#3a403c" : STEEL_DARK, INK, 1));
  shapes.push(rec(cx - 4 + leanX, y - 9, 9, 3, heavy ? "#1a1e1b" : "#2a332c"));
  shapes.push(rec(cx - 3 + leanX, y - 8, 3, 2, team));
  if (variant % 4 === 2) shapes.push(line(cx + 6 + leanX, y - 12, cx + 8 + leanX, y - 18, STEEL, 2));
  if (gunInFront) gun();
}

function isoStructure(fw: number, fh: number, rise: number, team: string): {
  w: number;
  h: number;
  gh: number;
  roof: number[][];
  mx: number;
  my: number;
  foundation: ShapeSpec[];
  walls: ShapeSpec[];
  roofShapes: ShapeSpec[];
} {
  const gw = (fw + fh) * (TW / 2);
  const gh = (fw + fh) * (TH / 2);
  const pad = 2;
  const w = gw + pad * 2;
  const h = rise + gh + pad * 2;
  const n = [w / 2, pad];
  const e = [w - pad, pad + gh / 2];
  const s = [w / 2, pad + gh];
  const west = [pad, pad + gh / 2];
  const ng = [n[0]!, n[1]! + rise];
  const eg = [e[0]!, e[1]! + rise];
  const sg = [s[0]!, s[1]! + rise];
  const wg = [west[0]!, west[1]! + rise];
  const mx = (n[0]! + s[0]!) / 2;
  const my = (n[1]! + s[1]!) / 2;
  const left = "#6a7268";
  const right = "#3a403c";
  const foundation = [
    poly([
      wg[0]! - 3, wg[1]! + 2,
      sg[0]!, sg[1]! + 5,
      eg[0]! + 3, eg[1]! + 2,
      ng[0]!, ng[1]! + 2,
    ], "#4a4e48", INK, 1),
    poly([ng[0]!, ng[1]!, eg[0]!, eg[1]!, sg[0]!, sg[1]!, wg[0]!, wg[1]!], "#2a2e2a", INK, 1),
  ];
  const walls = [
    poly([west[0]!, west[1]!, s[0]!, s[1]!, sg[0]!, sg[1]!, wg[0]!, wg[1]!], left, INK, 1),
    poly([e[0]!, e[1]!, s[0]!, s[1]!, sg[0]!, sg[1]!, eg[0]!, eg[1]!], right, INK, 1),
    poly([
      west[0]!, west[1]! + rise * 0.55,
      s[0]!, s[1]! + rise * 0.55,
      s[0]!, s[1]! + rise * 0.55 + 5,
      west[0]!, west[1]! + rise * 0.55 + 5,
    ], team, INK, 1),
  ];
  const roofShapes = [
    poly([n[0]!, n[1]!, e[0]!, e[1]!, s[0]!, s[1]!, west[0]!, west[1]!], CONCRETE, INK, 1),
    poly(insetDiamond(n, e, s, west, 0.72), CONCRETE_LIGHT, INK, 1),
    poly(insetDiamond(n, e, s, west, 0.42), "#5a5e56", INK, 1),
    line(west[0]! + 6, west[1]! + 3, n[0]! - 4, n[1]! + 4, "rgba(220,224,202,0.28)", 1),
    line(n[0]! + 4, n[1]! + 3, e[0]! - 6, e[1]! + 3, "rgba(22,25,21,0.45)", 1),
    line(n[0]!, n[1]! + 2, s[0]!, s[1]! - 2, "rgba(22,25,21,0.28)", 1),
    poly([
      west[0]!, west[1]!,
      s[0]!, s[1]!,
      s[0]!, s[1]! + 5,
      west[0]!, west[1]! + 5,
    ], team, INK, 1),
  ];
  return { w, h, gh, roof: [n, e, s, west], mx, my, foundation, walls, roofShapes };
}

function buildingRise(kind: BuildingKind, fpw: number): number {
  switch (kind) {
    case "turret": return 16;
    case "barracks": return 24;
    case "power": return 26;
    case "refinery": return 28;
    case "factory": return 30;
    case "constructionYard": return 32;
    case "objective": return 34;
    default: return 28 + fpw * 6;
  }
}

function pushScaffold(shapes: ShapeSpec[], w: number, h: number, construction: number): void {
  const scaffoldTop = Math.max(4, h - 18 - construction * 12);
  shapes.push(rec(5, scaffoldTop, w - 10, 3, "rgba(184,138,72,0.82)", INK));
  for (let x = 7; x < w - 5; x += 14) {
    shapes.push(line(x, scaffoldTop, x, h - 9, "#8b623a", 2));
    shapes.push(line(x + 6, scaffoldTop, x, h - 18, "#b0814d", 1));
  }
  shapes.push(line(5, h - 10, w - 5, scaffoldTop, "#b0814d", 1));
  shapes.push(rec(4, h - 11, w - 8, 3, SAND));
}

export function buildingSprite(kind: BuildingKind, palette: Palette, options: BuildingSpriteOptions = {}): SpriteSpec {
  const fp = BUILDING_STATS[kind].footprint;
  const rise = buildingRise(kind, fp.w);
  const box = isoStructure(fp.w, fp.h, rise, palette.primary);
  const { w, h, gh, roof, mx, my } = box;
  const shapes: ShapeSpec[] = [...box.foundation];
  const construction = options.constructionStage ?? 3;
  const dmg = options.damageStage ?? 0;
  const variant = options.variant ?? 0;
  const team = palette.primary;
  const facing = options.facing ?? 0;
  const lit = construction >= 3 && dmg < 2;

  if (construction >= 1) shapes.push(...box.walls);
  if (construction >= 2) shapes.push(...box.roofShapes);
  if (construction >= 1) {
    const wy = my + rise * 0.32;
    if (kind !== "turret") {
      pushWindow(shapes, mx - 26, wy, lit);
      pushWindow(shapes, mx - 18, wy + 2, lit, true);
      pushWindow(shapes, mx + 14, wy + 1, lit);
    }
  }
  if (construction >= 2) {
    pushBuildingDetails(shapes, kind, mx, my, rise, team, palette.light, facing, lit, construction >= 3);
  }
  if (construction < 3) {
    pushScaffold(shapes, w, h, construction);
    shapes.push(line(mx - 10, my - 4, mx - 10, my + rise * 0.55, RUST, 3));
    shapes.push(line(mx - 10, my - 4, mx + 18, my + 2, RUST, 3));
    shapes.push(ell(mx + 16, my, 6, 4, STEEL_DARK, INK));
  }
  if (construction === 0) {
    shapes.push(line(mx - 16, my + rise * 0.2, mx - 16, my + rise, STEEL_DARK, 2));
    shapes.push(line(mx + 12, my + rise * 0.15, mx + 12, my + rise, STEEL_DARK, 2));
  }

  shapes.push(line(roof[3]![0]! + 5, roof[3]![1]! + 4, roof[2]![0]! - 5, roof[2]![1]! + 4, "rgba(220,224,202,0.18)", 1));
  if (dmg > 0) {
    shapes.push(ell(mx - 18, my + 3, 17, 7, "rgba(34,24,19,0.72)"));
    shapes.push(line(mx + 2, my - 2, mx + 13, my + 8, "#211b18", 2));
    shapes.push(rec(mx - 26, my + rise * 0.32, 5, 7, "#1a1814"));
  }
  if (dmg > 1) {
    shapes.push(ell(mx + 8, 2 + (variant % 4), 12, 15, "rgba(26,27,25,0.65)"));
    shapes.push(fade(ell(mx + 10, 0, 16, 14, "#3a3c38"), 0.4));
    shapes.push(poly([mx - 8, h - 14, mx, h - 22, mx + 10, h - 12, mx + 2, h - 8], "#3a322c", INK, 1));
    shapes.push(poly([mx + 14, h - 12, mx + 22, h - 18, mx + 28, h - 10], "#2c2824", INK, 1));
  }

  return {
    id: `bld:${kind}:${palette.primary}:${variant}:${facing}:${dmg}:${construction}`,
    kind: "building",
    w,
    h,
    palette,
    shapes,
    anchorX: w / 2,
    anchorY: h - 2 - gh / 2,
    pixelScale: ART_PIXEL_SCALE,
  };
}

function pushBuildingDetails(
  shapes: ShapeSpec[],
  kind: BuildingKind,
  mx: number,
  my: number,
  rise: number,
  team: string,
  teamLight: string,
  facing: Facing,
  lit: boolean,
  complete: boolean,
): void {
  if (kind === "constructionYard") {
    pushIsoBox(shapes, mx - 6, my + 4, 16, 10, 10, STEEL_DARK, STEEL, STEEL_DARK);
    shapes.push(rec(mx - 4, my + 2, 12, 6, team, INK));
    if (complete) {
      pushWindow(shapes, mx - 2, my + 3, lit, true);
      pushWindow(shapes, mx + 6, my + 3, lit);
    }
    shapes.push(line(mx - 8, my - 22, mx - 8, my + 10, RUST, 5));
    shapes.push(line(mx - 8, my - 20, mx + 24, my - 14, RUST, 4));
    shapes.push(line(mx + 22, my - 14, mx + 16, my + 4, BRASS, 2));
    shapes.push(ell(mx + 20, my - 17, 8, 6, STEEL_LIGHT, INK));
    shapes.push(ell(mx + 8, my - 6, 14, 9, STEEL_DARK, INK));
    shapes.push(ell(mx + 10, my - 5, 10, 6, STEEL, INK));
    if (complete) shapes.push(ell(mx + 12, my - 4, 6, 3, lit ? GLASS_LIT : GLASS));
    shapes.push(rec(mx + 18, my + 6, 3, 10, team));
    shapes.push(poly([mx + 21, my + 6, mx + 28, my + 4, mx + 28, my + 12, mx + 21, my + 10], team, INK, 1));
  } else if (kind === "power") {
    pushTower(shapes, mx - 22, my - 14, 18, 28, STEEL, STEEL_DARK, STEEL_LIGHT, complete ? team : undefined);
    pushTower(shapes, mx + 2, my - 16, 18, 32, STEEL_DARK, INK, team, complete ? (lit ? GLASS_LIT : teamLight) : undefined);
    pushIsoBox(shapes, mx - 2, my + 10, 12, 7, 8, STEEL, STEEL_LIGHT, STEEL_DARK);
    shapes.push(line(mx - 10, my - 4, mx + 8, my - 8, "#c7d8cf", 2));
    shapes.push(line(mx - 4, my + 6, mx - 4, my + rise * 0.4, STEEL_DARK, 2));
    for (let i = 0; i < 3; i++) shapes.push(rec(mx + 16, my + 8 + i * 4, 8, 2, STEEL_DARK));
    if (complete) {
      shapes.push(ell(mx - 16, my - 8, 8, 10, lit ? "#d8f0a8" : team));
      shapes.push(fade(ell(mx + 8, my - 10, 8, 12, teamLight), lit ? 0.55 : 0.2));
    }
  } else if (kind === "refinery") {
    pushTower(shapes, mx - 28, my - 10, 16, 30, RUST, STEEL_DARK, RUST_LIGHT);
    pushTower(shapes, mx - 10, my - 14, 16, 34, STEEL_DARK, INK, STEEL, complete ? RUST_LIGHT : undefined);
    shapes.push(line(mx - 18, my - 8, mx + 18, my - 12, STEEL_LIGHT, 3));
    shapes.push(line(mx - 12, my - 2, mx + 20, my + 2, STEEL, 2));
    shapes.push(line(mx - 20, my + 2, mx + 8, my + 6, STEEL_DARK, 2));
    shapes.push(ell(mx + 6, my + 4, 5, 3, RUST, INK));
    pushIsoBox(shapes, mx + 18, my + 6, 16, 9, 8, "#444943", STEEL_DARK, "#2c302c");
    shapes.push(rec(mx + 10, my + 6, 18, 10, INK));
    shapes.push(rec(mx + 12, my + 8, 14, 7, complete && lit ? "#1e2a22" : "#151814"));
    shapes.push(rec(mx + 14, my + 4, 12, 3, team));
    shapes.push(ell(mx + 22, my + 14, 10, 5, STEEL_DARK, INK));
    if (complete) {
      shapes.push(rec(mx - 6, my + 8, 8, 4, RUST, INK));
      for (let i = 0; i < 4; i++) shapes.push(rec(mx - 30 + i * 5, my + 16, 3, 2, STEEL));
    }
  } else if (kind === "barracks") {
    shapes.push(poly([mx - 26, my + 6, mx, my - 14, mx + 26, my + 6, mx, my + 18], "#4a5248", INK, 1));
    shapes.push(poly([mx - 18, my + 4, mx, my - 8, mx + 18, my + 4, mx, my + 12], "#5a6258", INK, 1));
    shapes.push(line(mx, my - 14, mx, my + 18, STEEL_DARK, 2));
    shapes.push(rec(mx - 8, my + 2, 16, 14, STEEL_DARK, INK));
    shapes.push(rec(mx - 5, my + 6, 10, 10, INK));
    if (complete) shapes.push(rec(mx - 4, my + 7, 3, 8, team));
    for (let i = 0; i < 5; i++) {
      shapes.push(ell(mx - 28 + i * 12, my + 14, 10, 5, SAND, INK));
      shapes.push(ell(mx - 26 + i * 12, my + 13, 6, 3, "#9a8a64"));
    }
    shapes.push(line(mx + 16, my - 4, mx + 16, my - 18, STEEL_DARK, 2));
    if (complete) {
      shapes.push(poly([mx + 16, my - 18, mx + 26, my - 16, mx + 26, my - 10, mx + 16, my - 12], team, INK, 1));
      pushWindow(shapes, mx - 20, my - 2, lit);
      pushWindow(shapes, mx + 8, my - 2, lit);
    }
  } else if (kind === "factory") {
    shapes.push(poly([mx - 34, my + 4, mx + 6, my - 14, mx + 2, my + 14, mx - 28, my + 20], "#3e4440", INK, 1));
    shapes.push(rec(mx - 20, my + 2, 24, 16, INK, STEEL_DARK));
    shapes.push(rec(mx - 16, my + 6, 16, 11, complete && lit ? "#1a221c" : "#121614"));
    if (complete) {
      shapes.push(rec(mx - 14, my + 8, 4, 8, STEEL));
      shapes.push(rec(mx - 6, my + 8, 4, 8, STEEL));
    }
    shapes.push(rec(mx - 20, my, 24, 4, team));
    pushTower(shapes, mx + 8, my - 18, 10, 24, STEEL_DARK, INK, STEEL);
    pushTower(shapes, mx + 22, my - 16, 10, 22, RUST, INK, RUST_LIGHT);
    shapes.push(line(mx + 14, my - 20, mx + 28, my - 8, STEEL, 3));
    shapes.push(rec(mx + 12, my - 22, 4, 4, BRASS, INK));
    for (let i = 0; i < 3; i++) shapes.push(ell(mx - 24 + i * 8, my + 18, 8, 3, STEEL_DARK));
  } else if (kind === "turret") {
    const dir = facingVector(facing);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      shapes.push(ell(mx + Math.cos(a) * 14 - 5, my + Math.sin(a) * 7 + 4, 10, 5, SAND, INK));
    }
    shapes.push(ell(mx - 16, my - 4, 32, 18, STEEL_DARK, INK));
    shapes.push(ell(mx - 12, my - 4, 24, 14, STEEL, INK));
    shapes.push(ell(mx - 9, my - 3, 18, 11, team, INK));
    shapes.push(ell(mx - 5, my - 1, 10, 6, STEEL_LIGHT, INK));
    shapes.push(line(mx, my + 1, mx + dir.x * 26, my + 1 + dir.y * 26, STEEL_DARK, 7));
    shapes.push(line(mx, my, mx + dir.x * 24, my + dir.y * 24, STEEL_LIGHT, 2));
    shapes.push(ell(mx + dir.x * 24 - 2, my + dir.y * 24 - 2, 5, 4, STEEL, INK));
    if (complete) {
      shapes.push(ell(mx + 8, my - 8, 5, 4, lit ? GLASS_LIT : STEEL_DARK, INK));
      shapes.push(rec(mx - 18, my + 8, 6, 4, STEEL_DARK, INK));
    }
  } else {
    pushIsoBox(shapes, mx, my + 2, 18, 10, 12, STEEL_DARK, STEEL, "#2c302c");
    shapes.push(line(mx, my + 6, mx, my - 26, team, 4));
    shapes.push(ell(mx - 12, my - 24, 24, 12, GOLD, INK));
    shapes.push(ell(mx - 8, my - 22, 16, 8, STEEL_DARK, INK));
    if (complete) {
      shapes.push(ell(mx - 5, my - 20, 10, 5, lit ? "#f3dc79" : "#8a7428"));
      shapes.push(line(mx - 8, my - 18, mx + 8, my - 26, "#f3dc79", 2));
    }
    shapes.push(rec(mx - 14, my + 6, 8, 5, team, INK));
    for (let i = 0; i < 3; i++) shapes.push(rec(mx + 10, my + i * 5, 6, 3, STEEL));
  }
}

export function wreckSprite(kind: UnitKind, palette: Palette): SpriteSpec {
  const infantry = kind === "infantry" || kind === "antiArmor";
  const w = infantry ? 50 : 56;
  const h = infantry ? 36 : 38;
  const cx = w / 2;
  const cy = h - 16;
  const shapes: ShapeSpec[] = [
    ell(cx - 16, h - 12, 32, 8, "rgba(12,10,8,0.55)"),
    ell(cx - 12, h - 10, 22, 6, "rgba(34,24,16,0.72)"),
  ];
  if (infantry) {
    shapes.push(rec(cx - 8, cy, 16, 8, STEEL_DARK, INK));
    shapes.push(poly([cx - 10, cy + 6, cx - 2, cy - 2, cx + 8, cy + 4, cx + 4, cy + 8], "#3a322c", INK, 1));
    shapes.push(ell(cx - 4, cy - 4, 8, 6, "#6a4a32", INK));
    shapes.push(line(cx + 4, cy, cx + 14, cy + 4, STEEL, 2));
  } else {
    shapes.push(poly(isoQuad(cx, cy + 4, 28, 14, 1), "#2a2e2a", INK, 1));
    shapes.push(poly(isoQuad(cx + 2, cy + 2, 20, 10, 7), STEEL_DARK, INK, 1));
    shapes.push(poly([cx - 8, cy, cx + 4, cy - 6, cx + 12, cy + 2, cx + 2, cy + 6], "#3a322c", INK, 1));
    shapes.push(ell(cx - 6, cy - 2, 10, 5, RUST, INK));
    if (kind === "harvester") {
      shapes.push(poly([cx + 8, cy, cx + 18, cy + 6, cx + 10, cy + 8], "#474b46", INK, 1));
    } else {
      shapes.push(line(cx, cy, cx + 12, cy + 4, STEEL_DARK, 3));
    }
  }
  shapes.push(fade(ell(cx - 2, cy - 8, 12, 10, "#3a3a36"), 0.4));
  return {
    id: `wreck:${kind}:${palette.primary}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes,
    anchorX: w / 2,
    anchorY: h - 6,
    pixelScale: ART_PIXEL_SCALE,
  };
}

export function rubbleSprite(kind: BuildingKind, palette: Palette): SpriteSpec {
  const fp = BUILDING_STATS[kind].footprint;
  const gw = (fp.w + fp.h) * (TW / 2);
  const gh = (fp.w + fp.h) * (TH / 2);
  const w = gw + 8;
  const h = Math.max(28, gh + 16);
  const mx = w / 2;
  const my = h - gh / 2 - 6;
  const shapes: ShapeSpec[] = [
    ell(mx - gw * 0.28, h - 14, gw * 0.55, 10, "rgba(12,10,8,0.5)"),
    poly([
      mx - gw * 0.32, my + 6,
      mx, my - 4,
      mx + gw * 0.28, my + 8,
      mx + 8, my + 14,
      mx - 10, my + 12,
    ], "#3a322c", INK, 1),
    poly([mx - 14, my + 4, mx - 2, my - 8, mx + 10, my + 2], STEEL_DARK, INK, 1),
    poly([mx + 4, my + 2, mx + 18, my - 2, mx + 22, my + 8, mx + 8, my + 10], "#2c2824", INK, 1),
    ell(mx - 8, my + 2, 14, 6, "rgba(34,24,19,0.7)"),
    rec(mx + 6, my + 4, 8, 4, STEEL_DARK, INK),
    rec(mx - 18, my + 8, 6, 3, RUST, INK),
  ];
  if (kind === "turret") {
    shapes.push(ell(mx - 10, my, 20, 10, STEEL_DARK, INK));
    shapes.push(line(mx, my + 2, mx + 14, my + 6, STEEL, 3));
  } else if (kind === "power") {
    shapes.push(ell(mx - 12, my - 6, 10, 16, STEEL_DARK, INK));
    shapes.push(ell(mx + 4, my - 4, 8, 12, "#2a2e2a", INK));
  }
  shapes.push(fade(ell(mx + 2, my - 10, 16, 12, "#3a3c38"), 0.35));
  return {
    id: `rubble:${kind}:${palette.primary}`,
    kind: "building",
    w,
    h,
    palette,
    shapes,
    anchorX: w / 2,
    anchorY: h - 2 - gh / 2,
    pixelScale: ART_PIXEL_SCALE,
  };
}

