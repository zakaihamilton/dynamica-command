import {
  cliffFaces,
  buildingSprite,
} from "@/lib/gen/assets";
import { isMountainScenery, sceneryAt } from "@/lib/gen/map";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { expandIsoDiamond, HEIGHT_STEP, TILE_H, TILE_W, tileToScreen, type Camera } from "@/lib/iso";
import { isoDiamondPath } from "@/lib/render/isoDiamond";
import { rasterize } from "@/lib/render/sprites";
import { biomeMaterials, getTerrainAtlas, tileVariant } from "@/lib/render/terrainAtlas";
import { drawElevationFaces } from "@/lib/render/terrainPaint/cliffs";
import { TERRAIN_COVER } from "@/lib/render/terrainPaint/constants";
import { drawBlockerProp } from "@/lib/render/terrainPaint/details";
import { drawTerrainScatter } from "@/lib/render/terrainPaint/scatter";
import { drawAtlasDiamond } from "@/lib/render/terrainPaint/tile";
import { paintWorldGroundSprite } from "@/lib/render/terrainPaint/worldGround";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER, type SimState } from "@/lib/types";
import type { CinemaScene } from "./scene";

export function tileKind(tile: number): "clear" | "water" | "resource" | "blocked" {
  if (tile === TILE_WATER) return "water";
  if (tile === TILE_RESOURCE) return "resource";
  if (tile === TILE_BLOCKED) return "blocked";
  return "clear";
}

export function cinemaCamera(w: number, h: number, t: number): Camera {
  return {
    zoom: 0.92,
    x: w * 0.52 + Math.sin(t * 0.004) * 140,
    y: h * 0.08 + Math.cos(t * 0.0032) * 70,
  };
}

export function cinemaOrigin(w: number, h: number): { x: number; y: number } {
  return { x: w * 0.52, y: h * 0.08 };
}

export function cinemaGroundWorld(scene: CinemaScene): SimState {
  return {
    seed: scene.seed,
    biome: scene.map.biome,
    width: scene.map.width,
    height: scene.map.height,
    tiles: scene.map.tiles,
    heights: scene.map.heights,
    surfaces: scene.map.surfaces,
    resourceAmount: scene.map.resourceAmount,
  } as SimState;
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

export function paintCinemaTile(
  ctx: CanvasRenderingContext2D,
  scene: CinemaScene,
  cam: Camera,
  x: number,
  y: number,
): void {
  const world = cinemaGroundWorld(scene);
  const scenery = sceneryAt(world, x, y);
  const water = scenery.kind === TILE_WATER;
  const elev = scenery.elev;
  const s = tileToScreen(x, y, cam, elev);
  const z = cam.zoom;
  const tw = TILE_W * z;
  const th = TILE_H * z;
  const eastSc = sceneryAt(world, x + 1, y);
  const southSc = sceneryAt(world, x, y + 1);
  const dropE = water ? 0 : Math.max(0, elev - eastSc.elev);
  const dropS = water ? 0 : Math.max(0, elev - southSc.elev);
  const mats = biomeMaterials(world.biome);

  if (!water && (elev >= 2 || dropE > 0 || dropS > 0)) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.28, 0.1 + elev * 0.03 + (dropE + dropS) * 0.04);
    ctx.fillStyle = "#071014";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + th * 0.58 + HEIGHT_STEP * z * 0.1, tw * 0.42, th * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (dropE > 0 || dropS > 0) {
    drawElevationFaces(
      ctx,
      s.x,
      s.y,
      tw,
      th,
      HEIGHT_STEP * z,
      dropE,
      dropS,
      tileVariant(world.seed, x, y),
      wetBankColors(
        cliffFaces(world.biome, elev, scene.campaignProfile),
        mats,
        eastSc.kind === TILE_WATER,
        southSc.kind === TILE_WATER,
      ),
      x,
      y,
    );
  }

  if (!water && paintWorldGroundSprite(ctx, world, cam, x, y, scenery)) return;

  const atlas = getTerrainAtlas(world);
  const cover = expandIsoDiamond(s.x, s.y, tw, th, TERRAIN_COVER);
  ctx.save();
  isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
  ctx.clip();
  if (atlas.canvas) {
    drawAtlasDiamond(ctx, atlas, x, y, s.x, s.y, tw, th);
  } else {
    ctx.fillStyle = `rgb(${mats.waterMid.r},${mats.waterMid.g},${mats.waterMid.b})`;
    isoDiamondPath(ctx, cover.x, cover.y, cover.w, cover.h);
    ctx.fill();
  }
  ctx.restore();
}

export function paintCinemaStatic(
  ctx: CanvasRenderingContext2D,
  scene: CinemaScene,
  cam: Camera,
  w: number,
  h: number,
): void {
  const { map, buildings } = scene;
  const world = cinemaGroundWorld(scene);
  const margin = TILE_W * cam.zoom * 2;
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";

  const visit = (waterPass: boolean) => {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const water = map.tiles[y * map.width + x] === TILE_WATER;
        if (water !== waterPass) continue;
        const elev = map.heights[y * map.width + x] ?? 1;
        const s = tileToScreen(x, y, cam, elev);
        if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
        paintCinemaTile(ctx, scene, cam, x, y);
      }
    }
  };
  visit(false);
  visit(true);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const scenery = sceneryAt(world, x, y);
      if (scenery.kind === TILE_WATER) continue;
      const s = tileToScreen(x, y, cam, scenery.elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      drawTerrainScatter(ctx, world, x, y, s.x, s.y, cam.zoom, scenery.kind, map.surfaces[y * map.width + x]);
      if (scenery.kind === TILE_BLOCKED && !isMountainScenery(scenery)) {
        drawBlockerProp(ctx, world, x, y, s.x, s.y, cam.zoom);
      }
    }
  }

  const profile0 = generateVisualProfile(scene.seed, 0);
  const profile1 = generateVisualProfile(scene.seed, 1);
  for (const b of buildings) {
    const elev = map.heights[Math.floor(b.y) * map.width + Math.floor(b.x)] ?? 1;
    const s = tileToScreen(b.x, b.y, cam, elev);
    const pal = b.owner === 0 ? scene.us.palette : scene.them.palette;
    const spec = buildingSprite(b.kind, pal, { profile: b.owner === 0 ? profile0 : profile1 });
    const img = rasterize(spec);
    const ax = (spec.anchorX ?? spec.w / 2) * cam.zoom;
    const ay = (spec.anchorY ?? spec.h) * cam.zoom;
    ctx.drawImage(img, s.x - ax, s.y + (TILE_H / 2) * cam.zoom - ay, spec.w * cam.zoom, spec.h * cam.zoom);
  }
}
