import { tileCliffGeometry } from "../../gen/assets";
import { expandIsoDiamond, isoAtlasTransform } from "../../iso";
import { atlasRectForTile, fogTerrainGain, type TerrainAtlas } from "../terrainAtlas";
import { TERRAIN_COVER, SHROUD_FILL } from "./constants";
import { isoDiamondPath } from "../isoDiamond";
import { fillElevationPoly } from "./cliffs";

export function paintShroudCliffs(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tw: number,
  th: number,
  dropE: number,
  dropS: number,
  step: number,
  tileX: number,
  tileY: number,
  seed: number,
  seal: boolean,
): void {
  if (dropE <= 0 && dropS <= 0) return;
  const geo = tileCliffGeometry(tw, th, step, dropE, dropS, seed, tileX, tileY);
  if (geo.south) fillElevationPoly(ctx, sx, sy, geo.south.points, undefined, seal);
  if (geo.east) fillElevationPoly(ctx, sx, sy, geo.east.points, undefined, seal);
  if (geo.wedge) fillElevationPoly(ctx, sx, sy, geo.wedge, undefined, seal);
}

export function paintShroudMaskTile(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tw: number,
  th: number,
  dropE: number,
  dropS: number,
  step: number,
  gain: number,
  z: number,
  tileX: number,
  tileY: number,
  seed: number,
): void {
  const shroudGain = fogTerrainGain(0);
  if (gain <= shroudGain + 0.005) return;
  const srcAlpha = 1 - (1 - gain) / (1 - shroudGain);
  if (srcAlpha <= 0.01) return;
  ctx.globalAlpha = srcAlpha;
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.35, 1.25 * z);
  const cover = expandIsoDiamond(sx, sy, tw, th, srcAlpha >= 0.98 ? TERRAIN_COVER : 1);
  isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
  ctx.fill();
  if (srcAlpha >= 0.98) ctx.stroke();
  paintShroudCliffs(ctx, sx, sy, tw, th, dropE, dropS, step, tileX, tileY, seed, srcAlpha >= 0.98);
}

export function paintShroudOverlay(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tw: number,
  th: number,
  dropE: number,
  dropS: number,
  step: number,
  gain: number,
  z: number,
  tileX: number,
  tileY: number,
  seed: number,
): void {
  if (gain >= 0.98) return;
  ctx.save();
  ctx.globalAlpha = 1 - gain;
  ctx.fillStyle = SHROUD_FILL;
  ctx.strokeStyle = SHROUD_FILL;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.35, 1.25 * z);
  const cover = expandIsoDiamond(sx, sy, tw, th, TERRAIN_COVER);
  isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
  ctx.fill();
  ctx.stroke();
  paintShroudCliffs(ctx, sx, sy, tw, th, dropE, dropS, step, tileX, tileY, seed, true);
  ctx.restore();
}

export function drawAtlasDiamond(
  ctx: CanvasRenderingContext2D,
  atlas: TerrainAtlas,
  x: number,
  y: number,
  sx: number,
  sy: number,
  tw: number,
  th: number,
): void {
  if (!atlas.canvas) return;
  const rect = atlasRectForTile(x, y, atlas.mapWidth);
  const pad = ATLAS_SAMPLE_PAD;
  const sx0 = Math.max(0, rect.sx - pad);
  const sy0 = Math.max(0, rect.sy - pad);
  const sx1 = Math.min(atlas.width, rect.sx + rect.sw + pad);
  const sy1 = Math.min(atlas.height, rect.sy + rect.sh + pad);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.transform(...isoAtlasTransform(sx, sy, tw, th, rect.sw, rect.sh));
  ctx.drawImage(atlas.canvas, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 - rect.sx, sy0 - rect.sy, sx1 - sx0, sy1 - sy0);
}

const ATLAS_SAMPLE_PAD = 1;
