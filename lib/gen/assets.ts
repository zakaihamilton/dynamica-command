import { BUILDING_STATS } from "../catalog";
import type { BuildingKind, Palette, ShapeSpec, SpriteSpec, UnitKind } from "../types";

const TW = 64;
const TH = 32;

function poly(points: number[], fill: string, stroke?: string, strokeWidth = 1.25): ShapeSpec {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    type: "poly",
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y,
    fill,
    stroke,
    strokeWidth,
    points,
  };
}

function ell(x: number, y: number, w: number, h: number, fill: string, stroke?: string): ShapeSpec {
  return { type: "ellipse", x, y, w, h, fill, stroke, strokeWidth: stroke ? 1.2 : undefined };
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

function tileHash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return (x ^ (x >>> 16)) >>> 0;
}

export function tileSprite(
  kind: "clear" | "water" | "resource",
  elev = 1,
  variant = 0,
): SpriteSpec {
  const palettes: Record<string, Palette> = {
    clear: {
      primary: elev >= 3 ? "hsl(32 12% 38%)" : elev === 2 ? "hsl(95 22% 36%)" : elev <= 0 ? "hsl(118 24% 26%)" : "hsl(110 30% 32%)",
      secondary: elev >= 3 ? "hsl(28 10% 26%)" : elev === 2 ? "hsl(90 18% 24%)" : elev <= 0 ? "hsl(125 22% 18%)" : "hsl(110 22% 22%)",
      accent: elev >= 3 ? "hsl(0 0% 72%)" : "hsl(90 32% 44%)",
      outline: "#16140f",
      light: elev >= 3 ? "hsl(40 8% 52%)" : "hsl(108 28% 46%)",
      dark: elev >= 3 ? "hsl(24 12% 16%)" : "hsl(120 20% 14%)",
    },
    water: {
      primary: "hsl(206 58% 30%)",
      secondary: "hsl(214 52% 18%)",
      accent: "hsl(188 62% 48%)",
      outline: "#071420",
      light: "hsl(198 50% 52%)",
      dark: "hsl(220 48% 12%)",
    },
    resource: {
      primary: elev >= 2 ? "hsl(145 48% 24%)" : "hsl(145 70% 26%)",
      secondary: "hsl(150 55% 14%)",
      accent: "hsl(82 85% 52%)",
      outline: "#0c1c0c",
      light: "hsl(88 75% 58%)",
      dark: "hsl(140 48% 10%)",
    },
  };
  const p = palettes[kind]!;
  const v = tileHash(variant + elev * 17);
  const w = TW;
  const h = TH;
  const cx = w / 2;
  const cy = h / 2;
  const shapes: ShapeSpec[] = [
    poly(diamondPts(cx, cy, w - 1, h - 1), p.primary, p.outline, 1.4),
    poly(diamondPts(cx - 6, cy - 2, w * 0.42, h * 0.42), p.light, undefined, 0),
    poly(diamondPts(cx + 8, cy + 3, w * 0.38, h * 0.36), p.secondary, undefined, 0),
  ];

  if (kind === "water") {
    const phase = (v % 5) * 3;
    shapes.push(poly(diamondPts(cx - 8 + phase * 0.2, cy - 1, 22, 8), p.accent));
    shapes.push(poly(diamondPts(cx + 10, cy + 4, 16, 6), p.light));
    shapes.push(poly(diamondPts(cx, cy + 2, 28, 7), p.secondary));
  } else if (kind === "resource") {
    const crystals = [
      [cx - 8, cy - 4, 7, 11],
      [cx + 2, cy - 6, 6, 13],
      [cx + 10, cy - 1, 5, 9],
      [cx - 2, cy + 2, 6, 8],
    ];
    for (const [x, y, cw, ch] of crystals) {
      shapes.push(poly([x!, y! + ch!, x! + cw! / 2, y!, x! + cw!, y! + ch!], p.accent, p.outline, 1));
      shapes.push(line(x! + cw! * 0.35, y! + 2, x! + cw! * 0.35, y! + ch! * 0.55, p.light, 1));
    }
  } else if (elev >= 3) {
    shapes.push(poly(diamondPts(cx - 4, cy, 18, 8), p.secondary));
    shapes.push(ell(cx + 6, cy - 4, 8, 5, p.accent));
    shapes.push(ell(cx - 10, cy + 2, 7, 4, p.dark));
    if (v % 3 === 0) shapes.push(ell(cx + 2, cy - 6, 10, 4, "#e8e4dc"));
  } else if (elev === 2) {
    shapes.push(ell(cx - 10, cy, 6, 3, p.dark));
    shapes.push(ell(cx + 8, cy + 3, 7, 3, p.secondary));
    shapes.push(poly(diamondPts(cx + 2, cy - 3, 10, 5), p.light));
  } else {
    const tufts = 2 + (v % 3);
    for (let i = 0; i < tufts; i++) {
      const ox = ((v >> (i * 3)) % 17) - 8;
      const oy = ((v >> (i * 2 + 1)) % 7) - 3;
      shapes.push(ell(cx + ox, cy + oy, 5, 3, i % 2 ? p.accent : p.light));
    }
  }

  return {
    id: `tile:${kind}:${elev}:${variant}`,
    kind: "tile",
    w,
    h,
    palette: p,
    shapes,
  };
}

