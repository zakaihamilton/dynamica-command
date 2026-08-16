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
export const TILE_SPRITE_PAD_X = 4;
export const TILE_SPRITE_PAD_Y = 4;
const SPRITE_W = TW + TILE_SPRITE_PAD_X * 2;
const SPRITE_H = TH + TILE_SPRITE_PAD_Y * 2;
const INK = "#11130f";
const ART_PIXEL_SCALE = 1;

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

function jitter(seed: number, i: number, span: number): number {
  return ((seed >>> ((i * 3) % 28)) % (span * 2 + 1)) - span;
}

function irregularIso(cx: number, cy: number, w: number, h: number, seed: number, out = 1): number[] {
  const hw = w / 2;
  const hh = h / 2;
  const verts: Array<[number, number]> = [
    [cx, cy - hh],
    [cx + hw, cy],
    [cx, cy + hh],
    [cx - hw, cy],
  ];
  const pts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % 4]!;
    pushJittered(pts, a[0], a[1], cx, cy, seed, i * 4, 2);
    pushJittered(pts, a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, cx, cy, seed, i * 4 + 1, 3 + out);
    pushJittered(pts, a[0] * 0.5 + b[0] * 0.5, a[1] * 0.5 + b[1] * 0.5, cx, cy, seed, i * 4 + 2, 4 + out);
    pushJittered(pts, a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, cx, cy, seed, i * 4 + 3, 3 + out);
  }
  return pts;
}

function pushJittered(
  pts: number[],
  x: number,
  y: number,
  cx: number,
  cy: number,
  seed: number,
  i: number,
  span: number,
): void {
  const dx = x - cx;
  const dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const j = jitter(seed, i, span);
  pts.push(Math.round(x + (dx / len) * j), Math.round(y + (dy / len) * j * 0.5));
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
  const drop = dropSteps * heightStep * (hillside ? 0.72 : 1);
  const inset = hillside ? heightStep * 0.4 : 0;
  const jx = faceJitter(seed, 0, Math.max(2, Math.round(tw * 0.04)));
  const jy = faceJitter(seed, 1, Math.max(1, Math.round(th * 0.06)));
  const southTop: [number, number] = [jx, th + jy];
  const westTop: [number, number] = [-tw / 2, th / 2];
  const eastTop: [number, number] = [tw / 2, th / 2];
  const topA = side === "south" ? westTop : eastTop;
  const topB = southTop;
  const botA: [number, number] = [
    topA[0] + (side === "south" ? inset * 0.45 : -inset * 0.45) + faceJitter(seed, 2, 2),
    topA[1] + drop - inset * 0.15 + faceJitter(seed, 3, 1),
  ];
  const botB: [number, number] = [
    topB[0] + faceJitter(seed, 4, 2),
    topB[1] + drop - inset * 0.2 + faceJitter(seed, 5, 1),
  ];
  const points: number[] = [];
  const mids = hillside ? 1 : 3;
  pushEdge(points, topA, topB, seed, 10, mids, tw * 0.02, th * 0.03);
  pushEdge(points, topB, botB, seed, 20, mids, tw * 0.05, 0);
  pushEdge(points, botB, botA, seed, 30, mids, tw * 0.02, th * 0.03);
  pushEdge(points, botA, topA, seed, 40, mids, tw * 0.05, 0);
  const cracks: number[][] = [];
  if (!hillside) {
    for (let i = 0; i < 2; i++) {
      const t = 0.28 + i * 0.31 + faceJitter(seed, 50 + i, 8) / 80;
      const u = t + 0.06 + faceJitter(seed, 60 + i, 6) / 80;
      cracks.push([
        topA[0] + (topB[0] - topA[0]) * t + faceJitter(seed, 70 + i, 2),
        topA[1] + (topB[1] - topA[1]) * t,
        botA[0] + (botB[0] - botA[0]) * u + faceJitter(seed, 80 + i, 3),
        botA[1] + (botB[1] - botA[1]) * u,
      ]);
    }
  }
  return { points, cracks };
}

