import type { BiomeName } from "../types";

export type RasterArtKey = "menu" | "victory" | "defeat" | BiomeName;
export type TextureArtKey = "brushed" | "worn" | "crt";

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
