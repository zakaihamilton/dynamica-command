import type { BiomeName, BuildingKind, Facing, SpriteCrop, UnitKind } from "../types";

export type RasterArtKey = "menu" | "victory" | "defeat" | BiomeName;
export type TextureArtKey = "brushed" | "worn" | "crt";

/**
 * Pre-rendered tactical sprites are deliberately kept separate from the UI and
 * scene art. They are loaded into the canvas renderer at runtime, preserving
 * the existing simulation-facing sprite dimensions and anchors.
 */
export const SPRITE_ART: Record<BuildingKind, string> = {
  constructionYard: "/art/sprites/sleek-modular/construction-yard-v2.webp",
  power: "/art/sprites/sleek-modular/power-v2.webp",
  refinery: "/art/sprites/sleek-modular/refinery-v2.webp",
  barracks: "/art/sprites/sleek-modular/barracks-v2.webp",
  factory: "/art/sprites/sleek-modular/factory-v2.webp",
  turret: "/art/sprites/sleek-modular/turret-v2.webp",
  objective: "/art/sprites/sleek-modular/objective-v2.webp",
};


export type UnitView =
  | "right"
  | "front-right"
  | "front"
  | "front-left"
  | "left"
  | "back-left"
  | "back"
  | "back-right";

export const UNIT_DIRECTION_ART: Partial<Record<UnitKind, Record<UnitView, string>>> = {
  harvester: {
    "front-right": "/art/sprites/sleek-modular/harvester-front-right-v1.webp",
    front: "/art/sprites/sleek-modular/harvester-front.webp",
    right: "/art/sprites/sleek-modular/harvester-right-v2.webp",
    "front-left": "/art/sprites/sleek-modular/harvester-front-left-v1.webp",
    "back-left": "/art/sprites/sleek-modular/harvester-back-left-v1.webp",
    back: "/art/sprites/sleek-modular/harvester-back.webp",
    left: "/art/sprites/sleek-modular/harvester-left-v2.webp",
    "back-right": "/art/sprites/sleek-modular/harvester-back-right-v1.webp",
  },
  infantry: {
    "front-right": "/art/sprites/sleek-modular/infantry-front-right-v1.webp",
    front: "/art/sprites/sleek-modular/infantry-front-v1.webp",
    right: "/art/sprites/sleek-modular/infantry-right-v1.webp",
    "front-left": "/art/sprites/sleek-modular/infantry-front-left-v1.webp",
    "back-left": "/art/sprites/sleek-modular/infantry-back-left-v1.webp",
    back: "/art/sprites/sleek-modular/infantry-back-v1.webp",
    left: "/art/sprites/sleek-modular/infantry-left-v1.webp",
    "back-right": "/art/sprites/sleek-modular/infantry-back-right-v1.webp",
  },
  antiArmor: {
    "front-right": "/art/sprites/sleek-modular/anti-armor-front-right-v1.webp",
    front: "/art/sprites/sleek-modular/anti-armor-front.webp",
    right: "/art/sprites/sleek-modular/anti-armor-right.webp",
    "front-left": "/art/sprites/sleek-modular/anti-armor-front-left-v1.webp",
    "back-left": "/art/sprites/sleek-modular/anti-armor-back-left-v1.webp",
    back: "/art/sprites/sleek-modular/anti-armor-back.webp",
    left: "/art/sprites/sleek-modular/anti-armor-left.webp",
    "back-right": "/art/sprites/sleek-modular/anti-armor-back-right-v1.webp",
  },
  tank: {
    "front-right": "/art/sprites/sleek-modular/tank-front-right-v1.webp",
    front: "/art/sprites/sleek-modular/tank-front.webp",
    right: "/art/sprites/sleek-modular/tank-right.webp",
    "front-left": "/art/sprites/sleek-modular/tank-front-left-v1.webp",
    "back-left": "/art/sprites/sleek-modular/tank-back-left-v1.webp",
    back: "/art/sprites/sleek-modular/tank-back.webp",
    left: "/art/sprites/sleek-modular/tank-left.webp",
    "back-right": "/art/sprites/sleek-modular/tank-back-right-v1.webp",
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
  modular: "/art/terrain/modular-v1.webp",
  armored: "/art/terrain/armored-v1.webp",
  expeditionary: "/art/terrain/expeditionary-v1.webp",
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

export function listTacticalRasterSources(): string[] {
  const srcs = [...Object.values(SPRITE_ART)];
  for (const views of Object.values(UNIT_DIRECTION_ART)) {
    srcs.push(...Object.values(views));
  }
  return srcs;
}
