export { isoDiamondPath } from "./isoDiamond";
export { paintShroudCliffs, paintShroudMaskTile, paintShroudOverlay, drawAtlasDiamond } from "./terrainPaint/tile";
export { smoothFogGain, drawBlockerProp, rgbMix, drawOreCrystals } from "./terrainPaint/details";
export {
  scatterForTile,
  blockerPropKind,
  drawTerrainScatter,
  LUSH_SCATTER,
  ARID_SCATTER,
} from "./terrainPaint/scatter";
export type { ScatterKind, ScatterItem, BlockerPropKind } from "./terrainPaint/scatter";
export { withAlpha } from "./terrainPaint/style";
export { visibleTileRange, paintTerrainWorld, WATER_COVER } from "./terrainPaint/world";
export { paintBuildingPlates } from "./terrainPlates";
