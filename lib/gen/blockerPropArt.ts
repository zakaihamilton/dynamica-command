import type { BiomeName, Palette, ShapeSpec } from "../types";
import { ell, line, poly } from "./shapePrimitives";
import { mixHex, ORE } from "./tilePalette";
import type { BlockerPropKind } from "./terrainDecorKinds";

export type BlockerTone = {
  dark: string;
  mid: string;
  high: string;
  light: string;
  blocked: string;
  ore: string;
};

export type PropPrim =
  | {
      k: "ell";
      x: number;
      y: number;
      rx: number;
      ry: number;
      rot: number;
      fill: string;
      alpha?: number;
    }
  | {
      k: "poly";
      pts: number[];
      fill: string;
      alpha?: number;
    }
  | {
      k: "line";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      stroke: string;
      width: number;
      minWidth?: number;
      cap?: "butt" | "round" | "square";
      alpha?: number;
    }
  | {
      k: "curve";
      x0: number;
      y0: number;
      cx: number;
      cy: number;
      x1: number;
      y1: number;
      stroke: string;
      width: number;
      minWidth?: number;
      cap?: "butt" | "round" | "square";
      alpha?: number;
    };

const SHADOW = "rgba(6,10,12,0.38)";
const SNOW = "#ecf4f6";
const CURVE_SAMPLES = 6;

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("")}`;
}

export function hexRgb(c: { r: number; g: number; b: number }): string {
  return toHex(c.r, c.g, c.b);
}

function parseHex(value: string): [number, number, number] {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function liftGreen(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r, Math.min(255, g + amount), b);
}

export function blockerToneFromRgb(m: {
  dark: { r: number; g: number; b: number };
  mid: { r: number; g: number; b: number };
  high: { r: number; g: number; b: number };
  light: { r: number; g: number; b: number };
  blocked: { r: number; g: number; b: number };
  ore: { r: number; g: number; b: number };
}): BlockerTone {
  return {
    dark: hexRgb(m.dark),
    mid: hexRgb(m.mid),
    high: hexRgb(m.high),
    light: hexRgb(m.light),
    blocked: hexRgb(m.blocked),
    ore: hexRgb(m.ore),
  };
}

export function blockerToneFromPalette(p: Palette): BlockerTone {
  return {
    dark: p.dark,
    mid: p.primary,
    high: p.accent,
    light: p.light,
    blocked: mixHex(p.secondary, p.dark, 0.38),
    ore: mixHex(p.accent, ORE.stain, 0.4),
  };
}

function pe(
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number,
  fill: string,
  alpha?: number,
): PropPrim {
  return { k: "ell", x, y, rx, ry, rot, fill, alpha };
}

function pp(pts: number[], fill: string, alpha?: number): PropPrim {
  return { k: "poly", pts, fill, alpha };
}

function pl(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stroke: string,
  width: number,
  extra?: { minWidth?: number; cap?: "butt" | "round" | "square"; alpha?: number },
): PropPrim {
  return { k: "line", x0, y0, x1, y1, stroke, width, ...extra };
}

function pc(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  stroke: string,
  width: number,
  extra?: { minWidth?: number; cap?: "butt" | "round" | "square"; alpha?: number },
): PropPrim {
  return { k: "curve", x0, y0, cx, cy, x1, y1, stroke, width, ...extra };
}

function shadow(rx: number, ry: number, dy = 6): PropPrim {
  return pe(0, dy, rx, ry, 0, SHADOW);
}

function lushBiome(biome: BiomeName): boolean {
  return biome === "jungle wreckage" || biome === "salt marshes";
}

function boulderPrims(v: number, t: BlockerTone, lush: boolean, snowCap: boolean): PropPrim[] {
  const twist = ((v % 5) - 2) * 0.35;
  const body = lush ? liftGreen(t.blocked, 18) : t.blocked;
  const facet = mixHex(body, t.dark, 0.28);
  const cap = snowCap ? mixHex(t.light, SNOW, 0.55) : t.light;
  const out: PropPrim[] = [
    shadow(16.5, 5.2),
    pp([-15, 2.2, 14, 3.1, 10, 9.2, -12, 8.4], t.dark),
    pp([
      -13 + twist, 2,
      -6 + twist, -8,
      -1, -13,
      13 + twist * 0.4, -1.4,
      9, 5.4,
      -10, 5.6,
    ], body),
    pp([-6, 1, -1, -12, 6, -3, 4, 4], facet),
    pp([2, 2, 6, -3, 13 + twist * 0.4, -1.4, 9, 5.4], mixHex(body, t.dark, 0.45)),
    pl(-4, -4, 3, 3, mixHex(t.dark, body, 0.35), 0.85, { minWidth: 0.7 }),
  ];
  if (lush) {
    out.push(
      pe(-5, -2, 4.2, 2.1, -0.4, liftGreen(t.high, 12), 0.55),
      pe(4, 1.2, 3.2, 1.6, 0.2, liftGreen(t.high, 12), 0.55),
    );
  }
  out.push(pp([-1, -13, 13 + twist * 0.4, -1.4, 5, 0.6, -7, -6.4], cap, snowCap ? 0.86 : 0.5));
  return out;
}

function sandstonePrims(v: number, t: BlockerTone): PropPrim[] {
  const lean = ((v % 5) - 2) * 0.28;
  const base = mixHex(t.blocked, t.high, 0.22);
  const mid = mixHex(t.high, t.light, 0.28);
  const hi = mixHex(t.light, "#e8d2a8", 0.35);
  const bands = [
    { y: 4, h: 5.5, c: mixHex(base, t.dark, 0.2) },
    { y: -1, h: 5.2, c: base },
    { y: -6, h: 5.0, c: mid },
  ];
  const out: PropPrim[] = [
    shadow(15.5, 5),
    pp([-14, 3, 13, 3.4, 10, 8.6, -11, 8.2], t.dark),
  ];
  for (const band of bands) {
    out.push(pp([
      -12 + lean, band.y + 1.2,
      11 + lean * 0.4, band.y + 0.6,
      9, band.y - band.h + 1.4,
      -10 + lean * 0.2, band.y - band.h + 1.8,
    ], band.c));
  }
  out.push(
    pp([-8, -9.2, 1, -12.4, 9, -8.4, 6, -6.6, -5, -7.2], hi),
    pl(-9, -1.2, 8, -2.4, mixHex(t.dark, base, 0.4), 0.75, { minWidth: 0.65 }),
    pl(-8, 3.2, 7, 2.2, mixHex(t.dark, base, 0.4), 0.75, { minWidth: 0.65 }),
  );
  return out;
}

function treePrims(v: number, t: BlockerTone, biome: BiomeName): PropPrim[] {
  const lean = ((v % 5) - 2) * 0.55;
  const dark = mixHex(t.high, t.blocked, 0.28);
  const mid = liftGreen(t.high, 28);
  const hi = t.light;
  const wood = mixHex(t.dark, "#3e2a1c", 0.45);
  const lobes = [
    { x: -10, y: -16, rx: 14.5, ry: 9.2, rot: -0.08, c: dark },
    { x: 7, y: -20, rx: 12.2, ry: 8.2, rot: 0.14, c: mid },
    { x: -2, y: -23, rx: 10.5, ry: 7.2, rot: -0.12, c: mid },
    { x: 11, y: -15, rx: 8.4, ry: 5.6, rot: 0.22, c: dark },
    { x: -12, y: -12, rx: 7.6, ry: 5.0, rot: -0.18, c: dark },
    { x: 2, y: -26, rx: 6.4, ry: 4.2, rot: -0.05, c: hi },
  ];
  const out: PropPrim[] = [
    shadow(18.5, 5.6),
    pl(-2.4, 6.2, 2.2, 6.2, wood, 5.2, { minWidth: 3.2, cap: "round" }),
    pc(0, 6, lean * 0.35, -4, lean, -18, wood, 3.6, { minWidth: 2.4, cap: "round" }),
  ];
  for (let i = 0; i < lobes.length; i++) {
    const lobe = lobes[i]!;
    out.push(pe(lobe.x + lean * 0.35, lobe.y, lobe.rx, lobe.ry, lobe.rot, lobe.c, i === 5 ? 0.55 : undefined));
  }
  if (biome === "jungle wreckage" && v % 3 !== 1) {
    const vine = mixHex(dark, "#285a30", 0.4);
    out.push(
      pc(-4 + lean, -18, -8 + lean, -8, -7, 2, vine, 1.1, { minWidth: 0.85 }),
      pc(6 + lean, -20, 9, -10, 8, 1, vine, 1.1, { minWidth: 0.85 }),
    );
  }
  if (biome === "salt marshes") {
    out.push(pe(-6 + lean, -12, 4, 2.2, -0.3, mixHex(t.high, "#5a6e46", 0.35), 0.5));
  }
  return out;
}

function pinePrims(v: number, t: BlockerTone, snow: boolean): PropPrim[] {
  const lean = ((v % 3) - 1) * 0.3;
  const needle = mixHex(t.high, "#30603e", 0.35);
  const dark = mixHex(t.mid, needle, 0.4);
  const out: PropPrim[] = [
    shadow(14.5, 4.8),
    pl(0, 6.2, lean, -10, t.dark, 2.8, { minWidth: 1.8, cap: "round" }),
  ];
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const w = 17.5 - i * 2.7;
    const y = -2 - i * 6.2;
    out.push(pp(
      [-w + lean, y + 7.4, lean, y - 6.2, w + lean, y + 7.4],
      i >= tiers - 2 ? mixHex(needle, t.light, 0.16) : dark,
    ));
    if (snow && i >= 2) {
      out.push(pp(
        [-w * 0.35 + lean, y + 1.2, lean, y - 6.2, w * 0.35 + lean, y + 1.2],
        mixHex(t.light, SNOW, 0.5),
        0.55,
      ));
    }
  }
  return out;
}

function deadTreePrims(v: number, t: BlockerTone): PropPrim[] {
  const wood = mixHex(t.dark, t.blocked, 0.25);
  const lean = ((v % 5) - 2) * 0.3;
  return [
    shadow(11, 3.6),
    pc(0, 5.4, lean * 0.4, -4, lean, -16, wood, 2.5, { minWidth: 1.7, cap: "round" }),
    pl(lean * 0.3, -5, -7.2, -12, wood, 1.45, { minWidth: 1.05, cap: "round" }),
    pl(lean * 0.4, -8, 6.4, -14, wood, 1.45, { minWidth: 1.05, cap: "round" }),
    pl(lean * 0.5, -11, -3.2, -17, wood, 1.45, { minWidth: 1.05, cap: "round" }),
    pl(lean * 0.45, -7, 4.2, -9.5, wood, 1.45, { minWidth: 1.05, cap: "round" }),
  ];
}

function crystalPrims(v: number, t: BlockerTone): PropPrim[] {
  const gem = mixHex(t.ore, t.light, 0.42);
  const dark = mixHex(t.dark, t.ore, 0.38);
  const inner = mixHex(gem, "#e6fff8", 0.4);
  const shards = [
    { lean: -7, rise: 13, half: 4.0, gem: false },
    { lean: -1, rise: 16, half: 3.2, gem: true },
    { lean: 3, rise: 20, half: 3.5, gem: true },
    { lean: 9, rise: 12, half: 3.6, gem: false },
    { lean: 5, rise: 10, half: 2.6, gem: false },
  ];
  const out: PropPrim[] = [
    shadow(13, 4.2),
    pp([-11, 3.4, 12, 3.6, 8, 7.2, -8, 7], mixHex(t.blocked, t.dark, 0.2)),
  ];
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i]!;
    const twist = ((v >>> (i * 2)) % 5 - 2) * 0.4;
    out.push(pp([
      shard.lean - shard.half, 3.2,
      shard.lean + twist, -shard.rise,
      shard.lean + shard.half, 2.6,
    ], shard.gem ? gem : dark));
  }
  out.push(pp([1.2, -2, 2.4, -17, 5, -1.2], inner, 0.5));
  return out;
}

function wreckagePrims(v: number, t: BlockerTone): PropPrim[] {
  const rust = mixHex(t.ore, t.blocked, 0.28);
  const iron = mixHex(t.dark, t.blocked, 0.15);
  const seam = mixHex(t.light, rust, 0.4);
  const out: PropPrim[] = [
    shadow(15, 4.6),
    pp([-13, 3.2, 3, -7.2, 14, 1.2, 9, 7.4, -10, 7.2], iron),
    pp([-6.5, 1.2, 7.4, -4.4, 11, 2.2, -3.2, 5.2], rust),
    pp([-10, 2, -2, -3, 1.4, 1.6, -7, 5], mixHex(iron, t.light, 0.16)),
    pl(-8, 2, 6, -2 + (v % 3) * 0.4, seam, 1.15, { minWidth: 0.85, cap: "round" }),
    pl(8, 1, 13, -8, seam, 1.6, { minWidth: 1.1, cap: "round" }),
  ];
  const rivet = mixHex(seam, t.dark, 0.3);
  for (let i = 0; i < 4; i++) {
    out.push(pe(-6 + i * 3.2, 1.4 + (i % 2) * 0.7, 0.55, 0.4, 0, rivet));
  }
  return out;
}

function spirePrims(v: number, t: BlockerTone): PropPrim[] {
  const rock = mixHex(t.blocked, t.dark, 0.2);
  const glow = mixHex(t.ore, "#d25024", 0.4);
  const out: PropPrim[] = [
    shadow(11, 3.8),
    pe(0, 5.4, 9.5, 3.2, 0, mixHex(t.dark, glow, 0.25), 0.45),
    pp([-8, 5.2, -2.4, -17, 2.6, -9, 8.4, 5.2, -4.2, 7.2], rock),
    pp([-1.2, 2.4, -1.6, -15, 1.8, -6.4], glow, 0.58),
    pl(-0.4, 3, -1.2, -14, mixHex(glow, "#ff8c3c", 0.35), 0.85, { minWidth: 0.7 }),
  ];
  if (v % 2 === 0) {
    out.push(pp([-2.2, -10, -2.2, -17, 0.8, -11], t.light, 0.3));
  }
  return out;
}

function deadShrubPrims(v: number, t: BlockerTone): PropPrim[] {
  const wood = mixHex(t.dark, t.blocked, 0.2);
  const dust = mixHex(t.light, t.blocked, 0.35);
  const lean = ((v % 3) - 1) * 0.4;
  return [
    shadow(11.5, 3.6),
    pl(0, 5.2, lean, -9, wood, 1.8, { minWidth: 1.25, cap: "round" }),
    pl(-0.5, -2.4, -7.4, -8.4, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pl(0.6, -3.6, 7.2, -9.6, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pl(lean * 0.4, -6, 2.4, -13, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pl(lean * 0.3, -5, -3.4, -11, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pl(0.2, -4, 4.6, -6.4, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pe(-4.4, -7.4, 3.4, 1.7, -0.4, dust, 0.55),
    pe(4.6, -8.4, 3.0, 1.5, 0.3, dust, 0.55),
    pe(1.2, -11.2, 2.2, 1.15, 0.1, dust, 0.55),
  ];
}

export function blockerPropPrims(
  kind: BlockerPropKind,
  v: number,
  tone: BlockerTone,
  biome: BiomeName,
): PropPrim[] {
  const lush = lushBiome(biome);
  switch (kind) {
    case "tree":
      return treePrims(v, tone, biome);
    case "pine":
      return pinePrims(v, tone, biome === "tundra grid");
    case "deadTree":
      return deadTreePrims(v, tone);
    case "crystalOutcrop":
      return crystalPrims(v, tone);
    case "wreckage":
      return wreckagePrims(v, tone);
    case "spire":
      return spirePrims(v, tone);
    case "deadShrub":
      return deadShrubPrims(v, tone);
    case "sandstone":
      return sandstonePrims(v, tone);
    case "snowRock":
      return boulderPrims(v, tone, false, true);
    case "boulder":
      return boulderPrims(v, tone, lush, false);
  }
}

function quadPoint(
  t: number,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * x0 + 2 * u * t * cx + t * t * x1,
    u * u * y0 + 2 * u * t * cy + t * t * y1,
  ];
}

function strokeWidth(prim: Extract<PropPrim, { k: "line" | "curve" }>): number {
  return Math.max(prim.minWidth ?? prim.width, prim.width);
}

/** Map shared prop prims into tile-sprite ShapeSpecs. Curves become sampled polylines. */
export function appendPropArtShapes(
  shapes: ShapeSpec[],
  prims: PropPrim[],
  ox: number,
  oy: number,
): void {
  for (const prim of prims) {
    if (prim.k === "ell") {
      const shape = ell(ox + prim.x - prim.rx, oy + prim.y - prim.ry, prim.rx * 2, prim.ry * 2, prim.fill);
      shapes.push(prim.alpha !== undefined ? { ...shape, alpha: prim.alpha } : shape);
      continue;
    }
    if (prim.k === "poly") {
      const pts: number[] = [];
      for (let i = 0; i < prim.pts.length; i += 2) {
        pts.push(ox + prim.pts[i]!, oy + prim.pts[i + 1]!);
      }
      const shape = poly(pts, prim.fill);
      shapes.push(prim.alpha !== undefined ? { ...shape, alpha: prim.alpha } : shape);
      continue;
    }
    if (prim.k === "line") {
      const shape = line(ox + prim.x0, oy + prim.y0, ox + prim.x1, oy + prim.y1, prim.stroke, strokeWidth(prim));
      shapes.push(prim.alpha !== undefined ? { ...shape, alpha: prim.alpha } : shape);
      continue;
    }
    let [px, py] = quadPoint(0, prim.x0, prim.y0, prim.cx, prim.cy, prim.x1, prim.y1);
    for (let i = 1; i <= CURVE_SAMPLES; i++) {
      const [nx, ny] = quadPoint(i / CURVE_SAMPLES, prim.x0, prim.y0, prim.cx, prim.cy, prim.x1, prim.y1);
      const shape = line(ox + px, oy + py, ox + nx, oy + ny, prim.stroke, strokeWidth(prim));
      shapes.push(prim.alpha !== undefined ? { ...shape, alpha: prim.alpha } : shape);
      px = nx;
      py = ny;
    }
  }
}
