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

type Iso = { ox: number; oy: number; w: number; h: number; fw: number; fh: number };

function makeIso(fw: number, fh: number, sky: number): Iso {
  const pad = 10;
  const gw = (fw + fh) * (TW / 2);
  const gh = (fw + fh) * (TH / 2);
  return { ox: pad + fh * (TW / 2), oy: pad + sky, w: gw + pad * 2, h: sky + gh + pad * 2, fw, fh };
}

function pt(iso: Iso, lx: number, ly: number, z: number): [number, number] {
  return [iso.ox + (lx - ly) * (TW / 2), iso.oy + (lx + ly) * (TH / 2) - z];
}

function buildingSky(kind: BuildingKind): number {
  switch (kind) {
    case "turret": return 28;
    case "barracks": return 38;
    case "power": return 52;
    case "refinery": return 54;
    case "factory": return 46;
    case "constructionYard": return 48;
    case "objective": return 50;
    default: return 40;
  }
}

export function buildingSprite(kind: BuildingKind, palette: Palette, options: BuildingSpriteOptions = {}): SpriteSpec {
  const fp = BUILDING_STATS[kind].footprint;
  const iso = makeIso(fp.w, fp.h, buildingSky(kind));
  const construction = options.constructionStage ?? 3;
  const dmg = options.damageStage ?? 0;
  const variant = options.variant ?? 0;
  const lit = construction >= 3 && dmg < 2;
  const complete = construction >= 3;
  const svg = new Svg();
  const ground = pt(iso, fp.w / 2, fp.h / 2, 0);

  paintYard(svg, iso, kind);
  if (construction >= 1) paintBuildingMass(svg, iso, kind, palette, construction, lit, complete);
  if (construction < 3) paintScaffold(svg, iso, construction);
  if (dmg > 0) {
    svg.ellipse(ground[0] - 8, ground[1] - 2, 10, 4.5, "rgba(34,24,19,0.72)");
    svg.path(`M${fmt(ground[0] - 2)} ${fmt(ground[1] - 10)} Q${fmt(ground[0] + 6)} ${fmt(ground[1] - 2)} ${fmt(ground[0] + 12)} ${fmt(ground[1] + 4)}`, "none", "#211b18", 2);
  }
  if (dmg > 1) {
    svg.ellipse(ground[0] + 10, ground[1] - 18, 8, 10, "rgba(26,27,25,0.5)");
    svg.path(curve([
      [ground[0] - 10, ground[1] + 6],
      [ground[0], ground[1] - 4],
      [ground[0] + 14, ground[1] + 8],
      [ground[0] + 2, ground[1] + 10],
    ]), "#3a322c", INK, 1);
  }

  return {
    id: `bld:${kind}:${palette.primary}:${variant}:${dmg}:${construction}`,
    kind: "building",
    w: iso.w,
    h: iso.h,
    palette,
    shapes: [],
    svg: svg.toString(iso.w, iso.h),
    anchorX: ground[0],
    anchorY: ground[1],
    pixelScale: 1,
  };
}

function paintYard(svg: Svg, iso: Iso, kind: BuildingKind): void {
  const c = pt(iso, iso.fw / 2, iso.fh / 2, 0);
  svg.ellipse(c[0], c[1] + 4, 18 + iso.fw * 10, 7 + iso.fh * 2, "rgba(8,10,8,0.38)");
  const blob: Array<[number, number]> = kind === "turret"
    ? [
        pt(iso, 0.15, 0.45, 0),
        pt(iso, 0.5, 0.05, 0),
        pt(iso, 0.9, 0.4, 0),
        pt(iso, 0.55, 0.95, 0),
      ]
    : [
        pt(iso, -0.05, iso.fh * 0.42, 0),
        pt(iso, 0.22, -0.08, 0),
        pt(iso, iso.fw * 0.62, -0.06, 0),
        pt(iso, iso.fw + 0.08, iso.fh * 0.38, 0),
        pt(iso, iso.fw * 0.78, iso.fh + 0.1, 0),
        pt(iso, 0.28, iso.fh + 0.08, 0),
      ];
  const fill = svg.grad(blob[0]![0], blob[0]![1], blob[3]![0], blob[3]![1], [[0, "#5a6058"], [1, "#2a2e2a"]]);
  svg.path(curve(blob), fill, INK, 1);
}

