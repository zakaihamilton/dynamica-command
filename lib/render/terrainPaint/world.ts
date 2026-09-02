import { cliffFaces } from "../../gen/assets";
import { MAP_SKIRT, isMountainScenery } from "../../gen/map";
import { generateCampaignVisualProfile } from "../../gen/visualProfile";
import type { SimState } from "../../types";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER, SURFACE_CONCRETE } from "../../types";
import { HEIGHT_STEP, TILE_H, TILE_W, expandIsoDiamond, screenToTile, tileToScreen, type Camera } from "../../iso";
import { fogAt } from "../../sim/fog";
import { biomeMaterials, fogTerrainGain, getTerrainAtlas, tileVariant, type TerrainAtlas } from "../terrainAtlas";
import { SceneryMemo } from "../sceneryMemo";
import { drawConcreteSlab } from "../terrainPlates";
import { isoDiamondPath } from "../isoDiamond";
import { paintShroudOverlay, paintShroudMaskTile, drawAtlasDiamond } from "./tile";
import { smoothFogGain, drawBlockerProp, drawOreCrystals } from "./details";
import { drawTerrainScatter } from "./scatter";
import { SHROUD_FILL, TERRAIN_COVER } from "./constants";
import { drawElevationFaces } from "./cliffs";

const sceneryMemo = new SceneryMemo();

export function clearTerrainPaintCache(): void {
  sceneryMemo.clear();
}

function memoScenery(state: SimState, x: number, y: number) {
  return sceneryMemo.sample(state, x, y);
}

function wetBankColors(
  base: ReturnType<typeof cliffFaces>,
  mats: ReturnType<typeof biomeMaterials>,
  waterE: boolean,
  waterS: boolean,
): ReturnType<typeof cliffFaces> {
  const wet = `rgb(${Math.max(0, mats.waterDeep.r - 6)},${Math.max(0, mats.waterDeep.g - 4)},${Math.min(255, mats.waterDeep.b + 4)})`;
  return {
    south: waterS ? wet : base.south,
    east: waterE ? wet : base.east,
    southInk: base.southInk,
    eastInk: base.eastInk,
  };
}

function paintCell(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  atlas: TerrainAtlas,
  x: number,
  y: number,
  waterPass: boolean,
): void {
  const scenery = memoScenery(state, x, y);
  const water = scenery.kind === TILE_WATER;
  if (water !== waterPass) return;
  const elev = scenery.elev;
  const s = tileToScreen(x, y, cam, elev);
  const z = cam.zoom;
  const tw = TILE_W * z;
  const th = TILE_H * z;
  const inMap = x >= 0 && y >= 0 && x < state.width && y < state.height;
  const concrete = inMap && state.surfaces[y * state.width + x] === SURFACE_CONCRETE;
  const cover = expandIsoDiamond(s.x, s.y, tw, th, concrete ? 1 : water ? WATER_COVER : TERRAIN_COVER);
  const eastSc = memoScenery(state, x + 1, y);
  const southSc = memoScenery(state, x, y + 1);
  const dropE = water ? 0 : Math.max(0, elev - eastSc.elev);
  const dropS = water ? 0 : Math.max(0, elev - southSc.elev);
  const gain = smoothFogGain(state, x, y);

  if (!water && (elev >= 2 || dropE > 0 || dropS > 0)) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.28, 0.1 + elev * 0.03 + (dropE + dropS) * 0.04) * gain;
    ctx.fillStyle = "#071014";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + th * 0.58 + HEIGHT_STEP * z * 0.1, tw * 0.42, th * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (dropE > 0 || dropS > 0) {
    ctx.save();
    drawElevationFaces(
      ctx,
      s.x,
      s.y,
      tw,
      th,
      HEIGHT_STEP * z,
      dropE,
      dropS,
      tileVariant(state.seed, x, y),
      wetBankColors(
        cliffFaces(state.biome, elev, generateCampaignVisualProfile(state.seed)),
        biomeMaterials(state.biome),
        eastSc.kind === TILE_WATER,
        southSc.kind === TILE_WATER,
      ),
      x,
      y,
    );
    ctx.restore();
  }

  ctx.save();
  isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
  ctx.clip();
  if (concrete) {
    drawConcreteSlab(ctx, s.x, s.y, tw, th, z, tileVariant(state.seed, x, y), 1);
  } else if (atlas.canvas) {
    drawAtlasDiamond(ctx, atlas, x, y, s.x, s.y, tw, th);
  } else {
    const mats = biomeMaterials(state.biome);
    ctx.fillStyle = water
      ? `rgb(${mats.waterMid.r},${mats.waterMid.g},${mats.waterMid.b})`
      : `rgb(${mats.mid.r},${mats.mid.g},${mats.mid.b})`;
    isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
    ctx.fill();
  }
  ctx.restore();
}