function pushEdge(
  pts: number[],
  a: [number, number],
  b: [number, number],
  seed: number,
  salt: number,
  mids: number,
  jx: number,
  jy: number,
): void {
  pts.push(a[0], a[1]);
  for (let i = 1; i <= mids; i++) {
    const t = i / (mids + 1);
    pts.push(
      a[0] + (b[0] - a[0]) * t + faceJitter(seed, salt + i, Math.max(1, Math.round(jx))),
      a[1] + (b[1] - a[1]) * t + faceJitter(seed, salt + i + 17, Math.max(1, Math.round(jy))),
    );
  }
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
    fillFace(ctx, originX, originY, face.points, colors.south);
    strokeCracks(ctx, originX, originY, face.cracks, colors.southInk);
  }
  if (dropE > 0) {
    const face = elevationFace("east", dropE, tw, th, heightStep, seed);
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
  const v = hash(variant + elev * 17);
  const contour = opts.contour ?? defaultContour(kind, elev);
  const floorElev = contour === "ridge" ? Math.min(elev, 1) : contour === "bank" || kind === "water" ? 0 : elev;
  const p = terrainPalette(biome, floorElev);
  const cx = tileCx();
  const cy = tileCy();
  const mask = opts.edgeMask ?? 0;
  const shapes: ShapeSpec[] = [];

  paintFloor(shapes, biome, p, v, kind, contour);
  if (opts.surface === SURFACE_ROAD) paintRoad(shapes, biome, v);
  else if (opts.surface === SURFACE_CONCRETE) paintConcrete(shapes, v);
  else if (kind !== "water" && kind !== "resource") paintGroundCover(shapes, biome, p, v, contour);

  if (kind === "water") {
    paintWater(shapes, biome, v, mask);
  } else if (contour === "none" && mask) {
    paintSoftBlend(shapes, mask, p, v);
  }

  if (contour === "ridge") paintRidge(shapes, biome, p, v, mask);
  if (kind === "resource") paintOreField(shapes, v, opts.resourceLevel ?? 4);
  else if (kind === "blocked" && contour !== "ridge") paintBlocker(shapes, biome, p, v, cx, cy);

  return {
    id: tileSpriteId(kind, elev, { ...opts, biome, variant, contour }),
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
  const cx = tileCx();
  const cy = tileCy();
  const base = kind === "water" || contour === "bank" ? wetGround(biome) : p.primary;
  shapes.push(poly(irregularIso(cx, cy, TW + 8, TH + 6, v, 5), base));
  shapes.push(poly(irregularIso(cx + signed(v, 1, 4), cy + signed(v, 2, 2), 58, 26, v >> 1, 4), base));
  if (kind !== "water" && contour !== "bank") {
    const patches = 5 + pick(v, 3, 4);
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
    for (let i = 0; i < 6; i++) {
      const ox = signed(v, 150 + i, 11);
      const oy = signed(v, 170 + i, 4);
      shapes.push(ell(cx + ox, cy + oy, 2 + pick(v, 190 + i, 3), 1 + pick(v, 200 + i, 2), i % 2 ? p.light : p.dark));
    }
  }
  if (kind === "water" || contour === "bank") {
    shapes.push(poly(irregularIso(cx + signed(v, 4, 3), cy + 1, 54, 24, v, 3), shoreSand(biome)));
    shapes.push(ell(cx - 12 + signed(v, 5, 6), cy - 2 + signed(v, 6, 2), 18 + pick(v, 7, 8), 8 + pick(v, 8, 4), shoreSand(biome)));
    shapes.push(ell(cx + 4 + signed(v, 9, 6), cy + 2 + signed(v, 10, 2), 16 + pick(v, 11, 8), 7 + pick(v, 12, 4), wetGround(biome)));
    shapes.push(poly(irregularIso(cx + signed(v, 13, 3), cy + 2, 40, 16, v >> 4, 2), wetGround(biome)));
  }
  if (pick(v, 14, 4) === 0) shapes.push(ell(cx + signed(v, 15, 10), cy + signed(v, 16, 3), 8 + pick(v, 17, 6), 4, p.dark));
}

function paintGroundCover(shapes: ShapeSpec[], biome: BiomeName, p: Palette, v: number, contour: TileContour): void {
  const cx = tileCx();
  const cy = tileCy();
  const dense = lush(biome);
  const dry = arid(biome);
  const clumps = (dense ? 4 : dry ? 2 : 3) + pick(v, 1, dense ? 5 : 4);
  for (let i = 0; i < clumps; i++) {
    const ox = signed(v, 20 + i, 12);
    const oy = signed(v, 50 + i, 4);
    if (dry) {
      shapes.push(ell(cx + ox - 3, cy + oy, 6 + pick(v, 80 + i, 5), 3, i % 2 ? p.light : p.dark));
      shapes.push(line(cx + ox - 4, cy + oy + 1, cx + ox + 4 + pick(v, 90 + i, 3), cy + oy + 2, i % 2 ? p.light : p.dark, 1));
    } else {
      shapes.push(ell(cx + ox - 2, cy + oy, 6 + pick(v, 80 + i, 6), 3 + pick(v, 90 + i, 2), i % 2 ? p.accent : p.dark));
      if (pick(v, 100 + i, 3) !== 0) shapes.push(ell(cx + ox, cy + oy - 1, 4 + pick(v, 110 + i, 3), 2, p.light));
    }
  }
  const blades = (dense ? 5 : contour === "ridge" ? 2 : 3) + pick(v, 3, 5);
  for (let i = 0; i < blades; i++) {
    const ox = signed(v, 120 + i, 11);
    const oy = signed(v, 150 + i, 3);
    const lean = pick(v, 180 + i, 2) === 0 ? 2 : -2;
    shapes.push(line(cx + ox, cy + oy + 2, cx + ox + lean + signed(v, 190 + i, 1), cy + oy - 2 - pick(v, 200 + i, 3), i % 3 ? p.accent : p.light, 1));
  }
  if (dense && pick(v, 4, 3) !== 2) {
    pushBush(shapes, cx + signed(v, 5, 8), cy + signed(v, 6, 3), v, biome);
  }
  if (pick(v, 7, 6) === 0) {
    const lx = cx + signed(v, 8, 8);
    const ly = cy + signed(v, 9, 2);
    shapes.push(line(lx - 5, ly, lx + 6, ly + 2, p.dark, 2));
    shapes.push(line(lx - 4, ly - 1, lx + 4, ly + 1, p.secondary, 1));
  }
  if (contour === "ridge" || pick(v, 10, 5) === 0) {
    shapes.push(ell(cx + signed(v, 11, 6), cy + 2, 6 + pick(v, 12, 4), 3, p.dark));
    shapes.push(ell(cx + signed(v, 13, 6), cy + 1, 3 + pick(v, 14, 3), 2, p.light));
  }
  for (let i = 0; i < 2 + pick(v, 15, 3); i++) {
    const ox = signed(v, 210 + i, 10);
    const oy = signed(v, 230 + i, 3);
    shapes.push(ell(cx + ox, cy + oy + 1, 3 + pick(v, 250 + i, 3), 2, i % 2 ? p.secondary : p.dark));
  }
}

function pushBush(shapes: ShapeSpec[], x: number, y: number, v: number, biome: BiomeName): void {
  const canopy = canopyColors(biome);
  const w = 9 + pick(v, 16, 6);
  shapes.push(ell(x - w / 2, y + 1, w, 4, "rgba(10,12,8,0.32)"));
  shapes.push(ell(x - w / 2 - 1, y - 5, w * 0.7, 6, canopy.dark, INK));
  shapes.push(ell(x - w / 2 + 3, y - 6, w * 0.55, 5, canopy.mid));
  if (pick(v, 17, 2) === 0) shapes.push(ell(x + 1, y - 4, 4, 3, canopy.hi));
}

function paintRoad(shapes: ShapeSpec[], biome: BiomeName, v: number): void {
  const cx = tileCx();
  const cy = tileCy();
  const dirt = biome === "tundra grid" ? "#5a605e" : biome === "volcanic shelf" ? "#4a4038" : "#6a5844";
  const worn = biome === "tundra grid" ? "#747a76" : "#8a7354";
  shapes.push(poly(irregularIso(cx, cy, 54, 22, v, 2), dirt));
  shapes.push(poly(irregularIso(cx + 2, cy + 1, 40, 14, v >> 3, 2), worn));
  shapes.push(line(18, 12 + (v % 3), 46, 20 - (v % 2), "#4a3c30", 2));
  shapes.push(line(20, 14 + (v % 2), 44, 18, "#3a3028", 1));
  shapes.push(ell(cx - 8 + (v % 5), cy + 3, 4, 2, "#5a4a38"));
  shapes.push(ell(cx + 10, cy - 1, 3, 2, "#4a3c30"));
}

function paintConcrete(shapes: ShapeSpec[], v: number): void {
  const cx = tileCx();
  const cy = tileCy();
  shapes.push(poly(irregularIso(cx, cy, 56, 24, v, 1), "#6a6c64", "#3a3c38", 1));
  shapes.push(poly(irregularIso(cx, cy - 1, 44, 16, v >> 2, 2), "#7a7c74"));
  shapes.push(line(30 + (v % 3), 5, 34 - (v % 2), 27, "#50534c", 1));
  shapes.push(line(10, 15 + (v % 2), 54, 17, "#7c8076", 1));
  if (v % 2 === 0) shapes.push(ell(cx + 8, cy + 4, 6, 3, "#5a5c54"));
  shapes.push(line(14, 10, 22, 14, "#8a8c82", 1));
}

function paintSoftBlend(shapes: ShapeSpec[], mask: number, p: Palette, v: number): void {
  const cx = tileCx();
  const cy = tileCy();
  if (mask & 1) {
    shapes.push(ell(cx - 16 + signed(v, 1, 3), cy - 14 + signed(v, 2, 2), 18 + pick(v, 3, 8), 9 + pick(v, 4, 4), p.dark));
    shapes.push(ell(cx - 2 + signed(v, 5, 3), cy - 12 + signed(v, 6, 2), 14 + pick(v, 7, 6), 7 + pick(v, 8, 3), p.secondary));
  }
  if (mask & 2) {
    shapes.push(ell(cx + 2 + signed(v, 9, 3), cy - 12 + signed(v, 10, 2), 18 + pick(v, 11, 8), 9 + pick(v, 12, 4), p.dark));
    shapes.push(ell(cx + 8 + signed(v, 13, 3), cy - 4 + signed(v, 14, 2), 12 + pick(v, 15, 6), 7 + pick(v, 16, 3), p.secondary));
  }
  if (mask & 4) {
    shapes.push(ell(cx + 2 + signed(v, 17, 3), cy + 4 + signed(v, 18, 2), 18 + pick(v, 19, 8), 9 + pick(v, 20, 4), p.secondary));
    shapes.push(ell(cx + 6 + signed(v, 21, 3), cy + 2, 12 + pick(v, 22, 6), 6 + pick(v, 23, 3), p.dark));
  }
  if (mask & 8) {
    shapes.push(ell(cx - 20 + signed(v, 24, 3), cy + 2 + signed(v, 25, 2), 18 + pick(v, 26, 8), 9 + pick(v, 27, 4), p.secondary));
    shapes.push(ell(cx - 14 + signed(v, 28, 3), cy - 2, 12 + pick(v, 29, 6), 6 + pick(v, 30, 3), p.dark));
  }
  if (mask & 16) shapes.push(ell(cx + 8 + signed(v, 31, 2), cy - 12, 10 + pick(v, 32, 5), 6 + pick(v, 33, 3), p.dark));
  if (mask & 32) shapes.push(ell(cx + 10 + signed(v, 34, 2), cy + 4, 10 + pick(v, 35, 5), 6 + pick(v, 36, 3), p.secondary));
  if (mask & 64) shapes.push(ell(cx - 18 + signed(v, 37, 2), cy + 4, 10 + pick(v, 38, 5), 6 + pick(v, 39, 3), p.secondary));
  if (mask & 128) shapes.push(ell(cx - 16 + signed(v, 40, 2), cy - 12, 10 + pick(v, 41, 5), 6 + pick(v, 42, 3), p.dark));
}

function paintWater(shapes: ShapeSpec[], biome: BiomeName, v: number, mask: number): void {
  const cx = tileCx();
  const cy = tileCy();
  const deep = waterDeep(biome);
  const mid = waterMid(biome);
  const hi = waterHi(biome);
  shapes.push(poly(irregularIso(cx, cy, 52, 20, v, 4), deep));
  shapes.push(poly(irregularIso(cx + ((v >> 4) % 5) - 2, cy - 1, 34, 12, v >> 4, 3), mid));
  shapes.push(poly(irregularIso(cx - 3 + ((v >> 8) % 5), cy + 2, 24, 9, v >> 7, 2), mid));
  const fx = ((v >> 3) % 13) - 6;
  const fy = ((v >> 7) % 7) - 3;
  const ax = ((v >> 11) % 7) - 3;
  const ay = ((v >> 14) % 5) - 2;
  shapes.push(line(cx - 8 + fx, cy - 1 + fy, cx + 4 + fx + ax, cy + 3 + fy + ay, hi, 1));
  if ((v & 3) !== 1) {
    const gx = ((v >> 9) % 11) - 5;
    const gy = ((v >> 5) % 5) - 2;
    shapes.push(line(cx + gx, cy + gy, cx + gx + 8 - ax, cy + gy + 2 + ay, hi, 1));
  }
  if ((v & 2) === 0) shapes.push(ell(cx - 6 + (v % 7), cy + fy, 9, 3, hi));
  shapes.push(ell(cx + 4 - ((v >> 2) % 6), cy + 2 + fy, 7, 2, hi));
  if (mask) paintBanks(shapes, biome, mask, v);
  else if ((v & 5) === 0) {
    shapes.push(line(cx - 10 + fx, cy + 1, cx - 2 + fx, cy - 2 + ay, foam(biome), 1));
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

function paintOreField(shapes: ShapeSpec[], v: number, level: number): void {
  const cx = tileCx();
  const cy = tileCy();
  const n = Math.max(1, Math.min(4, level));
  shapes.push(poly(irregularIso(cx, cy + 1, 52, 24, v, 3), ORE.stainLo));
  shapes.push(poly(irregularIso(cx - 2, cy, 42, 18, v >> 3, 2), ORE.stain));
  shapes.push(ell(cx - 13, cy - 3, 26, 11, ORE.stainHi));
  shapes.push(ell(cx + 7, cy + 2, 20, 9, ORE.stainLo));
  for (let i = 0; i < 4 + n; i++) {
    const ox = ((v >> (i * 3)) % 23) - 11;
    const oy = ((v >> (i * 2 + 2)) % 9) - 4;
    shapes.push(ell(cx + ox - 3, cy + oy, 8, 3, i % 2 ? ORE.stainHi : ORE.stainLo));
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
    .slice(0, 2 + n)
    .sort((a, b) => a.order - b.order);

  for (let i = 0; i < picked.length; i++) {
    const [ox, oy, rw, zh] = picked[i]!.slot;
    const seed = hash(v + i * 31);
    const width = rw + (seed % 3) - 1;
    const z = zh + (seed % 3);
    pushOreChunk(shapes, cx + ox, cy + oy, width, Math.max(3, Math.round(width * 0.48)), z, seed);
    if (n >= 2 && i >= picked.length - Math.min(2, n - 1)) {
      pushOreSpike(shapes, cx + ox + ((seed >> 3) % 3) - 1, cy + oy - z + 1, 3 + (seed % 2), 6 + (seed % 5), seed);
    }
  }

  for (let i = 0; i < 3 + n; i++) {
    const ox = ((v >> (i * 4 + 1)) % 23) - 11;
    const oy = ((v >> (i * 3 + 2)) % 9) - 4;
    shapes.push(ell(cx + ox, cy + oy + 1, 2 + (i % 2), 1 + (i % 2), i % 2 ? ORE.glint : ORE.south));
  }
}

function pushOreChunk(shapes: ShapeSpec[], x: number, y: number, rw: number, rh: number, zh: number, seed: number): void {
  const w = Math.max(4, rw);
  const h = Math.max(2, rh);
  const z = Math.max(3, zh);
  const jx = ((seed >> 3) % 3) - 1;
  const jy = ((seed >> 5) % 3) - 1;
  shapes.push(ell(x - w, y - 1, w * 2, h + 3, "rgba(18,14,8,0.42)"));
  shapes.push(poly([
    x - w, y,
    x, y + h,
    x, y + h - z,
    x - w, y - z,
  ], ORE.south, ORE.ink, 1));
  shapes.push(poly([
    x + w, y,
    x, y + h,
    x, y + h - z,
    x + w, y - z,
  ], ORE.east, ORE.ink, 1));
  shapes.push(poly([
    x + jx, y - h - z + jy,
    x + w, y - z,
    x, y + h - z,
    x - w, y - z,
  ], ORE.top, ORE.ink, 1));
  shapes.push(poly([
    x + jx, y - h - z + jy,
    x + w * 0.4, y - z - 1,
    x + 1, y - z + h * 0.25,
  ], ORE.lit));
}

function pushOreSpike(shapes: ShapeSpec[], x: number, y: number, w: number, h: number, seed: number): void {
  const lean = ((seed >> 2) % 5) - 2;
  const tipx = x + lean;
  const tipy = y - h;
  shapes.push(poly([x - w * 0.45, y, tipx, tipy, x, y + 1], ORE.stainLo, ORE.ink, 1));
  shapes.push(poly([x, y + 1, tipx, tipy, x + w * 0.55, y], ORE.crystal, ORE.ink, 1));
  shapes.push(poly([tipx, tipy, x + w * 0.2, y - 1, x + 0.4, y - h * 0.35], ORE.crystalLit));
  shapes.push(line(tipx, tipy + 1, x + 0.4, y - 1, ORE.glint, 1));
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
    || biome === "crystal flats" || (biome === "tundra grid" && pick(v, 1, 2) === 0);
  if (useTrees) {
    const count = lush(biome) ? 1 + pick(v, 2, 3) : 1;
    for (let i = 0; i < count; i++) {
      const ox = count === 1
        ? (signed(v, 3, 7) || 5) * (pick(v, 19, 2) === 0 ? -1 : 1)
        : i === 0 ? -7 + pick(v, 4, 6) : 6 - pick(v, 5, 6);
      const oy = count === 1
        ? signed(v, 6, 4)
        : i === 0 ? 2 - pick(v, 7, 5) : pick(v, 8, 5) - 3;
      if (i === count - 1 && pick(v, 9, 6) === 0) pushStump(shapes, cx + ox, cy + oy, v + i * 13, p);
      else pushTree(shapes, cx + ox, cy + oy, v + i * 9, biome);
    }
    if (pick(v, 10, 5) === 0) {
      pushRocks(shapes, cx + signed(v, 11, 6), cy + 3 + signed(v, 12, 2), v, p);
    }
  } else {
    pushRocks(shapes, cx + signed(v, 3, 6), cy + signed(v, 4, 3), v, p);
  }
}

function pushTree(shapes: ShapeSpec[], x: number, y: number, v: number, biome: BiomeName): void {
  const canopy = canopyColors(biome);
  const trunk = biome === "tundra grid" ? "#4a4038" : "#3c2a1c";
  const trunkHi = biome === "tundra grid" ? "#6a6058" : "#6a4c32";
  const slim = biome === "tundra grid";
  const scale = slim ? 0.92 : 0.78 + pick(v, 4, 8) / 14;
  const flip = pick(v, 5, 2) === 0 ? -1 : 1;
  const lean = signed(v, 6, 3);
  const cw = (slim ? 13 : 15 + pick(v, 7, 7)) * scale;
  const ch = (slim ? 11 : 8 + pick(v, 8, 5)) * scale;
  const trunkH = Math.max(10, (11 + pick(v, 9, 5)) * scale);
  const trunkW = Math.max(4, (4 + pick(v, 10, 3)) * scale);
  shapes.push(ell(x - cw / 2 + 1, y + 2, cw - 1, 5, "rgba(10,12,8,0.4)"));
  shapes.push(ell(x - trunkW / 2 + lean * 0.2, y - trunkH + 5, trunkW, trunkH, trunk, INK));
  shapes.push(line(x + lean * 0.3, y - trunkH + 7, x + lean * 0.15, y + 2, trunkHi, 1));
  if (pick(v, 11, 2) === 0) shapes.push(line(x - 1, y - 3, x - 4 * flip + lean, y - 8, trunk, 1));
  shapes.push(ell(x - cw / 2 - 2 * flip + lean, y - 15 * scale, cw * 0.62, ch, canopy.dark, INK));
  shapes.push(ell(x - cw / 2 + 4 * flip + lean, y - 17 * scale, cw * 0.7, ch + 1, canopy.dark, INK));
  shapes.push(ell(x - cw / 2 + 1 + lean, y - 18 * scale, cw - 4, Math.max(4, ch - 2), canopy.mid));
  shapes.push(ell(x - 2 + lean + flip, y - 16 * scale, slim ? 5 : 5 + pick(v, 12, 4), 4, canopy.hi));
}

function pushStump(shapes: ShapeSpec[], x: number, y: number, v: number, p: Palette): void {
  shapes.push(ell(x - 5, y + 2, 10, 4, "rgba(12,10,8,0.35)"));
  shapes.push(ell(x - 3, y - 2, 6, 7, "#3c2a1c", INK));
  shapes.push(ell(x - 2, y - 3, 4, 3, "#6a4c32"));
  if (pick(v, 1, 2) === 0) shapes.push(line(x + 2, y - 1, x + 6, y - 5, "#3c2a1c", 1));
  shapes.push(ell(x + 5, y + 3, 5, 3, p.dark));
}

function pushRocks(shapes: ShapeSpec[], cx: number, cy: number, v: number, p: Palette): void {
  const jx = signed(v, 1, 3);
  const jy = signed(v, 2, 2);
  shapes.push(ell(cx - 8 + pick(v, 3, 5), cy + 2, 10 + pick(v, 4, 5), 5 + pick(v, 5, 3), "rgba(12,10,8,0.35)"));
  shapes.push(poly([
    cx - 8 + jx, cy + 3,
    cx - 2, cy - 3 - pick(v, 6, 3),
    cx + 5 + jx, cy + 1,
    cx + 3, cy + 5 + jy,
    cx - 6, cy + 6,
  ], p.secondary, INK, 1));
  shapes.push(poly([cx - 2, cy - 3 - pick(v, 6, 3), cx + 5 + jx, cy + 1, cx + 1, cy + 2], p.light));
  shapes.push(ell(cx + 6 + signed(v, 7, 3), cy + 3, 6 + pick(v, 8, 4), 3 + pick(v, 9, 2), p.dark, INK));
  shapes.push(ell(cx + 7, cy + 2, 3 + pick(v, 10, 3), 2, p.light));
  if (pick(v, 11, 3) === 0) shapes.push(ell(cx - 2, cy + 5, 4 + pick(v, 12, 3), 3, p.dark));
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