function paintScaffold(svg: Svg, iso: Iso, construction: number): void {
  const a = pt(iso, 0.15, 0.2, 8 + construction * 6);
  const b = pt(iso, iso.fw - 0.1, 0.35, 10 + construction * 5);
  const c = pt(iso, 0.4, iso.fh - 0.15, 0);
  svg.line(a[0], a[1], c[0], c[1], "#8b623a", 1.6);
  svg.line(a[0], a[1], b[0], b[1], "#b0814d", 2);
  svg.line(b[0], b[1], b[0] + 6, b[1] + 14, RUST, 2.2);
  svg.ellipse(b[0] + 6, b[1] + 14, 2.4, 1.6, STEEL_DARK, INK, 0.8);
}

function coolingTower(
  svg: Svg,
  iso: Iso,
  lx: number,
  ly: number,
  z: number,
  rBase: number,
  rWaist: number,
  rTop: number,
  body: string,
  cap: string,
  withCap: boolean,
): void {
  const base = pt(iso, lx, ly, 0);
  const mid = pt(iso, lx, ly, z * 0.42);
  const top = pt(iso, lx, ly, z);
  svg.ellipse(base[0], base[1], rBase, rBase * 0.42, STEEL_DARK, INK, 1);
  svg.path(
    `M${fmt(base[0] - rBase)} ${fmt(base[1])} C${fmt(base[0] - rWaist)} ${fmt(mid[1])} ${fmt(top[0] - rTop)} ${fmt(top[1] + 10)} ${fmt(top[0] - rTop * 0.72)} ${fmt(top[1])} L${fmt(top[0] + rTop * 0.72)} ${fmt(top[1])} C${fmt(top[0] + rTop)} ${fmt(top[1] + 10)} ${fmt(base[0] + rWaist)} ${fmt(mid[1])} ${fmt(base[0] + rBase)} ${fmt(base[1])}Z`,
    body,
    INK,
    1.15,
  );
  if (withCap) {
    svg.ellipse(top[0], top[1], rTop * 0.9, rTop * 0.38, cap, INK, 1);
    svg.ellipse(top[0] - rTop * 0.2, top[1] - 1, rTop * 0.35, rTop * 0.14, STEEL_LIGHT);
  }
}

function aFrame(
  svg: Svg,
  iso: Iso,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  roofL: string,
  roofR: string,
  gable: string,
  withRoof: boolean,
): void {
  const ym = (y0 + y1) / 2;
  const ridge0 = pt(iso, x0, ym, z);
  const ridge1 = pt(iso, x1, ym, z);
  const l0 = pt(iso, x0, y0, 3);
  const l1 = pt(iso, x1, y0, 3);
  const r0 = pt(iso, x0, y1, 3);
  const r1 = pt(iso, x1, y1, 3);
  const gl = pt(iso, x0, y0, 0);
  const gr = pt(iso, x0, y1, 0);
  svg.path(d([gl, l0, r0, gr]), STEEL_DARK, INK, 1);
  if (withRoof) {
    svg.path(`M${fmt(l0[0])} ${fmt(l0[1])} Q${fmt((l0[0] + ridge0[0]) / 2)} ${fmt(ridge0[1] + 4)} ${fmt(ridge0[0])} ${fmt(ridge0[1])} L${fmt(ridge1[0])} ${fmt(ridge1[1])} Q${fmt((l1[0] + ridge1[0]) / 2)} ${fmt(ridge1[1] + 4)} ${fmt(l1[0])} ${fmt(l1[1])}Z`, roofL, INK, 1.1);
    svg.path(`M${fmt(r0[0])} ${fmt(r0[1])} Q${fmt((r0[0] + ridge0[0]) / 2)} ${fmt(ridge0[1] + 6)} ${fmt(ridge0[0])} ${fmt(ridge0[1])} L${fmt(ridge1[0])} ${fmt(ridge1[1])} Q${fmt((r1[0] + ridge1[0]) / 2)} ${fmt(ridge1[1] + 6)} ${fmt(r1[0])} ${fmt(r1[1])}Z`, roofR, INK, 1.1);
    svg.path(d([gl, ridge0, gr]), gable, INK, 1);
  } else {
    svg.line(l0[0], l0[1], ridge0[0], ridge0[1], STEEL, 1.6);
    svg.line(r0[0], r0[1], ridge0[0], ridge0[1], STEEL_DARK, 1.6);
    svg.line(ridge0[0], ridge0[1], ridge1[0], ridge1[1], STEEL_LIGHT, 1.4);
  }
}