function paintCellProps(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
): void {
  const inMap = x >= 0 && y >= 0 && x < state.width && y < state.height;
  const scenery = memoScenery(state, x, y);
  const elev = scenery.elev;
  const s = tileToScreen(x, y, cam, elev);
  const z = cam.zoom;
  const gain = smoothFogGain(state, x, y);
  ctx.save();
  ctx.globalAlpha = gain;
  if (scenery.kind === TILE_BLOCKED && !isMountainScenery(scenery)) {
    drawBlockerProp(ctx, state, x, y, s.x, s.y, z);
  }
  if (inMap && fogAt(state, x, y) > 0 && state.tiles[y * state.width + x] === TILE_RESOURCE) {
    drawOreCrystals(ctx, state, cam, x, y, elev, z);
  }
  drawTerrainScatter(ctx, state, x, y, s.x, s.y, z);
  ctx.restore();
}

export function visibleTileRange(
  cam: Camera,
  screenW: number,
  screenH: number,
  mapWidth: number,
  mapHeight: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const marginX = TILE_W * cam.zoom * 2;
  const marginY = TILE_H * cam.zoom * 2;
  const elevLift = 4 * HEIGHT_STEP * cam.zoom;
  const cliffDrop = TILE_H * cam.zoom * 6;
  const samples = [
    screenToTile(-marginX, -marginY - elevLift, cam),
    screenToTile(screenW + marginX, -marginY - elevLift, cam),
    screenToTile(screenW + marginX, screenH + marginY + cliffDrop, cam),
    screenToTile(-marginX, screenH + marginY + cliffDrop, cam),
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of samples) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const pad = 6;
  const x0 = Math.max(-MAP_SKIRT, Math.floor(minX) - pad);
  const y0 = Math.max(-MAP_SKIRT, Math.floor(minY) - pad);
  const x1 = Math.min(mapWidth + MAP_SKIRT, Math.ceil(maxX) + pad + 1);
  const y1 = Math.min(mapHeight + MAP_SKIRT, Math.ceil(maxY) + pad + 1);
  return { x0, y0, x1, y1 };
}

function visitVisibleTiles(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  visit: (x: number, y: number) => void,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const margin = TILE_W * cam.zoom * 2;
  const range = visibleTileRange(cam, w, h, state.width, state.height);
  const x0 = range.x0;
  const y0 = range.y0;
  const x1 = range.x1;
  const y1 = range.y1;
  if (x0 >= x1 || y0 >= y1) return;
  const depth0 = x0 + y0;
  const depth1 = (x1 - 1) + (y1 - 1);
  for (let depth = depth0; depth <= depth1; depth++) {
    const xs = Math.max(x0, depth - (y1 - 1));
    const xe = Math.min(x1 - 1, depth - y0);
    for (let x = xs; x <= xe; x++) {
      const y = depth - x;
      const elev = memoScenery(state, x, y).elev;
      const s = tileToScreen(x, y, cam, elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      visit(x, y);
    }
  }
}

let shroudMask: HTMLCanvasElement | null = null;

function paintShroudLayer(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const z = cam.zoom;
  const tw = TILE_W * z;
  const th = TILE_H * z;
  const step = HEIGHT_STEP * z;
  const paintVisibleShroud = (
    target: CanvasRenderingContext2D,
    painter: typeof paintShroudOverlay,
  ) => visitVisibleTiles(ctx, state, cam, (x, y) => {
    const scenery = memoScenery(state, x, y);
    const s = tileToScreen(x, y, cam, scenery.elev);
    const dropE = Math.max(0, scenery.elev - memoScenery(state, x + 1, y).elev);
    const dropS = Math.max(0, scenery.elev - memoScenery(state, x, y + 1).elev);
    painter(target, s.x, s.y, tw, th, dropE, dropS, step, smoothFogGain(state, x, y), z, x, y, tileVariant(state.seed, x, y));
  });
  if (typeof document === "undefined") {
    paintVisibleShroud(ctx, paintShroudOverlay);
    return;
  }
  if (!shroudMask) shroudMask = document.createElement("canvas");
  if (shroudMask.width !== w || shroudMask.height !== h) {
    shroudMask.width = w;
    shroudMask.height = h;
  }
  const fog = shroudMask.getContext("2d");
  if (!fog) {
    paintVisibleShroud(ctx, paintShroudOverlay);
    return;
  }
  fog.setTransform(1, 0, 0, 1, 0, 0);
  fog.globalCompositeOperation = "source-over";
  fog.globalAlpha = 1;
  fog.clearRect(0, 0, w, h);
  const overlay = 1 - fogTerrainGain(0);
  fog.fillStyle = `rgba(8, 13, 17, ${overlay})`;
  fog.fillRect(0, 0, w, h);
  fog.globalCompositeOperation = "destination-out";
  paintVisibleShroud(fog, paintShroudMaskTile);
  fog.globalCompositeOperation = "source-over";
  fog.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(shroudMask, 0, 0);
  ctx.restore();
}

export const WATER_COVER = 1.24;

export function paintTerrainWorld(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const atlas = getTerrainAtlas(state);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = SHROUD_FILL;
  ctx.fillRect(0, 0, w, h);

  visitVisibleTiles(ctx, state, cam, (x, y) => {
    paintCell(ctx, state, cam, atlas, x, y, false);
  });
  visitVisibleTiles(ctx, state, cam, (x, y) => {
    paintCell(ctx, state, cam, atlas, x, y, true);
  });
  paintShroudLayer(ctx, state, cam);
  visitVisibleTiles(ctx, state, cam, (x, y) => {
    paintCellProps(ctx, state, cam, x, y);
  });
}
