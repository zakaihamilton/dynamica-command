import { BUILDING_STATS } from "../catalog";
import type {
  BuildingKind,
  BuildingSpriteOptions,
  Facing,
  Palette,
  SpriteSpec,
  UnitKind,
  UnitSpriteOptions,
} from "../types";

const TW = 64;
const TH = 32;
const INK = "#11130f";
const STEEL = "#6a7168";
const STEEL_LIGHT = "#8b9288";
const STEEL_DARK = "#2c322e";
const RUST = "#7a4a32";
const RUST_LIGHT = "#a86a44";
const GLASS = "#4e6a62";
const GLASS_LIT = "#d4f0a0";
const SAND = "#8a7a58";
const BRASS = "#c3a65d";
const GOLD = "#d3b846";
const SKINS = ["#b58d68", "#c68642", "#e8c39e", "#8d5524", "#d4a574"];

class Svg {
  private defs: string[] = [];
  private body: string[] = [];
  private n = 0;

  grad(x1: number, y1: number, x2: number, y2: number, stops: Array<[number, string]>): string {
    const id = `g${this.n++}`;
    this.defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}">${
        stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")
      }</linearGradient>`,
    );
    return `url(#${id})`;
  }

  radial(cx: number, cy: number, r: number, stops: Array<[number, string]>): string {
    const id = `g${this.n++}`;
    this.defs.push(
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fx="${fmt(cx)}" fy="${fmt(cy)}">${
        stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")
      }</radialGradient>`,
    );
    return `url(#${id})`;
  }

  path(d: string, fill: string, stroke = INK, sw = 1, extra = ""): void {
    this.body.push(
      `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${extra}/>`,
    );
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, fill: string, stroke?: string, sw = 1, extra = ""): void {
    this.body.push(
      `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" fill="${fill}"${
        stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ""
      }${extra}/>`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke: string, sw = 2): void {
    this.body.push(
      `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`,
    );
  }

  group(opacity: number, fn: () => void): void {
    this.body.push(`<g opacity="${opacity}">`);
    fn();
    this.body.push("</g>");
  }

  toString(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${
      this.defs.length ? `<defs>${this.defs.join("")}</defs>` : ""
    }${this.body.join("")}</svg>`;
  }
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function d(pts: Array<[number, number]>): string {
  return `${pts.map(([x, y], i) => `${i ? "L" : "M"}${fmt(x)} ${fmt(y)}`).join("")}Z`;
}

function curve(pts: Array<[number, number]>): string {
  if (pts.length < 3) return d(pts);
  const [a, b] = pts;
  let s = `M${fmt(a![0])} ${fmt(a![1])} Q${fmt(b![0])} ${fmt(b![1])} `;
  for (let i = 2; i < pts.length; i++) {
    const p = pts[i]!;
    s += `${fmt(p[0])} ${fmt(p[1])}${i < pts.length - 1 ? " T" : ""}`;
  }
  return `${s}Z`;
}

function facingVector(facing: Facing): { x: number; y: number } {
  const angle = (facing / 8) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) * 0.52 };
}

function veh(cx: number, cy: number, lx: number, ly: number, lz: number, facing: Facing): [number, number] {
  const a = (facing / 8) * Math.PI * 2;
  const x = lx * Math.cos(a) - ly * Math.sin(a);
  const y = lx * Math.sin(a) + ly * Math.cos(a);
  return [cx + x, cy + y * 0.52 - lz];
}

function hull(cx: number, cy: number, facing: Facing, length: number, width: number, lift: number, z = 0): Array<[number, number]> {
  const hl = length / 2;
  const hw = width / 2;
  return [
    veh(cx, cy, -hl, -hw, z + lift, facing),
    veh(cx, cy, hl, -hw * 0.7, z + lift, facing),
    veh(cx, cy, hl + 2, 0, z, facing),
    veh(cx, cy, hl, hw * 0.7, z, facing),
    veh(cx, cy, -hl, hw, z, facing),
    veh(cx, cy, -hl - 1, 0, z + lift * 0.4, facing),
  ];
}

export function unitSprite(kind: UnitKind, palette: Palette, options: UnitSpriteOptions = {}): SpriteSpec {
  const infantry = kind === "infantry" || kind === "antiArmor";
  const w = infantry ? 50 : 56;
  const h = infantry ? 46 : 48;
  const facing = options.facing ?? 0;
  const frame = options.animationFrame ?? 0;
  const variant = options.variant ?? 0;
  const dmg = options.damageStage ?? 0;
  const svg = new Svg();
  const cx = w / 2;
  const cy = infantry ? 22 : 23;
  svg.ellipse(cx, h - 8, 16, 4.5, "rgba(0,0,0,0.42)");
  if (kind === "harvester") paintHarvester(svg, cx, cy, facing, frame, palette);
  else if (kind === "tank") paintTank(svg, cx, cy, facing, frame, palette);
  else paintInfantry(svg, kind, cx, cy, facing, frame, variant, palette);
  if (variant % 3 === 1) svg.ellipse(cx - 14, cy, 2, 1.2, GOLD);
  if (dmg > 0) svg.ellipse(cx - 4, cy, 8, 3.5, "rgba(30,24,18,0.7)");
  if (dmg > 1) {
    svg.path(`M${cx - 8} ${cy - 4} L${cx + 4} ${cy + 6}`, "none", "#1b1714", 2);
    svg.ellipse(cx + 6, cy - 8, 6, 7, "rgba(58,58,54,0.45)");
  }
  return {
    id: `unit:${kind}:${palette.primary}:${variant}:${facing}:${frame}:${dmg}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes: [],
    svg: svg.toString(w, h),
    anchorX: w / 2,
    anchorY: h - 8,
    pixelScale: 1,
  };
}

function paintTreads(svg: Svg, cx: number, cy: number, facing: Facing, frame: number, length: number, width: number): void {
  const tread = [0, 1, 0, -1][frame] ?? 0;
  const pad = hull(cx, cy + 5, facing, length + 6, width + 7, 1, -1);
  svg.path(d(pad), STEEL_DARK, INK, 1);
  const inner = hull(cx, cy + 5, facing, length + 2, width + 4, 0.5, 0);
  svg.path(d(inner), "#1e221f", INK, 1);
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) / 3.2;
    const p = veh(cx, cy + 5, t * length * 0.42, 0, ((i + tread) & 1) * 0.8, facing);
    svg.ellipse(p[0], p[1], 3.2, 1.7, i % 2 ? "#4a524c" : "#2a302c", INK, 0.8);
  }
}

