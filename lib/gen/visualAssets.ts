import type { BiomeName, Facing, SpriteCrop, UnitKind } from "../types";

export type RasterArtKey = "menu" | "victory" | "defeat" | BiomeName;
export type TextureArtKey = "brushed" | "worn" | "crt";

/**
 * Pre-rendered tactical sprites are deliberately kept separate from the UI and
 * scene art. They are loaded into the canvas renderer at runtime, preserving
 * the existing simulation-facing sprite dimensions and anchors.
 */
export const SPRITE_ART = {
  constructionYard: "/art/sprites/sleek-modular/construction-yard-v2.png",
  power: "/art/sprites/sleek-modular/power-v2.png",
  refinery: "/art/sprites/sleek-modular/refinery-v2.png",
  barracks: "/art/sprites/sleek-modular/barracks-v2.png",
  factory: "/art/sprites/sleek-modular/factory-v2.png",
  turret: "/art/sprites/sleek-modular/turret-v2.png",
  objective: "/art/sprites/sleek-modular/objective-v2.png",
  harvester: "/art/sprites/sleek-modular/harvester-v2.png",
  infantry: "/art/sprites/sleek-modular/infantry-single-v1.png",
  antiArmor: "/art/sprites/sleek-modular/anti-armor-single-v1.png",
  tank: "/art/sprites/sleek-modular/tank-v2.png",
} as const;

export type UnitView =
  | "right"
  | "front-right"
  | "front"
  | "front-left"
  | "left"
  | "back-left"
  | "back"
  | "back-right";

export const UNIT_DIRECTION_ART: Record<UnitKind, Record<UnitView, string>> = {
  harvester: {
    "front-right": "/art/sprites/sleek-modular/harvester-front-right-v1.png",
    front: "/art/sprites/sleek-modular/harvester-front.png",
    right: "/art/sprites/sleek-modular/harvester-right-v2.png",
    "front-left": "/art/sprites/sleek-modular/harvester-front-left-v1.png",
    "back-left": "/art/sprites/sleek-modular/harvester-back-left-v1.png",
    back: "/art/sprites/sleek-modular/harvester-back.png",
    left: "/art/sprites/sleek-modular/harvester-left-v2.png",
    "back-right": "/art/sprites/sleek-modular/harvester-back-right-v1.png",
  },
  infantry: {
    "front-right": "/art/sprites/sleek-modular/infantry-front-right-v1.png",
    front: "/art/sprites/sleek-modular/infantry-front-v1.png",
    right: "/art/sprites/sleek-modular/infantry-right-v1.png",
    "front-left": "/art/sprites/sleek-modular/infantry-front-left-v1.png",
    "back-left": "/art/sprites/sleek-modular/infantry-back-left-v1.png",
    back: "/art/sprites/sleek-modular/infantry-back-v1.png",
    left: "/art/sprites/sleek-modular/infantry-left-v1.png",
    "back-right": "/art/sprites/sleek-modular/infantry-back-right-v1.png",
  },
  antiArmor: {
    "front-right": "/art/sprites/sleek-modular/anti-armor-front-right-v1.png",
    front: "/art/sprites/sleek-modular/anti-armor-front.png",
    right: "/art/sprites/sleek-modular/anti-armor-right.png",
    "front-left": "/art/sprites/sleek-modular/anti-armor-front-left-v1.png",
    "back-left": "/art/sprites/sleek-modular/anti-armor-back-left-v1.png",
    back: "/art/sprites/sleek-modular/anti-armor-back.png",
    left: "/art/sprites/sleek-modular/anti-armor-left.png",
    "back-right": "/art/sprites/sleek-modular/anti-armor-back-right-v1.png",
  },
  tank: {
    "front-right": "/art/sprites/sleek-modular/tank-front-right-v1.png",
    front: "/art/sprites/sleek-modular/tank-front.png",
    right: "/art/sprites/sleek-modular/tank-right.png",
    "front-left": "/art/sprites/sleek-modular/tank-front-left-v1.png",
    "back-left": "/art/sprites/sleek-modular/tank-back-left-v1.png",
    back: "/art/sprites/sleek-modular/tank-back.png",
    left: "/art/sprites/sleek-modular/tank-left.png",
    "back-right": "/art/sprites/sleek-modular/tank-back-right-v1.png",
  },
};

/** Generated direction sheets contain a few neighboring partial renders at the edge. */
export const UNIT_DIRECTION_CROPS: Partial<Record<UnitKind, Partial<Record<UnitView, SpriteCrop>>>> = {
  harvester: {
    front: { x: 0, y: 0, w: 535, h: 580, sourceW: 627, sourceH: 580 },
    back: { x: 0, y: 0, w: 535, h: 588, sourceW: 627, sourceH: 588 },
  },
  tank: {
    front: { x: 0, y: 0, w: 555, h: 502, sourceW: 683, sourceH: 502 },
    back: { x: 0, y: 0, w: 565, h: 511, sourceW: 687, sourceH: 511 },
  },
};

export function unitViewForFacing(facing: Facing): UnitView {
  if (facing === 0) return "right";
  if (facing === 1) return "front-right";
  if (facing === 2) return "front";
  if (facing === 3) return "front-left";
  if (facing === 4) return "left";
  if (facing === 5) return "back-left";
  if (facing === 6) return "back";
  return "back-right";
}

export const TERRAIN_ART = {
  modular: "/art/terrain/modular-v1.png",
  armored: "/art/terrain/armored-v1.png",
  expeditionary: "/art/terrain/expeditionary-v1.png",
} as const;

export const RASTER_ART: Record<RasterArtKey, string> = {
  menu: "/art/menu-command-vista.webp",
  victory: "/art/results/victory.webp",
  defeat: "/art/results/defeat.webp",
  "ash plains": "/art/biomes/ash-plains.webp",
  "crystal flats": "/art/biomes/crystal-flats.webp",
  "rust canyons": "/art/biomes/rust-canyons.webp",
  "salt marshes": "/art/biomes/salt-marshes.webp",
  "glass desert": "/art/biomes/glass-desert.webp",
  "tundra grid": "/art/biomes/tundra-grid.webp",
  "jungle wreckage": "/art/biomes/jungle-wreckage.webp",
  "volcanic shelf": "/art/biomes/volcanic-shelf.webp",
};

export const TEXTURE_ART: Record<TextureArtKey, string> = {
  brushed: "/art/textures/brushed-gunmetal.webp",
  worn: "/art/textures/worn-panel.webp",
  crt: "/art/textures/crt-glass.webp",
};

export function biomeArt(biome: BiomeName): string {
  return RASTER_ART[biome];
}
