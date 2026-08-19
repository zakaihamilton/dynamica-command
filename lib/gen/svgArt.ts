import { BUILDING_STATS } from "../catalog";
import { SPRITE_ART, TEXTURE_ART, UNIT_DIRECTION_ART, UNIT_DIRECTION_CROPS, unitViewForFacing } from "./visualAssets";
import type {
  BuildingKind,
  BuildingSpriteOptions,
  FactionVisualProfile,
  Facing,
  Palette,
  SpriteSpec,
  UnitKind,
  UnitSpriteOptions,
} from "../types";

const TW = 64;
const TH = 32;
const ART_REV = "tactical3";
const INK = "#18222c";
const STEEL = "#596875";
const STEEL_LIGHT = "#9aabba";
const STEEL_DARK = "#26323d";
const RUST = "#75513b";
const RUST_LIGHT = "#bd8258";
const GLASS = "#31515e";
const GLASS_LIT = "#b5f2ec";
const SAND = "#8a7a58";
const BRASS = "#c3a65d";
const GOLD = "#d3b846";
const RIM = "#c8cec4";
const SOFT = "#3a423c";

const DEFAULT_PROFILE: FactionVisualProfile = {
  designFamily: 0,
  material: "brushed",
  trimPattern: 0,
  insignia: 0,
  weathering: 0,
  lightRig: "cyan",
};

function rasterTreatment(profile: FactionVisualProfile): string {
  if (profile.designFamily === 1) return "rgba(187, 102, 67, 0.13)";
  if (profile.designFamily === 2) return "rgba(176, 137, 77, 0.11)";
  return "rgba(66, 190, 205, 0.1)";
}

function wreckTreatment(): string {
  return "rgba(46, 26, 16, 0.52)";
}

function rubbleTreatment(): string {
  return "rgba(38, 24, 16, 0.58)";
}

function kindOffset(kind: string): number {
  let h = 2166136261;
  for (let i = 0; i < kind.length; i++) h = Math.imul(h ^ kind.charCodeAt(i), 16777619);
  return h >>> 0;
}

function visualKey(profile: FactionVisualProfile): string {
  return `${profile.designFamily}:${profile.material}:${profile.trimPattern}:${profile.insignia}:${profile.weathering}:${profile.lightRig}`;
}