function paintHarvester(svg: Svg, cx: number, cy: number, facing: Facing, frame: number, pal: Palette): void {
  const dir = facingVector(facing);
  paintTreads(svg, cx, cy, facing, frame, 34, 15);
  const body = hull(cx, cy + 1, facing, 30, 16, 4, 3);
  const metal = svg.grad(cx - 12, cy - 8, cx + 10, cy + 10, [[0, STEEL_LIGHT], [0.45, STEEL], [1, STEEL_DARK]]);
  svg.path(curve(body), metal, INK, 1.2);
  const hopper = hull(cx - dir.x * 5, cy - 3 - dir.y * 3, facing, 16, 12, 6, 8);
  svg.path(d(hopper), svg.grad(cx - 8, cy - 12, cx + 4, cy + 2, [[0, RUST_LIGHT], [1, RUST]]), INK, 1);
  svg.ellipse(cx - dir.x * 4, cy - 4, 5, 3, pal.primary, INK, 1);
  const cab = hull(cx + dir.x * 8, cy - 5 + dir.y * 6, facing, 12, 11, 7, 9);
  svg.path(d(cab), STEEL_DARK, INK, 1);
  svg.path(d(hull(cx + dir.x * 8, cy - 6 + dir.y * 6, facing, 9, 8, 5, 11)), STEEL_LIGHT, INK, 1);
  svg.ellipse(cx + dir.x * 8, cy - 6 + dir.y * 5, 4, 2.4, "#7aa8a0", INK, 0.8);
  svg.ellipse(cx + dir.x * 8, cy - 6 + dir.y * 5, 2.2, 1.3, pal.light);
  const scoop = 7 + ([0, 2, 4, 2][frame] ?? 0);
  const sx = cx + dir.x * 16;
  const sy = cy + dir.y * 14 + 2;
  svg.path(
    d([
      [sx - dir.y * 7, sy + dir.x * 4],
      [sx + dir.x * scoop, sy + dir.y * scoop],
      [sx + dir.y * 7, sy - dir.x * 4],
      [sx + dir.x * 2, sy + dir.y * 2],
    ]),
    "#474b46",
    INK,
    1,
  );
  svg.ellipse(sx + dir.x * scoop, sy + dir.y * scoop, 3.4, 2.4, STEEL_DARK, INK, 1);
  svg.ellipse(cx, cy - 10, 3.2, 2.6, RUST, INK, 1);
  svg.ellipse(cx, cy - 11, 1.8, 1.3, STEEL_LIGHT);
}

