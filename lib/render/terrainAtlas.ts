import type { BiomeName } from "../types";
import {
  atlasRectForTile,
  BIOME_MATERIALS,
  clampByte,
  type Rgb,
  type TerrainAtlasData,
} from "./terrainAtlasShared";

export {
  ATLAS_CELL,
  TERRAIN_ATLAS_REV,
  ORE_GLINT_RIDGE,
  ORE_CRYSTAL_MIN_AMOUNT,
  CONCRETE_STEEL,
  CONCRETE_STEEL_LIGHT,
  CONCRETE_STEEL_DARK,
  atlasRectForTile,
  biomeMaterials,
  fogTerrainGain,
  sampleTerrainMaterial,
  tileVariant,
  waterShoreDist,
  type AtlasWorld,
  type TerrainAtlas,
  type TerrainAtlasData,
  type TerrainSample,
} from "./terrainAtlasShared";
export {
  ORE_VEIN_PROBES,
  oreCrystalCluster,
  oreShardCount,
  oreVeinAt,
  oreVeinPeak,
  type OreBurstOrigin,
  type OreCrystalCluster,
  type OreShardPose,
  type OreVeinPeak,
  type OreVeinSample,
} from "./terrainOre";
export {
  bakeTerrainAtlasData,
  getTerrainAtlas,
  invalidateTerrainAtlas,
  resourceSignature,
  terrainAtlasKey,
  terrainGrainGeneration,
} from "./terrainAtlasBake";

export function atlasPixelAtTile(atlas: TerrainAtlasData, tileX: number, tileY: number): [number, number, number] {
  const rect = atlasRectForTile(tileX, tileY, atlas.mapWidth);
  const px = Math.min(atlas.width - 1, Math.max(0, rect.sx + (rect.sw >> 1)));
  const py = Math.min(atlas.height - 1, Math.max(0, rect.sy + (rect.sh >> 1)));
  const i = (py * atlas.width + px) * 4;
  return [atlas.data[i] ?? 0, atlas.data[i + 1] ?? 0, atlas.data[i + 2] ?? 0];
}

export function terrainColors(biome: BiomeName): {
  low: string;
  mid: string;
  high: string;
  water: string;
  road: string;
  concrete: string;
  blocked: string;
} {
  const mats = BIOME_MATERIALS[biome];
  const hex = (c: Rgb) => `#${[c.r, c.g, c.b].map((n) => clampByte(n).toString(16).padStart(2, "0")).join("")}`;
  return {
    low: hex(mats.low),
    mid: hex(mats.mid),
    high: hex(mats.high),
    water: hex(mats.waterDeep),
    road: hex(mats.road),
    concrete: hex(mats.concrete),
    blocked: hex(mats.blocked),
  };
}
