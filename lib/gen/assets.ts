import {
  SURFACE_CONCRETE,
  SURFACE_ROAD,
  type BiomeName,
  type Palette,
  type ShapeSpec,
  type SpriteSpec,
  type TileContour,
  type TileSpriteOptions,
} from "../types";

export { buildingSprite, rubbleSprite, unitSprite, wreckSprite } from "./svgArt";

const TW = 64;
const TH = 32;
const INK = "#11130f";
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
    shapes.push(ell(cx - 14, cy - 8, 28, 12, p.light));
    shapes.push(ell(cx + 2, cy + 1, 26, 12, p.dark));
    shapes.push(ell(cx - 6, cy - 1, 18, 8, p.primary));
    for (let i = 0; i < 7; i++) {
      const ox = ((v >> (i * 3)) % 23) - 11;
      const oy = ((v >> (i * 2 + 1)) % 9) - 4;
      const ew = 7 + (i % 3) * 3;
      const eh = 3 + (i % 2) * 2;
      shapes.push(ell(cx + ox - ew / 2, cy + oy - eh / 2, ew, eh, i % 2 ? p.light : p.secondary));
    }
    for (let i = 0; i < 4; i++) {
      const ox = ((v >> (i * 4)) % 21) - 10;
      const oy = ((v >> (i * 3 + 1)) % 7) - 3;
      shapes.push(ell(cx + ox, cy + oy, 2 + (i % 2), 1 + (i % 2), i % 2 ? p.light : p.dark));
    }
  }
  if (kind === "water" || contour === "bank") {
    shapes.push(poly(diamondPts(cx, cy + 1, 58, 26), shoreSand(biome)));
    shapes.push(ell(cx - 16, cy - 2, 22, 10, shoreSand(biome)));
    shapes.push(ell(cx + 6, cy + 2, 20, 9, wetGround(biome)));
    shapes.push(poly(diamondPts(cx - 1, cy + 2, 46, 18), wetGround(biome)));
  }
  if ((v & 3) === 0) shapes.push(ell(cx - 10 + (v % 7), cy - 2, 11, 5, p.dark));
}

function paintGroundCover(shapes: ShapeSpec[], biome: BiomeName, p: Palette, v: number, contour: TileContour): void {
  const cx = TW / 2;
  const cy = TH / 2;
  const clumps = lush(biome) ? 6 : arid(biome) ? 4 : 5;
  for (let i = 0; i < clumps; i++) {
    const ox = ((v >> (i * 3)) % 25) - 12;
    const oy = ((v >> (i * 2 + 2)) % 9) - 4;
    if (arid(biome)) {
      shapes.push(ell(cx + ox - 3, cy + oy, 8, 3, i % 2 ? p.light : p.dark));
      shapes.push(line(cx + ox - 4, cy + oy + 1, cx + ox + 5, cy + oy + 2, i % 2 ? p.light : p.dark, 1));
    } else {
      shapes.push(ell(cx + ox - 2, cy + oy, 8 + (i % 2) * 3, 4, i % 2 ? p.accent : p.dark));
      shapes.push(ell(cx + ox, cy + oy - 1, 5, 2, p.light));
    }
  }
  const blades = lush(biome) ? 8 : contour === "ridge" ? 3 : 5;
  for (let i = 0; i < blades; i++) {
    const ox = ((v >> (i * 2 + 1)) % 23) - 11;
    const oy = ((v >> (i + 4)) % 7) - 3;
    shapes.push(line(cx + ox, cy + oy + 2, cx + ox + (i % 2 ? 2 : -2), cy + oy - 3, i % 3 ? p.accent : p.light, 1));
  }
  if (contour === "ridge" || (v % 5) === 0) {
    shapes.push(ell(cx + ((v % 9) - 4), cy + 2, 8, 4, p.dark));
    shapes.push(ell(cx + ((v % 9) - 3), cy + 1, 4, 2, p.light));
  }
  for (let i = 0; i < 3; i++) {
    const ox = ((v >> (i * 5 + 2)) % 19) - 9;
    const oy = ((v >> (i * 4 + 3)) % 6) - 2;
    shapes.push(ell(cx + ox, cy + oy + 1, 4, 2, i % 2 ? p.secondary : p.dark));
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
  if (mask & 1) {
    shapes.push(ell(10, 2, 22, 10, p.dark));
    shapes.push(poly([0, 16, 32, 0, 32, 4, 5, 18], p.dark));
  }
  if (mask & 2) {
    shapes.push(ell(34, 2, 22, 10, p.dark));
    shapes.push(poly([32, 0, 64, 16, 59, 18, 32, 4], p.dark));
  }
  if (mask & 4) {
    shapes.push(ell(34, 18, 22, 10, p.secondary));
    shapes.push(poly([64, 16, 32, 32, 32, 28, 59, 14], p.secondary));
  }
  if (mask & 8) {
    shapes.push(ell(8, 18, 22, 10, p.secondary));
    shapes.push(poly([32, 32, 0, 16, 5, 14, 32, 28], p.secondary));
  }
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
  const cw = slim ? 13 : 18;
  const ch = slim ? 11 : 10;
  shapes.push(ell(x - cw / 2 + 1, y + 2, cw - 1, 5, "rgba(10,12,8,0.4)"));
  shapes.push(ell(x - 2, y - 8, 5, 13, trunk, INK));
  shapes.push(line(x + 1, y - 6, x + 1, y + 3, trunkHi, 1));
  if ((v & 2) === 0) shapes.push(line(x - 1, y - 3, x - 5, y - 8, trunk, 1));
  shapes.push(ell(x - cw / 2 - 2, y - 15, cw * 0.62, ch, canopy.dark, INK));
  shapes.push(ell(x - cw / 2 + 4, y - 17, cw * 0.7, ch + 1, canopy.dark, INK));
  shapes.push(ell(x - cw / 2 + 1, y - 18, cw - 4, ch - 2, canopy.mid));
  shapes.push(ell(x - 2, y - 16, slim ? 5 : 7, 4, canopy.hi));
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
