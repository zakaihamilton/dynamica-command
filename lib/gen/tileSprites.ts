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
import { hash, mixHex, pick, signed, ORE, terrainPalette, terrainZonePalette } from "./tilePalette";
import { paintBiomeLandmark, paintBiomeSignature, pushBush } from "./tileDecor";

const TW = 64;
const TH = 32;
export const TILE_SPRITE_PAD_X = 4;
export const TILE_SPRITE_PAD_Y = 4;
const SPRITE_W = TW + TILE_SPRITE_PAD_X * 2;
const SPRITE_H = TH + TILE_SPRITE_PAD_Y * 2;
const INK = "#202a32";
const ART_PIXEL_SCALE = 1;
const TERRAIN_ART_REV = "tactical-surface-v8-water-basin";

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
  // Oversized fills bridge neighboring water cells so lakes read as one basin.
  shapes.push(poly(irregularIso(cx, cy, 108, 54, v, 2), deep));
  shapes.push(poly(irregularIso(cx, cy - 1, 96, 46, v, 2), mixHex(deep, mid, 0.55)));
  const flow = signed(v, 72, 6);
  for (let i = 0; i < 2; i++) {
    const y = cy - 6 + i * 8 + signed(v, 73 + i, 1);
    const x = cx - 18 + i * 10 + flow;
    shapes.push(line(x, y, x + 16, y + 5, i === 0 ? mixHex(mid, hi, 0.45) : hi, 1));
  }
  if (mask) paintBanks(shapes, biome, mask, v);
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