function hangar(
  svg: Svg,
  iso: Iso,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  skin: string,
  dark: string,
  withRoof: boolean,
): void {
  const ym = (y0 + y1) / 2;
  const fl = pt(iso, x1, y0, 2);
  const fr = pt(iso, x1, y1, 2);
  const bl = pt(iso, x0, y0, 2);
  const br = pt(iso, x0, y1, 2);
  const ft = pt(iso, x1, ym, z);
  const bt = pt(iso, x0, ym, z);
  svg.path(d([bl, br, fr, fl]), STEEL_DARK, INK, 1);
  if (withRoof) {
    svg.path(
      `M${fmt(bl[0])} ${fmt(bl[1])} Q${fmt(bt[0])} ${fmt(bt[1])} ${fmt(br[0])} ${fmt(br[1])} L${fmt(fr[0])} ${fmt(fr[1])} Q${fmt(ft[0])} ${fmt(ft[1])} ${fmt(fl[0])} ${fmt(fl[1])}Z`,
      skin,
      INK,
      1.15,
    );
    svg.path(
      `M${fmt(fl[0])} ${fmt(fl[1])} Q${fmt(ft[0])} ${fmt(ft[1])} ${fmt(fr[0])} ${fmt(fr[1])} Q${fmt((fl[0] + fr[0]) / 2)} ${fmt(fr[1] + 6)} ${fmt(fl[0])} ${fmt(fl[1])}Z`,
      dark,
      INK,
      1,
    );
  } else {
    svg.line(fl[0], fl[1], ft[0], ft[1], STEEL, 1.8);
    svg.line(fr[0], fr[1], ft[0], ft[1], STEEL_DARK, 1.8);
    svg.line(bt[0], bt[1], ft[0], ft[1], STEEL_LIGHT, 1.4);
  }
}

function lowHall(
  svg: Svg,
  iso: Iso,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  fill: string,
  withRoof: boolean,
): void {
  const nw = pt(iso, x0, y0, z);
  const ne = pt(iso, x1, y0, z);
  const se = pt(iso, x1, y1, z);
  const sw = pt(iso, x0, y1, z);
  const nwg = pt(iso, x0, y0, 0);
  const neg = pt(iso, x1, y0, 0);
  const seg = pt(iso, x1, y1, 0);
  const swg = pt(iso, x0, y1, 0);
  const bump = pt(iso, (x0 + x1) / 2, (y0 + y1) * 0.48, z + 5);
  svg.path(d([sw, swg, seg, se]), STEEL_DARK, INK, 1);
  svg.path(d([se, seg, neg, ne]), "#3a403c", INK, 1);
  if (withRoof) {
    svg.path(
      `M${fmt(nw[0])} ${fmt(nw[1])} Q${fmt(bump[0])} ${fmt(bump[1])} ${fmt(ne[0])} ${fmt(ne[1])} L${fmt(se[0])} ${fmt(se[1])} Q${fmt(bump[0] + 4)} ${fmt(se[1] - z * 0.2)} ${fmt(sw[0])} ${fmt(sw[1])}Z`,
      fill,
      INK,
      1.1,
    );
  }
}

function paintWindow(svg: Svg, x: number, y: number, lit: boolean, wide: boolean): void {
  const w = wide ? 6 : 4.5;
  const h = wide ? 5 : 6;
  svg.path(`M${fmt(x)} ${fmt(y)} q${fmt(w / 2)} ${fmt(-1.2)} ${fmt(w)} 0 v${fmt(h)} q${fmt(-w / 2)} ${fmt(1.2)} ${fmt(-w)} 0Z`, INK, INK, 0.6);
  svg.path(`M${fmt(x + 0.8)} ${fmt(y + 0.8)} q${fmt((w - 1.6) / 2)} ${fmt(-0.8)} ${fmt(w - 1.6)} 0 v${fmt(h - 1.6)} q${fmt(-(w - 1.6) / 2)} ${fmt(0.8)} ${fmt(1.6 - w)} 0Z`, lit ? GLASS_LIT : GLASS);
}