export function unitSprite(kind: UnitKind, palette: Palette): SpriteSpec {
  const w = 52;
  const h = 44;
  const o = palette.outline;
  const shadow = ell(10, 30, 32, 10, "rgba(0,0,0,0.38)");
  const body: Record<UnitKind, ShapeSpec[]> = {
    harvester: [
      shadow,
      ell(8, 26, 14, 8, o),
      ell(30, 26, 14, 8, o),
      ell(9, 27, 12, 6, palette.dark),
      ell(31, 27, 12, 6, palette.dark),
      poly([10, 22, 42, 16, 44, 28, 12, 32], palette.secondary, o, 1.4),
      poly([12, 20, 38, 14, 40, 24, 14, 28], palette.primary, o, 1.2),
      rec(28, 10, 16, 12, palette.light, o),
      rec(32, 8, 8, 6, palette.accent, o),
      rec(40, 18, 8, 5, palette.dark, o),
      ell(14, 18, 8, 6, palette.accent),
    ],
    infantry: [
      shadow,
      ell(18, 32, 10, 5, palette.dark),
      rec(20, 28, 5, 8, palette.secondary, o),
      rec(26, 28, 5, 8, palette.secondary, o),
      rec(19, 16, 14, 14, palette.primary, o),
      ell(21, 6, 12, 12, palette.light, o),
      rec(22, 5, 10, 4, palette.dark),
      rec(32, 18, 14, 3, o),
      rec(32, 17, 13, 2, palette.accent),
    ],
    antiArmor: [
      shadow,
      rec(19, 28, 6, 8, palette.secondary, o),
      rec(26, 28, 6, 8, palette.secondary, o),
      rec(17, 16, 18, 14, palette.primary, o),
      ell(20, 6, 12, 12, palette.light, o),
      rec(22, 4, 10, 5, palette.dark),
      rec(30, 14, 18, 5, palette.secondary, o),
      rec(42, 12, 6, 8, palette.accent, o),
    ],
    tank: [
      shadow,
      rec(6, 24, 40, 10, o),
      rec(7, 25, 38, 8, palette.dark),
      poly([8, 22, 44, 18, 46, 30, 10, 34], palette.secondary, o, 1.5),
      poly([12, 20, 40, 16, 42, 26, 14, 30], palette.primary, o, 1.2),
      ell(16, 12, 20, 14, palette.primary, o),
      rec(28, 14, 20, 5, palette.accent, o),
      rec(46, 13, 4, 6, palette.dark),
    ],
  };
  return {
    id: `unit:${kind}:${palette.primary}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes: body[kind],
    anchorX: w / 2,
    anchorY: 34,
  };
}

function isoStructure(
  fw: number,
  fh: number,
  rise: number,
  pal: Palette,
): { w: number; h: number; shapes: ShapeSpec[]; roof: { n: number[]; e: number[]; s: number[]; w: number[] } } {
  const gw = (fw + fh) * (TW / 2);
  const gh = (fw + fh) * (TH / 2);
  const pad = 2;
  const w = gw + pad * 2;
  const h = rise + gh + pad * 2;
  const N = [w / 2, pad] as const;
  const E = [w - pad, pad + gh / 2] as const;
  const S = [w / 2, pad + gh] as const;
  const Ww = [pad, pad + gh / 2] as const;
  const Ng = [N[0], N[1] + rise];
  const Eg = [E[0], E[1] + rise];
  const Sg = [S[0], S[1] + rise];
  const Wg = [Ww[0], Ww[1] + rise];
  const roofN = [...N];
  const roofE = [...E];
  const roofS = [...S];
  const roofW = [...Ww];
  const shapes: ShapeSpec[] = [
    poly([Ng[0], Ng[1], Eg[0], Eg[1], Sg[0], Sg[1], Wg[0], Wg[1]], pal.dark, pal.outline, 1.2),
    poly([Ww[0], Ww[1], S[0], S[1], Sg[0], Sg[1], Wg[0], Wg[1]], pal.secondary, pal.outline, 1.2),
    poly([E[0], E[1], S[0], S[1], Sg[0], Sg[1], Eg[0], Eg[1]], pal.primary, pal.outline, 1.2),
    poly([N[0], N[1], E[0], E[1], S[0], S[1], Ww[0], Ww[1]], pal.light, pal.outline, 1.6),
  ];
  return {
    w,
    h,
    shapes,
    roof: { n: roofN, e: roofE, s: roofS, w: roofW },
  };
}

export function buildingSprite(kind: BuildingKind, palette: Palette): SpriteSpec {
  const fp = BUILDING_STATS[kind].footprint;
  const rise = kind === "turret" ? 22 : 28 + fp.w * 6;
  const box = isoStructure(fp.w, fp.h, rise, palette);
  const { w, h, roof } = box;
  const shapes = [...box.shapes];
  const mx = (roof.n[0]! + roof.s[0]!) / 2;
  const my = (roof.n[1]! + roof.s[1]!) / 2;

  if (kind === "constructionYard") {
    shapes.push(poly([mx - 18, my + 4, mx + 18, my - 6, mx + 14, my + 10, mx - 14, my + 16], palette.secondary, palette.outline));
    shapes.push(rec(mx - 4, my - 22, 6, 28, palette.dark, palette.outline));
    shapes.push(rec(mx + 2, my - 18, 22, 5, palette.accent, palette.outline));
    shapes.push(ell(mx - 16, my + 6, 10, 6, palette.accent));
  } else if (kind === "power") {
    shapes.push(ell(mx - 16, my - 8, 22, 20, palette.accent, palette.outline));
    shapes.push(ell(mx - 12, my - 6, 10, 8, palette.light));
    shapes.push(rec(mx + 8, my - 4, 10, 18, palette.secondary, palette.outline));
    shapes.push(ell(mx + 8, my - 12, 10, 10, "#d9e8ff"));
  } else if (kind === "refinery") {
    shapes.push(ell(mx - 22, my - 6, 14, 22, palette.secondary, palette.outline));
    shapes.push(ell(mx - 6, my - 10, 14, 26, palette.dark, palette.outline));
    shapes.push(rec(mx + 10, my - 2, 18, 12, palette.primary, palette.outline));
    shapes.push(rec(mx + 22, my - 16, 6, 20, palette.accent, palette.outline));
  } else if (kind === "barracks") {
    shapes.push(rec(mx - 20, my - 4, 12, 10, palette.dark, palette.outline));
    shapes.push(rec(mx - 4, my - 4, 12, 10, palette.dark, palette.outline));
    shapes.push(rec(mx + 12, my - 4, 12, 10, palette.dark, palette.outline));
    shapes.push(rec(mx - 18, my - 2, 6, 5, palette.accent));
    shapes.push(rec(mx + 2, my - 2, 6, 5, palette.accent));
  } else if (kind === "factory") {
    shapes.push(poly([mx - 28, my + 2, mx + 8, my - 12, mx + 4, my + 8, mx - 24, my + 16], palette.secondary, palette.outline));
    shapes.push(rec(mx + 6, my - 14, 12, 16, palette.dark, palette.outline));
    shapes.push(rec(mx + 20, my - 14, 12, 16, palette.dark, palette.outline));
    shapes.push(rec(mx - 10, my + 4, 16, 6, palette.accent, palette.outline));
  } else if (kind === "turret") {
    shapes.push(ell(mx - 12, my - 4, 24, 16, palette.primary, palette.outline));
    shapes.push(ell(mx - 8, my - 2, 16, 10, palette.secondary, palette.outline));
    shapes.push(rec(mx + 4, my - 6, 22, 5, palette.accent, palette.outline));
    shapes.push(ell(mx - 4, my - 8, 8, 6, palette.light));
  } else {
    shapes.push(poly([mx - 10, my + 6, mx, my - 16, mx + 10, my + 6], "#f5d76e", palette.outline, 1.5));
    shapes.push(ell(mx - 8, my - 4, 16, 12, palette.light, palette.outline));
    shapes.push(ell(mx - 4, my - 18, 8, 8, "#ffe566"));
  }

  const gh = (fp.w + fp.h) * (TH / 2);
  return {
    id: `bld:${kind}:${fp.w}x${fp.h}:${palette.primary}`,
    kind: "building",
    w,
    h,
    palette,
    shapes,
    anchorX: w / 2,
    anchorY: h - 2 - gh / 2,
  };
}
