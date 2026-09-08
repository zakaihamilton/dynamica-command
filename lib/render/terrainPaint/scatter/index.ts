import { TILE_H } from "../../../iso";
import type { BiomeName, SurfaceKind } from "../../../types";
import { biomeMaterials } from "../../terrainAtlas";
import { propMaterialsFor, type BiomeMaterials } from "../../terrainMaterials";
import { terrainPropLightFactor } from "../../terrainLighting";
import type { ScatterItem, ScatterWorld } from "./types";
import { scatterForTile } from "./distribution";
import {
  drawCinder,
  drawCrystalChip,
  drawDebris,
  drawIceChip,
  drawLandmark,
  drawPebble,
  drawPebbleCluster,
  drawReed,
  drawShrub,
  drawTuft,
} from "./render";

export * from "./types";
export * from "./distribution";
export * from "./render";

function paintItem(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  biome: BiomeName,
  item: ScatterItem,
  z: number,
): void {
  ctx.save();
  ctx.translate(item.ox * z, item.oy * z);
  switch (item.kind) {
    case "pebble":
      drawPebble(ctx, mats, z, item.scale, item.variant);
      break;
    case "pebbleCluster":
      drawPebbleCluster(ctx, mats, z, item.scale, item.variant);
      break;
    case "tuft":
      drawTuft(ctx, mats, z, item.scale, item.variant);
      break;
    case "shrub":
      drawShrub(ctx, mats, z, item.scale, item.variant);
      break;
    case "debris":
      drawDebris(ctx, mats, z, item.scale, item.variant);
      break;
    case "crystalChip":
      drawCrystalChip(ctx, mats, z, item.scale, item.variant);
      break;
    case "reed":
      drawReed(ctx, mats, z, item.scale, item.variant);
      break;
    case "cinder":
      drawCinder(ctx, mats, z, item.scale, item.variant);
      break;
    case "iceChip":
      drawIceChip(ctx, mats, z, item.scale, item.variant);
      break;
    case "landmark":
      drawLandmark(ctx, mats, biome, z, item.scale, item.variant);
      break;
  }
  ctx.restore();
}

export function drawTerrainScatter(
  ctx: CanvasRenderingContext2D,
  state: ScatterWorld,
  x: number,
  y: number,
  sx: number,
  sy: number,
  z: number,
  tileKind?: number,
  surface?: SurfaceKind,
): void {
  const items = scatterForTile(state, x, y, tileKind, surface);
  if (items.length === 0) return;
  const mats = propMaterialsFor(biomeMaterials(state.biome));
  ctx.save();
  const light = terrainPropLightFactor(state, x, y);
  ctx.globalAlpha *= Math.max(0.82, Math.min(1.02, 0.9 + (light - 0.9) * 0.42));
  ctx.translate(sx, sy + TILE_H * z * 0.42);
  for (const item of items) paintItem(ctx, mats, state.biome, item, z);
  ctx.restore();
}