function paintTank(svg: Svg, cx: number, cy: number, facing: Facing, frame: number, pal: Palette): void {
  const dir = facingVector(facing);
  paintTreads(svg, cx, cy, facing, frame, 32, 14);
  const hullFill = svg.grad(cx - 14, cy - 10, cx + 12, cy + 8, [[0, STEEL_LIGHT], [0.4, pal.primary], [1, STEEL_DARK]]);
  svg.path(curve(hull(cx, cy, facing, 28, 15, 5, 3)), hullFill, INK, 1.2);
  svg.path(d(hull(cx, cy - 1, facing, 18, 8, 2, 5)), pal.primary, INK, 0.8);
  const tx = cx + dir.x;
  const ty = cy - 7;
  svg.ellipse(tx, ty, 11, 7, STEEL_DARK, INK, 1.1);
  svg.ellipse(tx, ty - 1, 8.5, 5.2, STEEL_LIGHT, INK, 0.9);
  svg.ellipse(tx, ty, 5.5, 3.4, pal.primary, INK, 0.8);
  const bx = tx;
  const by = ty + 2;
  svg.line(bx, by, bx + dir.x * 22, by + dir.y * 22, STEEL_DARK, 5);
  svg.line(bx, by - 1, bx + dir.x * 20, by - 1 + dir.y * 20, STEEL_LIGHT, 1.6);
  svg.ellipse(bx + dir.x * 10, by + dir.y * 10, 2.4, 1.8, STEEL, INK, 0.8);
  svg.ellipse(bx + dir.x * 21, by + dir.y * 21, 2.8, 2, STEEL, INK, 0.8);
  svg.ellipse(tx + 3, ty - 1, 2.2, 1.4, pal.light);
  svg.ellipse(tx - 1, ty - 5, 3.4, 2.4, STEEL_DARK, INK, 0.8);
}

function paintInfantry(
  svg: Svg,
  kind: UnitKind,
  cx: number,
  cy: number,
  facing: Facing,
  frame: number,
  variant: number,
  pal: Palette,
): void {
  const dir = facingVector(facing);
  const heavy = kind === "antiArmor";
  const left = [2, 0, -2, 0][frame] ?? 0;
  const right = [-2, 0, 2, 0][frame] ?? 0;
  const bob = frame % 2 === 0 ? 0 : 1;
  const lean = dir.x * 2;
  const y = cy + bob;
  const skin = SKINS[variant % SKINS.length]!;
  const gx = cx + lean + 1;
  const gy = y + 4;
  const gun = () => {
    if (heavy) {
      svg.line(gx, gy, gx + dir.x * 17, gy + dir.y * 17, "#343a34", 5);
      svg.line(gx, gy, gx + dir.x * 15, gy + dir.y * 15, STEEL, 2.4);
      svg.ellipse(gx + dir.x * 16, gy + dir.y * 16, 2.6, 2, RUST, INK, 0.8);
      svg.ellipse(gx - 3 - dir.x * 3, gy - 2, 4, 3, STEEL_DARK, INK, 0.8);
    } else {
      svg.path(
        `M${fmt(gx)} ${fmt(gy)} L${fmt(gx + dir.x * 15)} ${fmt(gy + dir.y * 15)}`,
        "none",
        INK,
        2.4,
      );
      svg.line(gx, gy - 1, gx + dir.x * 13, gy - 1 + dir.y * 13, pal.light, 1);
      svg.ellipse(gx - 1, gy - 1, 2.8, 2, STEEL_DARK, INK, 0.8);
    }
  };
  if (dir.y < -0.05) gun();
  svg.path(`M${fmt(cx - 3 + lean)} ${fmt(y + 12)} Q${fmt(cx - 5 + left)} ${fmt(y + 16)} ${fmt(cx - 6 + left)} ${fmt(y + 20)}`, "none", "#2c322e", 3.4);
  svg.path(`M${fmt(cx + 2 + lean)} ${fmt(y + 12)} Q${fmt(cx + 4 + right)} ${fmt(y + 16)} ${fmt(cx + 5 + right)} ${fmt(y + 20)}`, "none", "#2c322e", 3.4);
  svg.ellipse(cx - 3 + left, y + 19, 3.4, 2, STEEL_DARK, INK, 0.8);
  svg.ellipse(cx + 3 + right, y + 19, 3.4, 2, STEEL_DARK, INK, 0.8);
  const bw = heavy ? 8 : 6.5;
  svg.path(
    `M${fmt(cx - bw + lean)} ${fmt(y + 12)} Q${fmt(cx + lean)} ${fmt(y - 4)} ${fmt(cx + bw + lean)} ${fmt(y + 12)} Q${fmt(cx + lean)} ${fmt(y + 16)} ${fmt(cx - bw + lean)} ${fmt(y + 12)}Z`,
    svg.grad(cx - 8, y - 4, cx + 6, y + 14, [[0, STEEL_LIGHT], [0.35, pal.primary], [1, heavy ? "#3a403c" : STEEL]]),
    INK,
    1,
  );
  svg.ellipse(cx - 2 + lean, y + 4, 3, 5, pal.primary);
  if (heavy) svg.ellipse(cx - bw - 1 + lean, y + 6, 3.4, 5, RUST, INK, 0.8);
  svg.ellipse(cx + lean, y - 7, 5.4, 6.2, skin, INK, 1);
  svg.path(
    `M${fmt(cx - 6 + lean)} ${fmt(y - 8)} Q${fmt(cx + lean)} ${fmt(y - 16)} ${fmt(cx + 6 + lean)} ${fmt(y - 8)} Q${fmt(cx + lean)} ${fmt(y - 4)} ${fmt(cx - 6 + lean)} ${fmt(y - 8)}Z`,
    heavy ? "#3a403c" : STEEL_DARK,
    INK,
    1,
  );
  svg.ellipse(cx + lean, y - 8, 4.2, 1.8, "#1a1e1b");
  svg.ellipse(cx - 1 + lean, y - 8, 1.8, 1.2, pal.primary);
  if (variant % 4 === 2) svg.line(cx + 5 + lean, y - 10, cx + 7 + lean, y - 16, STEEL, 1.6);
  if (dir.y >= -0.05) gun();
}