function profileMetal(profile: FactionVisualProfile): { body: string; light: string; dark: string; trim: string } {
  if (profile.material === "armored") {
    return { body: "#4f6172", light: "#8fa6b8", dark: "#202e3b", trim: "#b8c8d3" };
  }
  if (profile.material === "industrial") {
    return { body: "#675d50", light: "#a3917a", dark: "#352f2a", trim: "#d1a969" };
  }
  return { body: "#526b72", light: "#98b6ba", dark: "#20373d", trim: "#c0dcda" };
}

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
      `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter" stroke-linecap="square"${extra}/>`,
    );
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, fill: string, stroke?: string, sw = 1, extra = ""): void {
    this.body.push(
      `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" fill="${fill}"${
        stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter" stroke-linecap="square"` : ""
      }${extra}/>`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke: string, sw = 1): void {
    this.body.push(
      `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square"/>`,
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
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

function d(pts: Array<[number, number]>): string {
  return `${pts.map(([x, y], i) => `${i ? "L" : "M"}${fmt(x)} ${fmt(y)}`).join("")}Z`;
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
  const infantry = kind === "infantry";
  const antiArmor = kind === "antiArmor";
  // Keep foot soldiers visually subordinate to the larger tracked units while
  // retaining the same bottom contact anchor on the battlefield.
  const w = infantry ? 38 : antiArmor ? 44 : 64;
  const h = infantry ? 42 : antiArmor ? 46 : 60;
  const facing = options.facing ?? 0;
  const frame = options.animationFrame ?? 0;
  const variant = options.variant ?? 0;
  const dmg = options.damageStage ?? 0;
  const profile = options.profile ?? DEFAULT_PROFILE;
  const view = unitViewForFacing(facing);
  // Raster units are bottom-aligned inside their logical frame. The rotation
  // pivot must be the contact point at the feet/base, not the visual center.
  const ground = h;
  return {
    id: `unit:directional-v1:${kind}:${facing}:${view}:${palette.primary}:${visualKey(profile)}:${variant}:${frame}:${dmg}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes: [],
    imageSrc: UNIT_DIRECTION_ART[kind][view],
    imageTint: rasterTreatment(profile),
    imageCrop: UNIT_DIRECTION_CROPS[kind]?.[view],
    anchorX: w / 2,
    anchorY: ground,
    pixelScale: 1,
  };
}


function octagon(cx: number, cy: number, rx: number, ry: number): Array<[number, number]> {
  const k = 0.41;
  return [
    [cx - rx * k, cy - ry],
    [cx + rx * k, cy - ry],
    [cx + rx, cy - ry * k],
    [cx + rx, cy + ry * k],
    [cx + rx * k, cy + ry],
    [cx - rx * k, cy + ry],
    [cx - rx, cy + ry * k],
    [cx - rx, cy - ry * k],
  ];
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

function isoBox(
  svg: Svg,
  iso: Iso,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z0: number,
  z1: number,
  top: string,
  south: string,
  east: string,
): void {
  const nw = pt(iso, x0, y0, z1);
  const ne = pt(iso, x1, y0, z1);
  const se = pt(iso, x1, y1, z1);
  const sw = pt(iso, x0, y1, z1);
  const neg = pt(iso, x1, y0, z0);
  const seg = pt(iso, x1, y1, z0);
  const swg = pt(iso, x0, y1, z0);
  svg.path(d([sw, swg, seg, se]), south, INK, 1);
  svg.path(d([se, seg, neg, ne]), east, INK, 1);
  svg.path(d([nw, ne, se, sw]), top, INK, 1);
  svg.line(nw[0], nw[1], ne[0], ne[1], RIM, 1);
  svg.line(nw[0], nw[1], sw[0], sw[1], "#aeb4aa", 1);
  svg.line(se[0], se[1], seg[0], seg[1], "#0c0e0c", 1);
  const nx = Math.max(2, Math.round((x1 - x0) * 4));
  for (let i = 1; i < nx; i++) {
    const t = i / nx;
    const a = pt(iso, x0 + (x1 - x0) * t, y1, z1);
    const b = pt(iso, x0 + (x1 - x0) * t, y1, z0 + (z1 - z0) * 0.15);
    svg.line(a[0], a[1], b[0], b[1], SOFT, 1);
  }
  for (let i = 0; i <= nx; i++) {
    const p = pt(iso, x0 + (x1 - x0) * (i / nx), y0 + 0.05, z1);
    svg.ellipse(p[0], p[1], 0.9, 0.55, STEEL_DARK);
  }
  const ny = Math.max(2, Math.round((y1 - y0) * 4));
  for (let i = 0; i <= ny; i++) {
    const p = pt(iso, x0 + 0.05, y0 + (y1 - y0) * (i / ny), z1);
    svg.ellipse(p[0], p[1], 0.9, 0.55, STEEL_DARK);
  }
}

function isoCyl(
  svg: Svg,
  iso: Iso,
  lx: number,
  ly: number,
  z0: number,
  z1: number,
  rx: number,
  ry: number,
  top: string,
  south: string,
  east: string,
): void {
  const base = pt(iso, lx, ly, z0);
  const cap = pt(iso, lx, ly, z1);
  svg.ellipse(base[0], base[1], rx, ry, STEEL_DARK, INK, 1);
  svg.path(d([
    [base[0] - rx, base[1]],
    [cap[0] - rx, cap[1]],
    [cap[0], cap[1]],
    [base[0], base[1]],
  ]), south, INK, 1);
  svg.path(d([
    [base[0], base[1]],
    [cap[0], cap[1]],
    [cap[0] + rx, cap[1]],
    [base[0] + rx, base[1]],
  ]), east, INK, 1);
  svg.ellipse(cap[0], cap[1], rx, ry, top, INK, 1);
  svg.ellipse(cap[0] - rx * 0.28, cap[1] - ry * 0.22, rx * 0.35, ry * 0.22, RIM);
  const hoop = pt(iso, lx, ly, (z0 + z1) / 2);
  svg.line(base[0] - rx, hoop[1], base[0] + rx, hoop[1], SOFT, 1);
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
  south: string,
  east: string,
  cap: string,
  withCap: boolean,
): void {
  const base = pt(iso, lx, ly, 0);
  const mid = pt(iso, lx, ly, z * 0.42);
  const top = pt(iso, lx, ly, z);
  svg.ellipse(base[0], base[1], rBase, rBase * 0.38, STEEL_DARK, INK, 1);
  svg.path(d([
    [base[0] - rBase, base[1]],
    [mid[0] - rWaist, mid[1]],
    [top[0] - rTop, top[1]],
    [top[0], top[1]],
    [mid[0], mid[1]],
    [base[0], base[1]],
  ]), south, INK, 1);
  svg.path(d([
    [base[0], base[1]],
    [mid[0], mid[1]],
    [top[0], top[1]],
    [top[0] + rTop, top[1]],
    [mid[0] + rWaist, mid[1]],
    [base[0] + rBase, base[1]],
  ]), east, INK, 1);
  svg.line(base[0] - rWaist, mid[1], base[0] + rWaist, mid[1], SOFT, 1);
  svg.line(base[0] - rBase * 0.7, (base[1] + mid[1]) / 2, base[0] + rBase * 0.7, (base[1] + mid[1]) / 2, SOFT, 1);
  if (withCap) {
    svg.ellipse(top[0], top[1], rTop, rTop * 0.38, cap, INK, 1);
    svg.ellipse(top[0] - rTop * 0.25, top[1] - 1, rTop * 0.28, rTop * 0.12, RIM);
    svg.ellipse(top[0], top[1] + rTop * 0.1, rTop * 0.45, rTop * 0.16, STEEL_DARK);
  }
}

function vent(svg: Svg, iso: Iso, lx: number, ly: number, z: number): void {
  const p = pt(iso, lx, ly, z);
  svg.path(d(diamond(p[0], p[1], 9, 5)), STEEL_DARK, INK, 1);
  svg.line(p[0] - 3, p[1], p[0] + 3, p[1], STEEL, 1);
  svg.line(p[0] - 2, p[1] - 1.2, p[0] + 2, p[1] - 1.2, STEEL_LIGHT, 1);
  svg.line(p[0] - 2, p[1] + 1.2, p[0] + 2, p[1] + 1.2, SOFT, 1);
}

function rustStreak(svg: Svg, iso: Iso, lx: number, ly: number, z1: number, z0: number): void {
  const a = pt(iso, lx, ly, z1);
  const b = pt(iso, lx, ly, z0);
  svg.line(a[0], a[1], b[0], b[1], RUST, 1);
}

function crate(svg: Svg, iso: Iso, lx: number, ly: number, s = 0.22, z = 6): void {
  isoBox(svg, iso, lx, ly, lx + s, ly + s, 0, z, SAND, "#6a5844", "#3a3024");
}

function ladder(svg: Svg, iso: Iso, lx: number, ly: number, z0: number, z1: number): void {
  const a = pt(iso, lx, ly, z1);
  const b = pt(iso, lx, ly, z0);
  svg.line(a[0] - 2, a[1], b[0] - 2, b[1], STEEL_DARK, 1);
  svg.line(a[0] + 2, a[1], b[0] + 2, b[1], STEEL_DARK, 1);
  const n = 4;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const y = a[1] + (b[1] - a[1]) * t;
    const x = a[0] + (b[0] - a[0]) * t;
    svg.line(x - 2, y, x + 2, y, STEEL, 1);
  }
}

function gable(
  svg: Svg,
  iso: Iso,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  roofL: string,
  roofR: string,
  gableFill: string,
  withRoof: boolean,
): void {
  const wallZ = 10;
  isoBox(svg, iso, x0, y0, x1, y1, 0, wallZ, STEEL, STEEL, STEEL_DARK);
  if (!withRoof) {
    const ridge0 = pt(iso, x0, (y0 + y1) / 2, z);
    const ridge1 = pt(iso, x1, (y0 + y1) / 2, z);
    svg.line(pt(iso, x0, y0, wallZ)[0], pt(iso, x0, y0, wallZ)[1], ridge0[0], ridge0[1], STEEL, 1);
    svg.line(pt(iso, x0, y1, wallZ)[0], pt(iso, x0, y1, wallZ)[1], ridge0[0], ridge0[1], STEEL_DARK, 1);
    svg.line(ridge0[0], ridge0[1], ridge1[0], ridge1[1], STEEL_LIGHT, 1);
    return;
  }
  const ym = (y0 + y1) / 2;
  const ridge0 = pt(iso, x0, ym, z);
  const ridge1 = pt(iso, x1, ym, z);
  const l0 = pt(iso, x0, y0, wallZ);
  const l1 = pt(iso, x1, y0, wallZ);
  const r0 = pt(iso, x0, y1, wallZ);
  const r1 = pt(iso, x1, y1, wallZ);
  svg.path(d([l0, ridge0, ridge1, l1]), roofL, INK, 1);
  svg.path(d([r0, r1, ridge1, ridge0]), roofR, INK, 1);
  svg.path(d([l0, ridge0, r0]), gableFill, INK, 1);
  svg.line(ridge0[0], ridge0[1], ridge1[0], ridge1[1], RIM, 1);
  svg.line(l0[0], l0[1], ridge0[0], ridge0[1], "#aeb4aa", 1);
}

function panels(svg: Svg, iso: Iso, x0: number, y0: number, x1: number, y1: number, z: number, n: number): void {
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const a = pt(iso, x0 + (x1 - x0) * t, y0, z);
    const b = pt(iso, x0 + (x1 - x0) * t, y1, z);
    svg.line(a[0], a[1], b[0], b[1], STEEL_DARK, 1);
  }
}

function paintWindow(svg: Svg, x: number, y: number, lit: boolean, wide: boolean): void {
  const w = wide ? 6 : 4;
  const h = wide ? 4 : 5;
  svg.path(d([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]), INK, INK, 1);
  svg.path(d([[x + 1, y + 1], [x + w - 1, y + 1], [x + w - 1, y + h - 1], [x + 1, y + h - 1]]), lit ? GLASS_LIT : GLASS);
}

function diamond(cx: number, cy: number, w: number, h: number): Array<[number, number]> {
  return [[cx, cy - h / 2], [cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy]];
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
  const profile = options.profile ?? DEFAULT_PROFILE;
  const ground = pt(iso, fp.w / 2, fp.h / 2, 0);
  return {
    id: `bld:raster-v3:${kind}:${palette.primary}:${visualKey(profile)}:${variant}:${construction}:${dmg}`,
    kind: "building",
    w: iso.w,
    h: iso.h,
    palette,
    shapes: [],
    imageSrc: SPRITE_ART[kind],
    imageTint: rasterTreatment(profile),
    anchorX: ground[0],
    anchorY: ground[1],
    pixelScale: 1,
  };
  const lit = construction >= 3 && dmg < 2;
  const complete = construction >= 3;
  const svg = new Svg();

  paintYard(svg, iso, kind, profile);
  if (construction >= 1) paintBuildingMass(svg, iso, kind, palette, construction, lit, complete);
  if (construction >= 2) paintFactionBuildingSilhouette(svg, iso, kind, palette, variant, profile);
  if (construction >= 2) paintBuildingIdentity(svg, iso, kind, palette, variant, profile);
  if (construction >= 2) paintBuildingFinish(svg, iso, kind, palette, variant, profile);
  if (construction < 3) paintScaffold(svg, iso, construction);
  if (dmg > 0) {
    svg.ellipse(ground[0] - 8, ground[1] - 2, 10, 4.5, "rgba(34,24,19,0.72)");
    svg.line(ground[0] - 2, ground[1] - 10, ground[0] + 12, ground[1] + 4, "#211b18", 2);
  }
  if (dmg > 1) {
    svg.ellipse(ground[0] + 10, ground[1] - 18, 8, 10, "rgba(26,27,25,0.5)");
    svg.path(d([
      [ground[0] - 10, ground[1] + 6],
      [ground[0], ground[1] - 4],
      [ground[0] + 14, ground[1] + 8],
      [ground[0] + 2, ground[1] + 10],
    ]), "#3a322c", INK, 1);
  }

  return {
    id: `bld:${ART_REV}:${kind}:${palette.primary}:${visualKey(profile)}:${variant}:${dmg}:${construction}`,
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

function paintBuildingIdentity(
  svg: Svg,
  iso: Iso,
  kind: BuildingKind,
  pal: Palette,
  variant: number,
  profile: FactionVisualProfile,
): void {
  const z = Math.max(12, buildingSky(kind) * 0.5);
  const center = pt(iso, iso.fw * 0.52, iso.fh * 0.48, z);
  const light = profile.lightRig === "amber" ? "#ffd27a" : profile.lightRig === "red" ? "#ff8068" : "#8eeff1";
  const span = Math.max(8, Math.min(18, (iso.fw + iso.fh) * 4));
  if (profile.designFamily === 0) {
    svg.path(d(diamond(center[0], center[1] - 3, span, 7)), pal.primary, INK, 1);
    svg.line(center[0] - span * 0.35, center[1] - 3, center[0] + span * 0.35, center[1] - 3, pal.light, 1);
  } else if (profile.designFamily === 1) {
    svg.path(d(octagon(center[0], center[1] - 2, span * 0.48, 5.5)), STEEL_DARK, INK, 1);
    svg.path(d(octagon(center[0], center[1] - 4, span * 0.3, 3.2)), pal.primary, INK, 1);
  } else {
    const mastTop = center[1] - 14 - (variant % 4);
    svg.line(center[0], center[1], center[0], mastTop, STEEL_DARK, 2);
    svg.line(center[0], mastTop + 4, center[0] + 9, mastTop + 1, STEEL_LIGHT, 1.5);
    svg.ellipse(center[0] + 10, mastTop, 3.5, 2, light, INK, 1);
  }
  const badge = pt(iso, Math.min(iso.fw - 0.15, iso.fw * 0.72), 0.12, Math.max(8, z * 0.7));
  if (profile.insignia % 2 === 0) svg.path(d(diamond(badge[0], badge[1], 6, 4)), pal.accent, INK, 1);
  else svg.ellipse(badge[0], badge[1], 4, 2.5, pal.accent, INK, 1);
  if (profile.trimPattern >= 2) {
    const a = pt(iso, 0.1, Math.min(iso.fh - 0.1, iso.fh * 0.7), 3);
    const b = pt(iso, Math.min(iso.fw - 0.1, iso.fw * 0.8), Math.min(iso.fh - 0.1, iso.fh * 0.7), 3);
    svg.line(a[0], a[1], b[0], b[1], profile.trimPattern === 3 ? pal.accent : pal.primary, 2);
  }
  if (profile.weathering >= 2) {
    svg.line(center[0] - 8, center[1] + 5, center[0] + 3, center[1] + 8, RUST, 1);
    svg.ellipse(center[0] + 8, center[1] + 6, 5, 2.2, "rgba(58,42,32,0.42)");
  }
}

function paintBuildingFinish(
  svg: Svg,
  iso: Iso,
  kind: BuildingKind,
  pal: Palette,
  variant: number,
  profile: FactionVisualProfile,
): void {
  const metal = profileMetal(profile);
  const light = profile.lightRig === "amber" ? "#ffd27a" : profile.lightRig === "red" ? "#ff8068" : "#8eeff1";
  const roof = Math.max(10, buildingSky(kind) * 0.48);
  if (profile.designFamily === 0) {
    const a = pt(iso, iso.fw * 0.16, iso.fh * 0.18, roof + 3);
    const b = pt(iso, iso.fw * 0.84, iso.fh * 0.18, roof + 3);
    svg.line(a[0], a[1], b[0], b[1], metal.trim, 1.2);
    for (let i = 0; i < 3; i++) {
      const p = pt(iso, iso.fw * (0.3 + i * 0.2), iso.fh * 0.34, roof + 5);
      svg.ellipse(p[0], p[1], 1.5, 0.9, i === 1 ? light : pal.light, INK, 0.5);
    }
  } else if (profile.designFamily === 1) {
    for (let i = 0; i < 3; i++) {
      const t = 0.22 + i * 0.25;
      const a = pt(iso, iso.fw * t, 0.1, roof + 2);
      const b = pt(iso, iso.fw * t, Math.max(0.16, iso.fh * 0.68), roof + 2);
      svg.line(a[0], a[1], b[0], b[1], i === 1 ? pal.primary : metal.dark, 1.35);
    }
    const node = pt(iso, iso.fw * 0.5, iso.fh * 0.52, roof + 6);
    svg.path(d(octagon(node[0], node[1], 3.2, 1.9)), pal.accent, INK, 0.7);
  } else {
    const a = pt(iso, 0.12, iso.fh * 0.78, roof + 4);
    const b = pt(iso, iso.fw * 0.86, iso.fh * 0.2, roof + 4);
    svg.line(a[0], a[1], b[0], b[1], metal.trim, 1.5);
    const beacon = pt(iso, iso.fw * 0.68, iso.fh * 0.38, roof + 8 + (variant % 3));
    svg.ellipse(beacon[0], beacon[1], 2.2, 1.3, light, INK, 0.6);
    svg.line(beacon[0] - 4, beacon[1] + 3, beacon[0] + 4, beacon[1] + 3, pal.primary, 1);
  }
}

function paintFactionBuildingSilhouette(
  svg: Svg,
  iso: Iso,
  kind: BuildingKind,
  pal: Palette,
  variant: number,
  profile: FactionVisualProfile,
): void {
  const metal = profileMetal(profile);
  const sky = buildingSky(kind);
  const crown = Math.max(12, sky * 0.52);
  const pad = Math.min(0.14, iso.fw * 0.08, iso.fh * 0.08);
  if (profile.designFamily === 0) {
    const y0 = pad;
    const y1 = Math.min(iso.fh - pad, pad + Math.max(0.24, iso.fh * 0.2));
    isoBox(svg, iso, pad, y0, iso.fw - pad, y1, crown, crown + 6, pal.primary, metal.body, metal.dark);
    const left = pt(iso, pad, iso.fh - pad, crown * 0.62);
    const mid = pt(iso, iso.fw * 0.5, iso.fh + 0.08, crown * 0.42);
    const right = pt(iso, iso.fw - pad, iso.fh - pad, crown * 0.62);
    const ridge = pt(iso, iso.fw * 0.5, iso.fh - pad, crown * 0.88);
    svg.path(d([left, ridge, right, mid]), metal.light, INK, 1.4);
    svg.line(left[0], left[1], right[0], right[1], pal.light, 2.2);
    for (let i = 0; i < 3; i++) {
      const t = 0.28 + i * 0.22;
      const a = pt(iso, iso.fw * t, y0, crown + 6.5);
      const b = pt(iso, iso.fw * t, y1, crown + 6.5);
      svg.line(a[0], a[1], b[0], b[1], metal.trim, 1);
    }
  } else if (profile.designFamily === 1) {
    const block = Math.max(0.2, Math.min(0.46, iso.fw * 0.25, iso.fh * 0.25));
    const corners: Array<[number, number]> = [
      [pad, pad],
      [Math.max(pad, iso.fw - pad - block), Math.max(pad, iso.fh - pad - block)],
    ];
    for (const [x, y] of corners) {
      isoBox(svg, iso, x, y, x + block, y + block, 0, crown + 4, metal.light, metal.body, metal.dark);
      const cap = pt(iso, x + block / 2, y + block / 2, crown + 5);
      svg.path(d(octagon(cap[0], cap[1], 7 + block * 5, 4 + block * 2)), pal.primary, INK, 1.3);
    }
    const center = pt(iso, iso.fw * 0.5, iso.fh * 0.5, crown + 8);
    svg.path(d(octagon(center[0], center[1], 15, 8)), metal.dark, INK, 1.4);
    svg.path(d(octagon(center[0], center[1] - 2, 10, 5)), pal.primary, INK, 1.2);
  } else {
    const tankX = Math.min(iso.fw - 0.16, Math.max(0.16, iso.fw * 0.18));
    const tankY = Math.min(iso.fh - 0.16, Math.max(0.16, iso.fh * 0.72));
    isoCyl(svg, iso, tankX, tankY, 0, crown * 0.54 + 5, 6, 3, RUST_LIGHT, metal.body, metal.dark);
    const stackX = Math.min(iso.fw - 0.12, Math.max(0.12, iso.fw * 0.78));
    const stackY = Math.min(iso.fh - 0.12, Math.max(0.12, iso.fh * 0.22));
    isoCyl(svg, iso, stackX, stackY, 0, crown * 0.7 + 7 + (variant % 3), 3.5, 1.8, metal.trim, RUST, metal.dark);
    const a = pt(iso, tankX, tankY, crown * 0.48 + 4);
    const b = pt(iso, stackX, stackY, crown * 0.62 + 5);
    svg.line(a[0], a[1], b[0], b[1], metal.trim, 2);
    svg.line(a[0], a[1] - 1, b[0], b[1] - 1, metal.dark, 1);
    const service = pt(iso, iso.fw * 0.52, iso.fh * 0.5, crown * 0.44 + 4);
    svg.path(d(octagon(service[0], service[1], 5, 2.8)), metal.dark, INK, 1);
    svg.ellipse(service[0], service[1] - 1, 2, 1.2, pal.light, INK, 0.6);
  }
}

function paintYard(svg: Svg, iso: Iso, kind: BuildingKind, profile: FactionVisualProfile): void {
  const c = pt(iso, iso.fw / 2, iso.fh / 2, 0);
  const metal = profileMetal(profile);
  svg.ellipse(c[0], c[1] + 4, 18 + iso.fw * 10, 7 + iso.fh * 2, "rgba(8,10,8,0.38)");
  const pad = kind === "turret"
    ? [pt(iso, 0.05, 0.05, 0), pt(iso, 0.95, 0.05, 0), pt(iso, 0.95, 0.95, 0), pt(iso, 0.05, 0.95, 0)]
    : [pt(iso, 0, 0, 0), pt(iso, iso.fw, 0, 0), pt(iso, iso.fw, iso.fh, 0), pt(iso, 0, iso.fh, 0)];
  const fill = svg.grad(pad[0]![0], pad[0]![1], pad[2]![0], pad[2]![1], [[0, metal.light], [1, metal.dark]]);
  svg.path(d(pad), fill, INK, 1);
  svg.line(pad[0]![0], pad[0]![1], pad[2]![0], pad[2]![1], STEEL_DARK, 1);
  const mid = pt(iso, iso.fw * 0.5, iso.fh * 0.5, 0);
  svg.line((pad[1]![0] + pad[0]![0]) / 2, (pad[1]![1] + pad[0]![1]) / 2, mid[0], mid[1], STEEL, 1);
  svg.line((pad[3]![0] + pad[0]![0]) / 2, (pad[3]![1] + pad[0]![1]) / 2, mid[0], mid[1], STEEL_DARK, 1);
  if (profile.designFamily === 0) {
    svg.line(pad[0]![0], pad[0]![1], pad[1]![0], pad[1]![1], profile.trimPattern % 2 ? "#d7e2dc" : "#91fff0", 2);
  } else if (profile.designFamily === 1) {
    for (const corner of pad) svg.path(d(octagon(corner[0], corner[1], 3.5, 2)), metal.dark, INK, 1);
  } else {
    svg.line(pad[3]![0], pad[3]![1], pad[1]![0], pad[1]![1], RUST_LIGHT, 2);
    svg.line(pad[0]![0], pad[0]![1], pad[2]![0], pad[2]![1], metal.trim, 1);
  }
}

function paintScaffold(svg: Svg, iso: Iso, construction: number): void {
  const a = pt(iso, 0.15, 0.2, 8 + construction * 6);
  const b = pt(iso, iso.fw - 0.1, 0.35, 10 + construction * 5);
  const c = pt(iso, 0.4, iso.fh - 0.15, 0);
  svg.line(a[0], a[1], c[0], c[1], "#8b623a", 2);
  svg.line(a[0], a[1], b[0], b[1], "#b0814d", 2);
  svg.line(b[0], b[1], b[0] + 6, b[1] + 14, RUST, 2);
  svg.path(d(diamond(b[0] + 6, b[1] + 14, 5, 3)), STEEL_DARK, INK, 1);
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
    isoBox(svg, iso, 0.08, 0.12, 1.15, 0.95, 0, roofed ? 16 : 10, STEEL_LIGHT, STEEL, STEEL_DARK);
    if (roofed) {
      isoBox(svg, iso, 0.12, 0.18, 1.1, 0.9, 16, 18, team, STEEL, STEEL_DARK);
      panels(svg, iso, 0.12, 0.18, 1.1, 0.9, 18, 4);
      vent(svg, iso, 0.35, 0.4, 19);
      vent(svg, iso, 0.85, 0.55, 19);
    }
    isoCyl(svg, iso, 1.5, 1.2, 0, roofed ? 22 : 12, 8, 4, roofed ? team : STEEL, STEEL, STEEL_DARK);
    crate(svg, iso, 1.55, 0.15, 0.28, 7);
    crate(svg, iso, 1.75, 0.4, 0.22, 5);
    const mast = pt(iso, 0.28, 0.28, 0);
    const crane = pt(iso, 0.28, 0.28, 32);
    const hook = pt(iso, 1.65, 0.2, 16);
    svg.line(mast[0], mast[1], crane[0], crane[1], RUST, 2);
    svg.line(crane[0] - 5, crane[1] + 6, crane[0] + 5, crane[1] + 6, STEEL, 1);
    svg.line(crane[0] - 5, crane[1] + 12, crane[0] + 5, crane[1] + 12, STEEL, 1);
    svg.line(crane[0] - 5, crane[1] + 18, crane[0] + 5, crane[1] + 18, STEEL, 1);
    svg.line(crane[0] - 5, crane[1] + 6, crane[0] - 5, crane[1] + 18, STEEL_DARK, 1);
    svg.line(crane[0] + 5, crane[1] + 6, crane[0] + 5, crane[1] + 18, STEEL_DARK, 1);
    if (roofed) {
      svg.line(crane[0], crane[1], hook[0], hook[1], STEEL_DARK, 2);
      svg.line(hook[0], hook[1], hook[0], hook[1] + 10, BRASS, 1);
      svg.path(d(diamond(crane[0], crane[1], 8, 5)), STEEL_LIGHT, INK, 1);
      svg.path(d(octagon(hook[0], hook[1] + 10, 2.2, 1.6)), BRASS, INK, 1);
    }
    if (complete) {
      const win = pt(iso, 0.55, 0.55, 10);
      paintWindow(svg, win[0] - 6, win[1] - 3, lit, true);
      paintWindow(svg, win[0] + 2, win[1] - 1, lit, true);
      paintWindow(svg, win[0] + 10, win[1] + 1, lit, false);
      ladder(svg, iso, 0.12, 0.55, 0, 16);
    }
  } else if (kind === "power") {
    coolingTower(svg, iso, 0.55, 0.7, 40, 13, 7, 9, STEEL, STEEL_DARK, STEEL_LIGHT, roofed);
    coolingTower(svg, iso, 1.4, 1.2, 46, 12, 6.5, 8.5, team, STEEL_DARK, STEEL, roofed);
    rustStreak(svg, iso, 0.45, 0.7, 28, 4);
    rustStreak(svg, iso, 1.52, 1.2, 30, 6);
    isoBox(svg, iso, 0.7, 0.85, 1.75, 1.75, 0, roofed ? 12 : 8, STEEL_LIGHT, STEEL, STEEL_DARK);
    isoBox(svg, iso, 0.15, 1.35, 0.55, 1.75, 0, roofed ? 8 : 5, STEEL, STEEL_DARK, "#1a1e1a");
    if (roofed) {
      panels(svg, iso, 0.7, 0.85, 1.75, 1.75, 12, 3);
      vent(svg, iso, 1.1, 1.2, 13);
      const pipeA = pt(iso, 0.55, 0.7, 22);
      const pipeB = pt(iso, 1.4, 1.2, 24);
      svg.line(pipeA[0], pipeA[1], pipeB[0], pipeB[1], STEEL_LIGHT, 3);
      svg.line(pipeA[0], pipeA[1] - 2, pipeB[0], pipeB[1] - 2, STEEL_DARK, 1);
      svg.path(d(octagon(pipeA[0], pipeA[1], 3, 2)), STEEL, INK, 1);
      svg.path(d(octagon(pipeB[0], pipeB[1], 3, 2)), STEEL, INK, 1);
    }
    if (complete) {
      const glow = pt(iso, 1.4, 1.2, 48);
      svg.ellipse(glow[0], glow[1], 5, 3, lit ? pal.light : team);
      paintWindow(svg, pt(iso, 1.0, 1.5, 6)[0], pt(iso, 1.0, 1.5, 6)[1], lit, true);
      ladder(svg, iso, 0.7, 1.3, 0, 12);
    }
  } else if (kind === "refinery") {
    isoCyl(svg, iso, 0.55, 0.75, 0, roofed ? 32 : 16, 9, 4.5, RUST_LIGHT, RUST, STEEL_DARK);
    isoCyl(svg, iso, 1.15, 0.45, 0, roofed ? 38 : 18, 8, 4, STEEL_LIGHT, STEEL, STEEL_DARK);
    isoCyl(svg, iso, 1.7, 0.35, 0, roofed ? 44 : 20, 4, 2, roofed ? RUST : STEEL, STEEL, STEEL_DARK);
    rustStreak(svg, iso, 0.45, 0.75, 24, 2);
    isoBox(svg, iso, 1.55, 0.75, 2.85, 1.8, 0, roofed ? 14 : 8, STEEL_LIGHT, STEEL, STEEL_DARK);
    if (roofed) {
      panels(svg, iso, 1.55, 0.75, 2.85, 1.8, 14, 4);
      vent(svg, iso, 2.1, 1.1, 15);
      const belt0 = pt(iso, 1.15, 0.7, 18);
      const belt1 = pt(iso, 2.1, 1.2, 10);
      svg.line(belt0[0], belt0[1], belt1[0], belt1[1], STEEL_LIGHT, 3);
      svg.line(belt0[0], belt0[1] - 2, belt1[0], belt1[1] - 2, STEEL_DARK, 1);
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        const x = belt0[0] + (belt1[0] - belt0[0]) * t;
        const y = belt0[1] + (belt1[1] - belt0[1]) * t;
        svg.line(x - 3, y - 1, x + 3, y + 1, SOFT, 1);
      }
    }
    if (complete) {
      const door = pt(iso, 2.4, 1.5, 6);
      svg.path(d([[door[0] - 6, door[1] - 4], [door[0] + 6, door[1] - 4], [door[0] + 6, door[1] + 6], [door[0] - 6, door[1] + 6]]), lit ? "#1e2a22" : "#151814", INK, 1);
      svg.path(d([[door[0] - 6, door[1] - 6], [door[0] + 6, door[1] - 6], [door[0] + 6, door[1] - 4], [door[0] - 6, door[1] - 4]]), team);
      svg.line(door[0] - 2, door[1] - 4, door[0] - 2, door[1] + 6, STEEL, 1);
      svg.line(door[0] + 2, door[1] - 4, door[0] + 2, door[1] + 6, STEEL, 1);
      crate(svg, iso, 2.5, 0.85, 0.2, 5);
      ladder(svg, iso, 0.55, 0.95, 0, 32);
    }
  } else if (kind === "barracks") {
    gable(svg, iso, 0.1, 1.85, 0.18, 1.55, 28, STEEL_LIGHT, STEEL, STEEL_DARK, roofed);
    if (roofed) {
      isoBox(svg, iso, 0.2, 0.28, 1.75, 1.45, 26, 28, team, STEEL, STEEL_DARK);
      panels(svg, iso, 0.2, 0.28, 1.75, 1.45, 28, 5);
      vent(svg, iso, 0.9, 0.7, 29);
    }
    for (let i = 0; i < 5; i++) {
      const bag = pt(iso, 0.2 + i * 0.35, 1.55, 2);
      svg.path(d(diamond(bag[0], bag[1], 10, 5)), SAND, INK, 1);
      svg.line(bag[0] - 3, bag[1], bag[0] + 3, bag[1], "#6a5844", 1);
    }
    crate(svg, iso, 1.55, 1.35, 0.2, 5);
    if (roofed) {
      const door = pt(iso, 0.15, 0.85, 6);
      svg.path(d([[door[0] - 4, door[1] - 8], [door[0] + 4, door[1] - 8], [door[0] + 4, door[1] + 8], [door[0] - 4, door[1] + 8]]), STEEL_DARK, INK, 1);
      svg.path(d([[door[0] - 3, door[1] - 6], [door[0] + 3, door[1] - 6], [door[0] + 3, door[1] + 7], [door[0] - 3, door[1] + 7]]), INK);
      if (complete) svg.path(d([[door[0] - 2, door[1] - 4], [door[0] + 1, door[1] - 4], [door[0] + 1, door[1] + 6], [door[0] - 2, door[1] + 6]]), team);
      const pole = pt(iso, 1.65, 0.35, 0);
      const top = pt(iso, 1.65, 0.35, 34);
      svg.line(pole[0], pole[1], top[0], top[1], STEEL_DARK, 2);
      if (complete) {
        svg.path(d([[top[0], top[1]], [top[0] + 11, top[1] + 3], [top[0] + 11, top[1] + 9], [top[0], top[1] + 7]]), team, INK, 1);
        paintWindow(svg, pt(iso, 0.55, 0.35, 14)[0], pt(iso, 0.55, 0.35, 14)[1], lit, true);
        paintWindow(svg, pt(iso, 0.95, 0.38, 14)[0], pt(iso, 0.95, 0.38, 14)[1], lit, true);
        paintWindow(svg, pt(iso, 1.35, 0.42, 14)[0], pt(iso, 1.35, 0.42, 14)[1], lit, false);
      }
    }
  } else if (kind === "factory") {
    isoBox(svg, iso, 0.05, 0.15, 2.05, 1.55, 0, roofed ? 24 : 14, STEEL_LIGHT, STEEL, STEEL_DARK);
    if (roofed) {
      isoBox(svg, iso, 0.1, 0.22, 2.0, 1.48, 24, 26, team, STEEL, STEEL_DARK);
      panels(svg, iso, 0.1, 0.22, 2.0, 1.48, 26, 6);
      vent(svg, iso, 0.5, 0.5, 27);
      vent(svg, iso, 1.1, 0.7, 27);
      vent(svg, iso, 1.6, 0.9, 27);
    }
    isoCyl(svg, iso, 2.45, 0.55, 0, roofed ? 24 : 12, 5, 2.6, STEEL, STEEL_DARK, STEEL_DARK);
    isoCyl(svg, iso, 2.7, 1.15, 0, roofed ? 20 : 10, 4.5, 2.4, RUST_LIGHT, RUST, STEEL_DARK);
    rustStreak(svg, iso, 2.75, 1.15, 16, 2);
    if (roofed) {
      const boom = pt(iso, 2.2, 0.2, 34);
      const tip = pt(iso, 2.85, 0.9, 16);
      svg.line(boom[0], boom[1], tip[0], tip[1], STEEL, 2);
      svg.path(d(diamond(boom[0], boom[1], 6, 4)), BRASS, INK, 1);
    }
    if (complete) {
      const mouth = pt(iso, 2.05, 0.85, 8);
      svg.path(d([[mouth[0] - 10, mouth[1] - 8], [mouth[0] + 4, mouth[1] - 8], [mouth[0] + 4, mouth[1] + 8], [mouth[0] - 10, mouth[1] + 8]]), lit ? "#1a221c" : "#121614", STEEL_DARK, 1);
      svg.line(mouth[0] - 6, mouth[1] - 8, mouth[0] - 6, mouth[1] + 8, STEEL, 1);
      svg.line(mouth[0] - 2, mouth[1] - 8, mouth[0] - 2, mouth[1] + 8, STEEL, 1);
      svg.line(mouth[0] + 2, mouth[1] - 8, mouth[0] + 2, mouth[1] + 8, STEEL, 1);
      svg.path(d([[mouth[0] - 10, mouth[1] - 10], [mouth[0] + 4, mouth[1] - 10], [mouth[0] + 4, mouth[1] - 8], [mouth[0] - 10, mouth[1] - 8]]), team);
      crate(svg, iso, 1.7, 1.35, 0.22, 6);
      ladder(svg, iso, 0.08, 0.85, 0, 24);
    }
  } else if (kind === "turret") {
    const dir = facingVector(0);
    const c = pt(iso, 0.5, 0.5, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      svg.path(d(diamond(c[0] + Math.cos(a) * 13, c[1] + Math.sin(a) * 6.5 + 3, 9, 4)), SAND, INK, 1);
    }
    isoCyl(svg, iso, 0.5, 0.5, 0, 8, 11, 6, STEEL, STEEL_DARK, STEEL_DARK);
    crate(svg, iso, 0.02, 0.72, 0.18, 4);
    if (roofed) {
      isoCyl(svg, iso, 0.5, 0.5, 8, 16, 8, 4.5, STEEL_LIGHT, STEEL, STEEL_DARK);
      svg.path(d(octagon(c[0], c[1] - 10, 6, 3.6)), team, INK, 1);
      svg.line(c[0], c[1] - 8, c[0] + dir.x * 24, c[1] - 8 + dir.y * 24, STEEL_DARK, 3);
      svg.line(c[0], c[1] - 9, c[0] + dir.x * 22, c[1] - 9 + dir.y * 22, STEEL_LIGHT, 1);
      svg.path(d(octagon(c[0] + dir.x * 23, c[1] - 8 + dir.y * 23, 2.4, 1.8)), STEEL, INK, 1);
      svg.path(d(octagon(c[0] + dir.x * 12, c[1] - 8 + dir.y * 12, 1.8, 1.2)), STEEL_DARK, INK, 1);
    }
    if (complete) paintWindow(svg, c[0] + 4, c[1] - 14, lit, false);
  } else {
    isoBox(svg, iso, 0.35, 0.35, 1.65, 1.65, 0, 6, STEEL_DARK, "#1a1e1a", "#121412");
    isoBox(svg, iso, 0.55, 0.55, 1.45, 1.45, 6, 14, STEEL_LIGHT, STEEL, STEEL_DARK);
    isoBox(svg, iso, 0.7, 0.7, 1.3, 1.3, 14, 28, STEEL, STEEL_DARK, STEEL_DARK);
    isoBox(svg, iso, 0.82, 0.82, 1.18, 1.18, 28, 38, team, STEEL, STEEL_DARK);
    if (roofed) isoBox(svg, iso, 0.75, 0.75, 1.25, 1.25, 38, 42, GOLD, BRASS, STEEL_DARK);
    const glyph = pt(iso, 1.45, 1.0, 10);
    svg.path(d([[glyph[0] - 2, glyph[1] - 6], [glyph[0] + 2, glyph[1] - 6], [glyph[0] + 2, glyph[1] + 6], [glyph[0] - 2, glyph[1] + 6]]), team);
    if (complete) {
      const shaft = pt(iso, 1, 1, 42);
      svg.ellipse(shaft[0], shaft[1], 5, 3, lit ? "#f3dc79" : "#8a7428");
      svg.ellipse(shaft[0] - 1, shaft[1] - 1, 2, 1.2, "#fff4c4");
    }
  }
}

export function wreckSprite(kind: UnitKind, palette: Palette, options: UnitSpriteOptions = {}): SpriteSpec {
  const facing = options.facing ?? 2;
  const profile = options.profile ?? DEFAULT_PROFILE;
  const live = unitSprite(kind, palette, { ...options, facing, animationFrame: 0, profile });
  return {
    ...live,
    id: `wreck:raster-v1:${kind}:${facing}:${palette.primary}:${visualKey(profile)}`,
    imageTint: wreckTreatment(),
    imageTextureSrc: TEXTURE_ART.worn,
    imageTextureOpacity: 0.4,
    imageTextureOffset: kindOffset(kind),
  };
}

export function rubbleSprite(kind: BuildingKind, palette: Palette, options: BuildingSpriteOptions = {}): SpriteSpec {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const live = buildingSprite(kind, palette, { ...options, constructionStage: 3, profile });
  return {
    ...live,
    id: `rubble:raster-v1:${kind}:${palette.primary}:${visualKey(profile)}`,
    imageTint: rubbleTreatment(),
    imageTextureSrc: TEXTURE_ART.worn,
    imageTextureOpacity: 0.44,
    imageTextureOffset: kindOffset(kind) ^ 0x9e3779b9,
  };
}