function paintBuildingMass(
  svg: Svg,
  iso: Iso,
  kind: BuildingKind,
  pal: Palette,
  construction: number,
  lit: boolean,
  complete: boolean,
): void {
  const roofed = construction >= 2;
  const team = pal.primary;
  if (kind === "constructionYard") {
    lowHall(svg, iso, 0.05, 1.2, 0.12, 0.95, 14, svg.grad(pt(iso, 0.1, 0.2, 14)[0], pt(iso, 0.1, 0.2, 14)[1], pt(iso, 1.1, 0.8, 0)[0], pt(iso, 1.1, 0.8, 0)[1], [[0, STEEL_LIGHT], [1, STEEL_DARK]]), roofed);
    coolingTower(svg, iso, 1.45, 1.15, 26, 11, 6.5, 8, STEEL, team, roofed);
    const crane = pt(iso, 0.35, 0.35, 30);
    const hook = pt(iso, 1.7, 0.2, 18);
    const base = pt(iso, 0.35, 0.35, 0);
    svg.path(`M${fmt(base[0])} ${fmt(base[1])} Q${fmt(crane[0] - 4)} ${fmt(crane[1] + 8)} ${fmt(crane[0])} ${fmt(crane[1])}`, "none", RUST, 3.2);
    if (roofed) {
      svg.line(crane[0], crane[1], hook[0], hook[1], RUST, 2.6);
      svg.line(hook[0], hook[1], hook[0] - 2, hook[1] + 10, BRASS, 1.6);
      svg.ellipse(crane[0], crane[1], 4.5, 3, STEEL_LIGHT, INK, 1);
      const dish = pt(iso, 1.45, 1.15, 30);
      svg.ellipse(dish[0], dish[1], 7, 4, STEEL_DARK, INK, 1);
      svg.ellipse(dish[0], dish[1] - 1, 5, 2.6, complete && lit ? GLASS_LIT : STEEL);
    }
    if (complete) {
      const win = pt(iso, 0.55, 0.55, 10);
      paintWindow(svg, win[0] - 4, win[1] - 3, lit, true);
      paintWindow(svg, win[0] + 6, win[1] - 1, lit, false);
    }
  } else if (kind === "power") {
    coolingTower(svg, iso, 0.55, 0.7, 40, 13, 7, 9, STEEL, STEEL_DARK, roofed);
    coolingTower(svg, iso, 1.4, 1.2, 46, 12, 6.5, 8.5, STEEL_DARK, team, roofed);
    lowHall(svg, iso, 0.7, 1.75, 0.85, 1.75, 11, STEEL, roofed);
    if (roofed) {
      const pipeA = pt(iso, 0.55, 0.7, 22);
      const pipeB = pt(iso, 1.4, 1.2, 24);
      svg.path(`M${fmt(pipeA[0])} ${fmt(pipeA[1])} Q${fmt((pipeA[0] + pipeB[0]) / 2)} ${fmt(Math.min(pipeA[1], pipeB[1]) - 8)} ${fmt(pipeB[0])} ${fmt(pipeB[1])}`, "none", "#c7d8cf", 2.4);
    }
    if (complete) {
      const glow = pt(iso, 1.4, 1.2, 48);
      svg.ellipse(glow[0], glow[1], 6, 5, svg.radial(glow[0], glow[1], 8, [[0, lit ? pal.light : team], [1, "rgba(180,200,120,0.02)"]]));
    }
  } else if (kind === "refinery") {
    coolingTower(svg, iso, 0.55, 0.75, 36, 10, 7.5, 9, RUST, RUST_LIGHT, roofed);
    coolingTower(svg, iso, 1.15, 0.45, 42, 10, 7, 8.5, STEEL_DARK, STEEL, roofed);
    const stackB = pt(iso, 1.7, 0.35, 0);
    const stackT = pt(iso, 1.7, 0.35, 48);
    svg.ellipse(stackB[0], stackB[1], 3.4, 1.6, STEEL_DARK, INK, 0.8);
    svg.path(`M${fmt(stackB[0] - 3)} ${fmt(stackB[1])} Q${fmt(stackB[0] - 2.2)} ${fmt((stackB[1] + stackT[1]) / 2)} ${fmt(stackT[0] - 2)} ${fmt(stackT[1])} L${fmt(stackT[0] + 2)} ${fmt(stackT[1])} Q${fmt(stackB[0] + 2.2)} ${fmt((stackB[1] + stackT[1]) / 2)} ${fmt(stackB[0] + 3)} ${fmt(stackB[1])}Z`, STEEL, INK, 1);
    if (roofed) svg.ellipse(stackT[0], stackT[1], 2.6, 1.3, RUST, INK, 0.8);
    lowHall(svg, iso, 1.55, 2.85, 0.75, 1.8, 13, svg.grad(pt(iso, 1.6, 0.8, 13)[0], pt(iso, 1.6, 0.8, 13)[1], pt(iso, 2.6, 1.6, 0)[0], pt(iso, 2.6, 1.6, 0)[1], [[0, STEEL_LIGHT], [1, "#3a403c"]]), roofed);
    if (roofed) {
      const belt0 = pt(iso, 1.15, 0.7, 18);
      const belt1 = pt(iso, 2.1, 1.2, 10);
      svg.path(`M${fmt(belt0[0])} ${fmt(belt0[1])} Q${fmt((belt0[0] + belt1[0]) / 2)} ${fmt(belt0[1] + 4)} ${fmt(belt1[0])} ${fmt(belt1[1])}`, "none", STEEL_LIGHT, 2.4);
    }
    if (complete) {
      const door = pt(iso, 2.4, 1.5, 6);
      svg.ellipse(door[0], door[1], 7, 4.5, lit ? "#1e2a22" : "#151814", INK, 0.8);
      svg.ellipse(door[0], door[1] - 3, 6, 2, team);
    }
  } else if (kind === "barracks") {
    aFrame(
      svg,
      iso,
      0.1,
      1.85,
      0.18,
      1.55,
      28,
      svg.grad(pt(iso, 0.2, 0.2, 20)[0], pt(iso, 0.2, 0.2, 20)[1], pt(iso, 1, 0.9, 0)[0], pt(iso, 1, 0.9, 0)[1], [[0, "#c4c6ba"], [1, "#6a7268"]]),
      svg.grad(pt(iso, 0.2, 1.4, 20)[0], pt(iso, 0.2, 1.4, 20)[1], pt(iso, 1.6, 0.9, 0)[0], pt(iso, 1.6, 0.9, 0)[1], [[0, "#7a8278"], [1, "#3a403c"]]),
      STEEL,
      roofed,
    );
    for (let i = 0; i < 5; i++) {
      const bag = pt(iso, 0.2 + i * 0.35, 1.55, 2);
      svg.ellipse(bag[0], bag[1], 5.5, 2.6, SAND, INK, 0.8);
    }
    if (roofed) {
      const door = pt(iso, 0.15, 0.85, 6);
      svg.ellipse(door[0], door[1], 5, 8, STEEL_DARK, INK, 1);
      svg.ellipse(door[0], door[1] + 1, 3.2, 6, INK);
      if (complete) svg.ellipse(door[0] - 0.6, door[1] + 1.5, 1.8, 4.2, team);
      const pole = pt(iso, 1.65, 0.35, 0);
      const top = pt(iso, 1.65, 0.35, 34);
      svg.line(pole[0], pole[1], top[0], top[1], STEEL_DARK, 1.8);
      if (complete) {
        svg.path(`M${fmt(top[0])} ${fmt(top[1])} Q${fmt(top[0] + 12)} ${fmt(top[1] + 3)} ${fmt(top[0] + 11)} ${fmt(top[1] + 9)} L${fmt(top[0])} ${fmt(top[1] + 7)}Z`, team, INK, 0.8);
        paintWindow(svg, pt(iso, 0.7, 0.35, 14)[0], pt(iso, 0.7, 0.35, 14)[1], lit, true);
        paintWindow(svg, pt(iso, 1.2, 0.4, 14)[0], pt(iso, 1.2, 0.4, 14)[1], lit, false);
      }
    }
  } else if (kind === "factory") {
    hangar(
      svg,
      iso,
      0.05,
      2.05,
      0.15,
      1.55,
      30,
      svg.grad(pt(iso, 0.2, 0.3, 24)[0], pt(iso, 0.2, 0.3, 24)[1], pt(iso, 2, 1.4, 0)[0], pt(iso, 2, 1.4, 0)[1], [[0, STEEL_LIGHT], [1, "#3a403c"]]),
      "#121614",
      roofed,
    );
    coolingTower(svg, iso, 2.45, 0.55, 28, 6, 3.8, 4.5, STEEL_DARK, STEEL, roofed);
    coolingTower(svg, iso, 2.7, 1.15, 24, 5.5, 3.4, 4.2, RUST, RUST_LIGHT, roofed);
    if (roofed) {
      const boom = pt(iso, 2.2, 0.2, 34);
      const tip = pt(iso, 2.85, 0.9, 16);
      svg.line(boom[0], boom[1], tip[0], tip[1], STEEL, 2.6);
      svg.ellipse(boom[0], boom[1], 3, 2.2, BRASS, INK, 0.8);
    }
    if (complete) {
      const mouth = pt(iso, 2.05, 0.85, 8);
      svg.ellipse(mouth[0], mouth[1], 11, 7, lit ? "#1a221c" : "#121614", STEEL_DARK, 1.1);
      svg.ellipse(mouth[0] - 4, mouth[1], 2.4, 4, STEEL);
      svg.ellipse(mouth[0] + 3, mouth[1], 2.4, 4, STEEL);
      svg.ellipse(mouth[0], mouth[1] - 8, 10, 2.2, team);
    }
  } else if (kind === "turret") {
    const dir = facingVector(0);
    const c = pt(iso, 0.5, 0.5, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      svg.ellipse(c[0] + Math.cos(a) * 13, c[1] + Math.sin(a) * 6.5 + 3, 5.2, 2.5, SAND, INK, 0.8);
    }
    svg.ellipse(c[0], c[1] + 1, 12, 6.5, STEEL_DARK, INK, 1.1);
    if (roofed) {
      svg.ellipse(c[0], c[1] - 2, 9, 6, STEEL, INK, 1);
      svg.ellipse(c[0], c[1] - 3, 6.5, 4.2, team, INK, 0.9);
      svg.path(`M${fmt(c[0])} ${fmt(c[1] - 2)} Q${fmt(c[0] + dir.x * 12)} ${fmt(c[1] - 4 + dir.y * 10)} ${fmt(c[0] + dir.x * 24)} ${fmt(c[1] + dir.y * 24)}`, "none", STEEL_DARK, 5);
      svg.line(c[0], c[1] - 3, c[0] + dir.x * 22, c[1] - 3 + dir.y * 22, STEEL_LIGHT, 1.6);
      svg.ellipse(c[0] + dir.x * 23, c[1] - 2 + dir.y * 23, 2.6, 2, STEEL, INK, 0.8);
    }
    if (complete) svg.ellipse(c[0] + 6, c[1] - 8, 2.4, 1.8, lit ? GLASS_LIT : STEEL_DARK, INK, 0.8);
  } else {
    const c = pt(iso, 1, 1, 0);
    svg.ellipse(c[0], c[1] + 2, 14, 7, STEEL_DARK, INK, 1);
    const shaft = pt(iso, 1, 1, 36);
    svg.path(
      `M${fmt(c[0] - 5)} ${fmt(c[1])} Q${fmt(c[0] - 3)} ${fmt((c[1] + shaft[1]) / 2)} ${fmt(shaft[0] - 2.4)} ${fmt(shaft[1])} L${fmt(shaft[0] + 2.4)} ${fmt(shaft[1])} Q${fmt(c[0] + 3)} ${fmt((c[1] + shaft[1]) / 2)} ${fmt(c[0] + 5)} ${fmt(c[1])}Z`,
      team,
      INK,
      1.1,
    );
    if (roofed) {
      svg.ellipse(shaft[0], shaft[1], 11, 6.5, GOLD, INK, 1.1);
      svg.ellipse(shaft[0], shaft[1], 7.5, 4.2, STEEL_DARK, INK, 1);
    }
    if (complete) {
      svg.ellipse(shaft[0], shaft[1], 5, 3, lit ? "#f3dc79" : "#8a7428");
      svg.ellipse(shaft[0], shaft[1], 12, 9, svg.radial(shaft[0], shaft[1], 14, [[0, "#f3dc79"], [1, "rgba(243,220,121,0.02)"]]));
    }
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
