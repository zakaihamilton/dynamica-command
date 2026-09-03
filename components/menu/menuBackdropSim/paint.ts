import {
  cliffFaces,
  tileSprite,
  TILE_SPRITE_PAD_X,
  TILE_SPRITE_PAD_Y,
  buildingSprite,
} from "@/lib/gen/assets";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { HEIGHT_STEP, TILE_H, TILE_W, tileToScreen, type Camera } from "@/lib/iso";
import { rasterize } from "@/lib/render/sprites";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "@/lib/types";
import type { CinemaScene } from "./scene";
import { drawElevationFaces } from "@/lib/render/terrainPaint/cliffs";

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

export function paintCinemaTile(
  ctx: CanvasRenderingContext2D,
  scene: CinemaScene,
  cam: Camera,
  x: number,
  y: number,
  kind: "clear" | "water" | "resource" | "blocked",
  pulseT?: number,
): void {
  const { map, campaignProfile } = scene;
  const elev = map.heights[y * map.width + x] ?? 1;
  const s = tileToScreen(x, y, cam, elev);
  const east = x + 1 < map.width ? map.heights[y * map.width + x + 1] ?? 0 : 0;
  const south = y + 1 < map.height ? map.heights[(y + 1) * map.width + x] ?? 0 : 0;
  const dropE = Math.max(0, elev - east);
  const dropS = Math.max(0, elev - south);
  const tw = TILE_W * cam.zoom;
  const th = TILE_H * cam.zoom;
  if (dropE > 0 || dropS > 0) {
    drawElevationFaces(
      ctx,
      s.x,
      s.y,
      tw,
      th,
      HEIGHT_STEP * cam.zoom,
      dropE,
      dropS,
      x * 13 + y * 7,
      cliffFaces(map.biome, elev, campaignProfile),
      x,
      y,
    );
  }
  const img = rasterize(
    tileSprite(kind, elev, {
      biome: map.biome,
      variant: (x * 13 + y * 7) % 64,
      surface: map.surfaces[y * map.width + x],
      resourceLevel: 4,
      campaignProfile,
    }),
  );
  if (kind === "resource" && pulseT !== undefined) {
    ctx.globalAlpha = 0.85 + Math.sin(pulseT * 0.08 + x + y) * 0.15;
  }
  const padX = TILE_SPRITE_PAD_X * cam.zoom;
  const padY = TILE_SPRITE_PAD_Y * cam.zoom;
  ctx.drawImage(img, s.x - tw / 2 - padX, s.y - padY, tw + padX * 2, th + padY * 2);
  ctx.globalAlpha = 1;
}

export function paintCinemaStatic(
  ctx: CanvasRenderingContext2D,
  scene: CinemaScene,
  cam: Camera,
  w: number,
  h: number,
): void {
  const { map, buildings } = scene;
  const margin = TILE_W * cam.zoom;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const kind = tileKind(map.tiles[y * map.width + x]!);
      if (kind === "resource") continue;
      const elev = map.heights[y * map.width + x] ?? 1;
      const s = tileToScreen(x, y, cam, elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      paintCinemaTile(ctx, scene, cam, x, y, kind);
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
