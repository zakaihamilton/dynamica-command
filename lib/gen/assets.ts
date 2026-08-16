import type { BuildingKind, Palette, ShapeSpec, SpriteSpec, UnitKind } from "../types";

function diamond(cx: number, cy: number, w: number, h: number, fill: string): ShapeSpec {
  return {
    type: "poly",
    x: cx,
    y: cy,
    w,
    h,
    fill,
    points: [cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy],
  };
}

export function tileSprite(kind: "clear" | "water" | "resource", biomeShift = 0): SpriteSpec {
  const palettes: Record<string, Palette> = {
    clear: {
      primary: `hsl(${110 + biomeShift} 28% 34%)`,
      secondary: `hsl(${110 + biomeShift} 22% 24%)`,
      accent: `hsl(${90 + biomeShift} 30% 42%)`,
      outline: "#1a1f14",
      light: `hsl(${110 + biomeShift} 25% 48%)`,
      dark: `hsl(${110 + biomeShift} 20% 16%)`,
    },
    water: {
      primary: "hsl(210 55% 32%)",
      secondary: "hsl(210 50% 22%)",
      accent: "hsl(195 60% 45%)",
      outline: "#0b1a28",
      light: "hsl(205 50% 48%)",
      dark: "hsl(215 50% 16%)",
    },
    resource: {
      primary: "hsl(145 70% 28%)",
      secondary: "hsl(150 60% 18%)",
      accent: "hsl(85 80% 50%)",
      outline: "#10240f",
      light: "hsl(90 70% 48%)",
      dark: "hsl(140 50% 12%)",
    },
  };
  const p = palettes[kind]!;
  const w = 64;
  const h = 32;
  return {
    id: `tile:${kind}`,
    kind: "tile",
    w,
    h,
    palette: p,
    shapes: [
      diamond(w / 2, h / 2, w - 2, h - 2, p.primary),
      diamond(w / 2, h / 2 + 2, w - 18, h - 12, p.secondary),
      ...(kind === "resource"
        ? [
            { type: "ellipse" as const, x: 28, y: 10, w: 8, h: 6, fill: p.accent },
            { type: "ellipse" as const, x: 36, y: 16, w: 6, h: 5, fill: p.light },
          ]
        : []),
    ],
  };
}

export function unitSprite(kind: UnitKind, palette: Palette): SpriteSpec {
  const w = 40;
  const h = 36;
  const body: Record<UnitKind, ShapeSpec[]> = {
    harvester: [
      { type: "rect", x: 8, y: 14, w: 24, h: 14, fill: palette.primary },
      { type: "rect", x: 26, y: 10, w: 10, h: 10, fill: palette.accent },
      { type: "ellipse", x: 10, y: 24, w: 8, h: 6, fill: palette.dark },
      { type: "ellipse", x: 22, y: 24, w: 8, h: 6, fill: palette.dark },
    ],
    infantry: [
      { type: "ellipse", x: 14, y: 6, w: 12, h: 12, fill: palette.light },
      { type: "rect", x: 15, y: 16, w: 10, h: 12, fill: palette.primary },
      { type: "rect", x: 24, y: 18, w: 8, h: 3, fill: palette.outline },
    ],
    antiArmor: [
      { type: "ellipse", x: 13, y: 8, w: 12, h: 10, fill: palette.light },
      { type: "rect", x: 12, y: 16, w: 16, h: 12, fill: palette.secondary },
      { type: "rect", x: 22, y: 14, w: 12, h: 4, fill: palette.accent },
    ],
    tank: [
      { type: "rect", x: 6, y: 16, w: 28, h: 12, fill: palette.secondary },
      { type: "ellipse", x: 12, y: 10, w: 16, h: 12, fill: palette.primary },
      { type: "rect", x: 20, y: 12, w: 16, h: 5, fill: palette.accent },
    ],
  };
  return {
    id: `unit:${kind}:${palette.primary}`,
    kind: "unit",
    w,
    h,
    palette,
    shapes: body[kind],
  };
}

export function buildingSprite(kind: BuildingKind, palette: Palette): SpriteSpec {
  const w = 56;
  const h = 48;
  const extras: Record<BuildingKind, ShapeSpec[]> = {
    constructionYard: [
      diamond(28, 30, 48, 24, palette.secondary),
      { type: "rect", x: 14, y: 8, w: 28, h: 22, fill: palette.primary },
      { type: "rect", x: 22, y: 4, w: 12, h: 8, fill: palette.accent },
    ],
    power: [
      diamond(28, 30, 40, 20, palette.dark),
      { type: "rect", x: 18, y: 10, w: 20, h: 20, fill: palette.primary },
      { type: "ellipse", x: 22, y: 4, w: 12, h: 10, fill: palette.accent },
    ],
    refinery: [
      diamond(28, 32, 50, 22, palette.secondary),
      { type: "rect", x: 10, y: 10, w: 36, h: 20, fill: palette.primary },
      { type: "rect", x: 38, y: 6, w: 8, h: 16, fill: palette.light },
    ],
    barracks: [
      diamond(28, 32, 44, 20, palette.dark),
      { type: "rect", x: 12, y: 12, w: 32, h: 18, fill: palette.primary },
      { type: "rect", x: 16, y: 8, w: 8, h: 6, fill: palette.outline },
    ],
    factory: [
      diamond(28, 32, 52, 22, palette.secondary),
      { type: "rect", x: 8, y: 10, w: 40, h: 20, fill: palette.primary },
      { type: "rect", x: 12, y: 4, w: 10, h: 10, fill: palette.dark },
      { type: "rect", x: 34, y: 4, w: 10, h: 10, fill: palette.dark },
    ],
    turret: [
      diamond(28, 30, 28, 16, palette.dark),
      { type: "ellipse", x: 18, y: 12, w: 20, h: 16, fill: palette.primary },
      { type: "rect", x: 26, y: 6, w: 16, h: 5, fill: palette.accent },
    ],
    objective: [
      diamond(28, 30, 40, 20, palette.accent),
      { type: "rect", x: 16, y: 10, w: 24, h: 18, fill: palette.light },
      { type: "ellipse", x: 22, y: 4, w: 12, h: 10, fill: "#f5d76e" },
    ],
  };
  return {
    id: `bld:${kind}:${palette.primary}`,
    kind: "building",
    w,
    h,
    palette,
    shapes: extras[kind],
  };
}