function isoBox(fw: number, fh: number, rise: number): {
  w: number;
  h: number;
  gh: number;
  n: [number, number];
  e: [number, number];
  s: [number, number];
  west: [number, number];
  ng: [number, number];
  eg: [number, number];
  sg: [number, number];
  wg: [number, number];
  mx: number;
  my: number;
} {
  const gw = (fw + fh) * (TW / 2);
  const gh = (fw + fh) * (TH / 2);
  const pad = 4;
  const extra = 10;
  const w = gw + pad * 2;
  const h = rise + gh + pad * 2 + extra;
  const n: [number, number] = [w / 2, pad + extra];
  const e: [number, number] = [w - pad, pad + extra + gh / 2];
  const s: [number, number] = [w / 2, pad + extra + gh];
  const west: [number, number] = [pad, pad + extra + gh / 2];
  const ng: [number, number] = [n[0], n[1] + rise];
  const eg: [number, number] = [e[0], e[1] + rise];
  const sg: [number, number] = [s[0], s[1] + rise];
  const wg: [number, number] = [west[0], west[1] + rise];
  return {
    w,
    h,
    gh,
    n,
    e,
    s,
    west,
    ng,
    eg,
    sg,
    wg,
    mx: (n[0] + s[0]) / 2,
    my: (n[1] + s[1]) / 2,
  };
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

export function buildingSprite(kind: BuildingKind, palette: Palette, options: BuildingSpriteOptions = {}): SpriteSpec {
  const fp = BUILDING_STATS[kind].footprint;
  const rise = buildingRise(kind, fp.w);
  const box = isoBox(fp.w, fp.h, rise);
  const { w, h, gh, n, e, s, west, ng, eg, sg, wg, mx, my } = box;
  const construction = options.constructionStage ?? 3;
  const dmg = options.damageStage ?? 0;
  const variant = options.variant ?? 0;
  const facing = options.facing ?? 0;
  const lit = construction >= 3 && dmg < 2;
  const svg = new Svg();
  const slab = svg.grad(wg[0], wg[1], eg[0], eg[1], [[0, "#5a6058"], [1, "#2a2e2a"]]);
  svg.ellipse((wg[0] + eg[0]) / 2, sg[1] + 2, (eg[0] - wg[0]) * 0.42, 6, "rgba(8,10,8,0.4)");
  svg.path(d([
    [wg[0] - 3, wg[1] + 2],
    [sg[0], sg[1] + 5],
    [eg[0] + 3, eg[1] + 2],
    [ng[0], ng[1] + 2],
  ]), slab, INK, 1);
  svg.path(d([ng, eg, sg, wg]), "#242824", INK, 1);

  if (construction >= 1) {
    const left = svg.grad(west[0], west[1], s[0], s[1] + rise, [[0, "#8a9286"], [1, "#4a5248"]]);
    const right = svg.grad(e[0], e[1], s[0], s[1] + rise, [[0, "#5a6058"], [1, "#2c322e"]]);
    svg.path(d([west, s, sg, wg]), left, INK, 1.1);
    svg.path(d([e, s, sg, eg]), right, INK, 1.1);
    svg.path(d([
      [west[0], west[1] + rise * 0.55],
      [s[0], s[1] + rise * 0.55],
      [s[0], s[1] + rise * 0.55 + 4],
      [west[0], west[1] + rise * 0.55 + 4],
    ]), palette.primary, INK, 1);
    if (kind !== "turret") {
      paintWindow(svg, mx - 24, my + rise * 0.28, lit, false);
      paintWindow(svg, mx - 16, my + rise * 0.3, lit, true);
      paintWindow(svg, mx + 16, my + rise * 0.3, lit, false);
    }
  }

  if (construction >= 2) {
    const peak = Math.max(8, rise * 0.32);
    const ridgeN: [number, number] = [n[0], n[1] - peak];
    const ridgeS: [number, number] = [s[0], s[1] - peak * 0.35];
    svg.path(d([west, n, ridgeN, ridgeS]), svg.grad(west[0], west[1], ridgeN[0], ridgeN[1], [[0, "#c4c6ba"], [1, "#7a7e74"]]), INK, 1.1);
    svg.path(d([e, s, ridgeS, ridgeN]), svg.grad(e[0], e[1], ridgeS[0], ridgeS[1], [[0, "#6a6e66"], [1, "#3a3e38"]]), INK, 1.1);
    svg.line(ridgeN[0], ridgeN[1], ridgeS[0], ridgeS[1], "#9aa090", 1.2);
    paintBuildingKit(svg, kind, mx, my, rise, palette, facing, lit, construction >= 3);
  }

  if (construction < 3) {
    const top = Math.max(6, h - 20 - construction * 12);
    svg.line(8, top, w - 8, top, "#b0814d", 2);
    for (let x = 10; x < w - 8; x += 16) {
      svg.line(x, top, x, h - 10, "#8b623a", 1.6);
      svg.line(x + 6, top, x, h - 16, "#b0814d", 1);
    }
    svg.line(mx - 10, my - 4, mx - 10, my + rise * 0.5, RUST, 3);
    svg.line(mx - 10, my - 4, mx + 16, my + 2, RUST, 2.4);
    svg.ellipse(mx + 16, my, 3, 2, STEEL_DARK, INK, 0.8);
  }
  if (construction === 0) {
    svg.line(mx - 16, my + rise * 0.2, mx - 16, my + rise, STEEL_DARK, 2);
    svg.line(mx + 12, my + rise * 0.15, mx + 12, my + rise, STEEL_DARK, 2);
  }

  if (dmg > 0) {
    svg.ellipse(mx - 10, my + 4, 9, 4, "rgba(34,24,19,0.72)");
    svg.path(`M${mx + 2} ${my - 2} L${mx + 13} ${my + 8}`, "none", "#211b18", 2);
  }
  if (dmg > 1) {
    svg.ellipse(mx + 10, 8 + (variant % 4), 8, 9, "rgba(26,27,25,0.55)");
    svg.path(d([[mx - 8, h - 14], [mx, h - 22], [mx + 10, h - 12], [mx + 2, h - 8]]), "#3a322c", INK, 1);
  }

  return {
    id: `bld:${kind}:${palette.primary}:${variant}:${facing}:${dmg}:${construction}`,
    kind: "building",
    w,
    h,
    palette,
    shapes: [],
    svg: svg.toString(w, h),
    anchorX: w / 2,
    anchorY: h - 2 - gh / 2,
    pixelScale: 1,
  };
}

function paintWindow(svg: Svg, x: number, y: number, lit: boolean, wide: boolean): void {
  const w = wide ? 7 : 5;
  const h = wide ? 6 : 7;
  svg.path(`M${x} ${y} h${w} v${h} h${-w}Z`, INK, INK, 0.6);
  svg.path(`M${x + 1} ${y + 1} h${w - 2} v${h - 2} h${2 - w}Z`, lit ? GLASS_LIT : GLASS);
  if (lit) svg.ellipse(x + 2, y + 2, 1.2, 1, "#eef6c4");
}

function silo(svg: Svg, x: number, y: number, rw: number, h: number, body: string, cap: string, core?: string): void {
  svg.ellipse(x, y + h - 4, rw, rw * 0.42, STEEL_DARK, INK, 1);
  svg.path(
    `M${fmt(x - rw)} ${fmt(y + 6)} Q${fmt(x - rw)} ${fmt(y + h - 4)} ${fmt(x)} ${fmt(y + h - 2)} Q${fmt(x + rw)} ${fmt(y + h - 4)} ${fmt(x + rw)} ${fmt(y + 6)} Q${fmt(x)} ${fmt(y)} ${fmt(x - rw)} ${fmt(y + 6)}Z`,
    body,
    INK,
    1.1,
  );
  if (core) svg.ellipse(x, y + h * 0.45, rw * 0.35, h * 0.18, core);
  svg.ellipse(x, y + 4, rw * 0.95, rw * 0.4, cap, INK, 1);
  svg.ellipse(x - rw * 0.25, y + 3, rw * 0.35, rw * 0.16, STEEL_LIGHT);
}

function paintBuildingKit(
  svg: Svg,
  kind: BuildingKind,
  mx: number,
  my: number,
  rise: number,
  pal: Palette,
  facing: Facing,
  lit: boolean,
  complete: boolean,
): void {
  const team = pal.primary;
  if (kind === "constructionYard") {
    svg.path(d([[mx - 28, my + 8], [mx + 4, my - 12], [mx + 22, my + 2], [mx - 10, my + 18]]), STEEL_DARK, INK, 1);
    svg.path(d([[mx - 20, my + 4], [mx + 2, my - 8], [mx + 14, my + 2], [mx - 8, my + 12]]), STEEL, INK, 1);
    svg.ellipse(mx + 1, my + 5, 9, 5, team, INK, 1);
    if (complete) {
      svg.ellipse(mx, my + 5, 4, 2.4, lit ? GLASS_LIT : GLASS);
      svg.ellipse(mx + 8, my + 6, 3, 2, lit ? GLASS_LIT : GLASS);
    }
    svg.path(`M${mx - 8} ${my + 8} Q${mx - 10} ${my - 18} ${mx - 6} ${my - 22} Q${mx - 2} ${my - 16} ${mx - 4} ${my + 6}Z`, RUST, INK, 1);
    svg.line(mx - 6, my - 20, mx + 24, my - 14, RUST, 3.4);
    svg.line(mx + 22, my - 14, mx + 16, my + 4, BRASS, 1.8);
    svg.ellipse(mx + 22, my - 16, 4.5, 3.2, STEEL_LIGHT, INK, 1);
    svg.ellipse(mx + 14, my - 4, 7, 4.5, STEEL_DARK, INK, 1);
    if (complete) svg.ellipse(mx + 14, my - 4, 3.2, 2, lit ? GLASS_LIT : GLASS);
    svg.path(d([[mx + 18, my + 4], [mx + 28, my + 2], [mx + 28, my + 12], [mx + 18, my + 10]]), team, INK, 1);
  } else if (kind === "power") {
    silo(svg, mx - 14, my - 16, 10, 32, STEEL, STEEL_DARK, complete ? team : undefined);
    silo(svg, mx + 12, my - 18, 10, 36, STEEL_DARK, team, complete ? (lit ? GLASS_LIT : pal.light) : undefined);
    svg.ellipse(mx, my + 12, 12, 6, STEEL, INK, 1);
    svg.line(mx - 10, my - 4, mx + 8, my - 8, "#c7d8cf", 2);
    if (complete) {
      svg.ellipse(mx - 14, my - 6, 4, 5, lit ? "#d8f0a8" : team);
      svg.ellipse(mx + 12, my - 8, 5, 6, svg.radial(mx + 12, my - 8, 8, [[0, pal.light], [1, "rgba(180,200,120,0.05)"]]));
    }
  } else if (kind === "refinery") {
    silo(svg, mx - 22, my - 12, 9, 34, RUST, RUST_LIGHT);
    silo(svg, mx - 4, my - 16, 9, 38, STEEL_DARK, STEEL, complete ? RUST_LIGHT : undefined);
    svg.line(mx - 18, my - 8, mx + 18, my - 12, STEEL_LIGHT, 3);
    svg.line(mx - 12, my - 2, mx + 20, my + 2, STEEL, 2);
    svg.ellipse(mx + 18, my + 8, 13, 7, "#444943", INK, 1);
    svg.ellipse(mx + 18, my + 8, 9, 4.5, complete && lit ? "#1e2a22" : "#151814");
    svg.ellipse(mx + 16, my + 4, 7, 2.6, team);
    if (complete) for (let i = 0; i < 4; i++) svg.ellipse(mx - 28 + i * 5, my + 16, 2, 1.5, STEEL);
  } else if (kind === "barracks") {
    svg.path(d([[mx - 26, my + 6], [mx, my - 16], [mx + 26, my + 6], [mx, my + 18]]), "#4a5248", INK, 1.1);
    svg.path(d([[mx - 16, my + 4], [mx, my - 8], [mx + 16, my + 4], [mx, my + 12]]), "#5a6258", INK, 1);
    svg.line(mx, my - 16, mx, my + 18, STEEL_DARK, 2);
    svg.ellipse(mx, my + 8, 8, 8, STEEL_DARK, INK, 1);
    svg.ellipse(mx, my + 9, 5, 6, INK);
    if (complete) svg.ellipse(mx - 1, my + 10, 2.4, 4.5, team);
    for (let i = 0; i < 5; i++) svg.ellipse(mx - 24 + i * 12, my + 16, 5, 2.4, SAND, INK, 0.8);
    svg.line(mx + 16, my - 4, mx + 16, my - 18, STEEL_DARK, 2);
    if (complete) {
      svg.path(d([[mx + 16, my - 18], [mx + 26, my - 16], [mx + 26, my - 10], [mx + 16, my - 12]]), team, INK, 1);
      svg.ellipse(mx - 18, my - 2, 4, 3, lit ? GLASS_LIT : GLASS, INK, 0.8);
      svg.ellipse(mx + 8, my - 2, 4, 3, lit ? GLASS_LIT : GLASS, INK, 0.8);
    }
  } else if (kind === "factory") {
    svg.path(d([[mx - 36, my + 6], [mx + 8, my - 16], [mx + 4, my + 16], [mx - 30, my + 22]]), "#3e4440", INK, 1.1);
    svg.ellipse(mx - 10, my + 6, 16, 10, INK, STEEL_DARK, 1.2);
    svg.ellipse(mx - 10, my + 7, 12, 7, complete && lit ? "#1a221c" : "#121614");
    if (complete) {
      svg.ellipse(mx - 16, my + 8, 3, 4.5, STEEL);
      svg.ellipse(mx - 6, my + 8, 3, 4.5, STEEL);
    }
    svg.ellipse(mx - 10, my - 1, 14, 3, team);
    silo(svg, mx + 16, my - 16, 5, 26, STEEL_DARK, STEEL);
    silo(svg, mx + 28, my - 14, 5, 24, RUST, RUST_LIGHT);
    svg.line(mx + 16, my - 20, mx + 30, my - 8, STEEL, 3);
    svg.ellipse(mx + 14, my - 22, 3, 2.4, BRASS, INK, 0.8);
  } else if (kind === "turret") {
    const dir = facingVector(facing);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      svg.ellipse(mx + Math.cos(a) * 14, my + Math.sin(a) * 7 + 6, 5, 2.4, SAND, INK, 0.8);
    }
    svg.ellipse(mx, my + 2, 16, 9, STEEL_DARK, INK, 1.1);
    svg.ellipse(mx, my + 1, 12, 7, STEEL, INK, 1);
    svg.ellipse(mx, my + 1, 8, 5, team, INK, 0.9);
    svg.line(mx, my + 2, mx + dir.x * 26, my + 2 + dir.y * 26, STEEL_DARK, 6);
    svg.line(mx, my + 1, mx + dir.x * 24, my + 1 + dir.y * 24, STEEL_LIGHT, 1.8);
    svg.ellipse(mx + dir.x * 24, my + 1 + dir.y * 24, 2.6, 2, STEEL, INK, 0.8);
    if (complete) svg.ellipse(mx + 8, my - 6, 2.6, 2, lit ? GLASS_LIT : STEEL_DARK, INK, 0.8);
  } else {
    svg.ellipse(mx, my + 4, 16, 8, STEEL_DARK, INK, 1);
    svg.line(mx, my + 6, mx, my - 24, team, 3.4);
    svg.ellipse(mx, my - 24, 14, 8, GOLD, INK, 1.1);
    svg.ellipse(mx, my - 24, 10, 5.5, STEEL_DARK, INK, 1);
    if (complete) {
      svg.ellipse(mx, my - 24, 6, 3, lit ? "#f3dc79" : "#8a7428");
      svg.ellipse(mx, my - 24, 10, 8, svg.radial(mx, my - 24, 12, [[0, "#f3dc79"], [1, "rgba(243,220,121,0.02)"]]));
    }
    svg.ellipse(mx - 10, my + 8, 5, 3, team, INK, 0.8);
  }
}

