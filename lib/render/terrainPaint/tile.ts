import { tileCliffGeometry } from "../../gen/assets";
import { expandIsoDiamond, isoAtlasTransform } from "../../iso";
import { atlasRectForTile, fogTerrainGain, type TerrainAtlas } from "../terrainAtlas";
import { SHROUD_FILL, SHROUD_COVER, SHROUD_CORNER_RADIUS_FRAC } from "./constants";
import { roundedIsoDiamondPath, type IsoDiamondCornerRadii } from "../isoDiamond";
import { fillElevationPoly } from "./cliffs";
import { fogAt } from "../../sim/fog";
import type { SimState } from "../../types";

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

function shroudStampRadius(w: number, h: number): number {
  return SHROUD_CORNER_RADIUS_FRAC * Math.min(w, h);
}

export function shroudCornerRadii(
  state: SimState,
  tileX: number,
  tileY: number,
  radius: number,
  occupied: (fog: number) => boolean,
): IsoDiamondCornerRadii {
  const on = (dx: number, dy: number) => occupied(fogAt(state, tileX + dx, tileY + dy));
  const outer = (dx1: number, dy1: number, dx2: number, dy2: number, dx3: number, dy3: number) =>
    on(dx1, dy1) || on(dx2, dy2) || on(dx3, dy3) ? 0 : radius;
  return [
    outer(-1, 0, 0, -1, -1, -1),
    outer(1, 0, 0, -1, 1, -1),
    outer(1, 0, 0, 1, 1, 1),
    outer(-1, 0, 0, 1, -1, 1),
  ];
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
  state: SimState,
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
  const cover = expandIsoDiamond(sx, sy, tw, th, srcAlpha >= 0.98 ? SHROUD_COVER : 1);
  const radius = shroudStampRadius(cover.w, cover.h);
  const radii = shroudCornerRadii(state, tileX, tileY, radius, (fog) => fog >= 1);
  roundedIsoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h, radii);
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
  state: SimState,
): void {
  if (gain >= 0.98) return;
  ctx.save();
  ctx.globalAlpha = 1 - gain;
  ctx.fillStyle = SHROUD_FILL;
  ctx.strokeStyle = SHROUD_FILL;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.35, 1.25 * z);
  const cover = expandIsoDiamond(sx, sy, tw, th, SHROUD_COVER);
  const radius = shroudStampRadius(cover.w, cover.h);
  const radii = shroudCornerRadii(state, tileX, tileY, radius, (fog) => fog < 2);
  roundedIsoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h, radii);
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