export function wreckSprite(kind: UnitKind, palette: Palette): SpriteSpec {
  const infantry = kind === "infantry" || kind === "antiArmor";
  const w = infantry ? 50 : 56;
  const h = infantry ? 36 : 38;
  const cx = w / 2;
  const cy = h - 16;
  const svg = new Svg();
  svg.ellipse(cx, h - 8, 15, 4, "rgba(12,10,8,0.55)");
  if (infantry) {
    svg.ellipse(cx, cy + 4, 9, 5, STEEL_DARK, INK, 1);
    svg.path(d([[cx - 10, cy + 6], [cx - 2, cy - 2], [cx + 8, cy + 4], [cx + 4, cy + 8]]), "#3a322c", INK, 1);
    svg.ellipse(cx, cy, 4, 3, "#6a4a32", INK, 0.8);
    svg.line(cx + 4, cy, cx + 14, cy + 4, STEEL, 2);
  } else {
    svg.path(d(hull(cx, cy + 4, 1, 26, 13, 1, 0)), "#2a2e2a", INK, 1);
    svg.path(d(hull(cx + 2, cy + 2, 7, 18, 9, 1, 1)), STEEL_DARK, INK, 1);
    svg.path(d([[cx - 8, cy], [cx + 4, cy - 6], [cx + 12, cy + 2], [cx + 2, cy + 6]]), "#3a322c", INK, 1);
    svg.ellipse(cx - 2, cy, 5, 2.6, RUST, INK, 0.8);
    if (kind === "harvester") svg.path(d([[cx + 8, cy], [cx + 18, cy + 6], [cx + 10, cy + 8]]), "#474b46", INK, 1);
    else svg.line(cx, cy, cx + 12, cy + 4, STEEL_DARK, 3);
  }
  svg.ellipse(cx + 2, cy - 6, 6, 5, "rgba(58,58,54,0.4)");
  return {
    id: `wreck:${kind}:${palette.primary}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes: [],
    svg: svg.toString(w, h),
    anchorX: w / 2,
    anchorY: h - 6,
    pixelScale: 1,
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
  const svg = new Svg();
  svg.ellipse(mx, h - 9, gw * 0.28, 5, "rgba(12,10,8,0.5)");
  svg.path(d([
    [mx - gw * 0.32, my + 6],
    [mx, my - 4],
    [mx + gw * 0.28, my + 8],
    [mx + 8, my + 14],
    [mx - 10, my + 12],
  ]), "#3a322c", INK, 1);
  svg.path(d([[mx - 14, my + 4], [mx - 2, my - 8], [mx + 10, my + 2]]), STEEL_DARK, INK, 1);
  svg.path(d([[mx + 4, my + 2], [mx + 18, my - 2], [mx + 22, my + 8], [mx + 8, my + 10]]), "#2c2824", INK, 1);
  if (kind === "turret") {
    svg.ellipse(mx, my + 2, 10, 5, STEEL_DARK, INK, 1);
    svg.line(mx, my + 2, mx + 14, my + 6, STEEL, 3);
  } else if (kind === "power") {
    svg.ellipse(mx - 8, my - 2, 5, 8, STEEL_DARK, INK, 1);
    svg.ellipse(mx + 8, my, 4, 6, "#2a2e2a", INK, 1);
  }
  svg.ellipse(mx + 4, my - 8, 8, 6, "rgba(58,60,56,0.35)");
  return {
    id: `rubble:${kind}:${palette.primary}`,
    kind: "building",
    w,
    h,
    palette,
    shapes: [],
    svg: svg.toString(w, h),
    anchorX: w / 2,
    anchorY: h - 2 - gh / 2,
    pixelScale: 1,
  };
}
