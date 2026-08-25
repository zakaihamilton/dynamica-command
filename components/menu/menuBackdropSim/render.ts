import {
  unitSprite,
} from "@/lib/gen/assets";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { TILE_H, TILE_W, tileToScreen } from "@/lib/iso";
import { rasterize } from "@/lib/render/sprites";
import { CINEMA_SCROLL_PAD, scrollLayerBlitOffset, scrollLayerPaintCamera } from "@/lib/render/scrollLayer";
import { CINEMA_SEED, type Shot } from "./scene";
import { tileKind, cinemaCamera, cinemaOrigin, paintCinemaTile, paintCinemaStatic } from "./paint";

type CinemaTerrainCache = {
  canvas: HTMLCanvasElement | null;
  sizeKey: string;
  originX: number;
  originY: number;
  pad: number;
};

const cinemaTerrain: CinemaTerrainCache = {
  canvas: null,
  sizeKey: "",
  originX: 0,
  originY: 0,
  pad: CINEMA_SCROLL_PAD,
};

function ensureCinemaTerrain(
  scene: ReturnType<typeof import("./scene").createCinemaScene>,
  w: number,
  h: number,
): CinemaTerrainCache | null {
  if (typeof document === "undefined") return null;
  const pad = CINEMA_SCROLL_PAD;
  const origin = cinemaOrigin(w, h);
  const sizeKey = `${w}x${h}`;
  if (!cinemaTerrain.canvas) cinemaTerrain.canvas = document.createElement("canvas");
  const canvas = cinemaTerrain.canvas;
  const bw = w + pad * 2;
  const bh = h + pad * 2;
  if (cinemaTerrain.sizeKey === sizeKey && canvas.width === bw && canvas.height === bh) {
    return cinemaTerrain;
  }
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, bw, bh);
  const paintCam = scrollLayerPaintCamera({ x: origin.x, y: origin.y, zoom: 0.92 }, pad);
  paintCinemaStatic(ctx, scene, paintCam, bw, bh);
  cinemaTerrain.sizeKey = sizeKey;
  cinemaTerrain.originX = origin.x;
  cinemaTerrain.originY = origin.y;
  cinemaTerrain.pad = pad;
  return cinemaTerrain;
}

export function renderCinemaFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  scene: ReturnType<typeof import("./scene").createCinemaScene>,
  shots: Shot[],
) {
  const { map, actors } = scene;

  ctx.imageSmoothingEnabled = false;
  const cam = cinemaCamera(w, h, t);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#0a1018");
  sky.addColorStop(0.45, "#12180f");
  sky.addColorStop(1, "#1a140c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const cached = ensureCinemaTerrain(scene, w, h);
  if (cached?.canvas) {
    const blit = scrollLayerBlitOffset(
      { originX: cached.originX, originY: cached.originY, pad: cached.pad },
      cam.x,
      cam.y,
    );
    ctx.drawImage(cached.canvas, blit.x, blit.y);
  } else {
    paintCinemaStatic(ctx, scene, cam, w, h);
  }

  const margin = TILE_W * cam.zoom;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (tileKind(map.tiles[y * map.width + x]!) !== "resource") continue;
      const elev = map.heights[y * map.width + x] ?? 1;
      const s = tileToScreen(x, y, cam, elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      paintCinemaTile(ctx, scene, cam, x, y, "resource", t);
    }
  }

  for (const a of actors) {
    const dest = a.waypoints[a.wi]!;
    const dx = dest.x - a.x;
    const dy = dest.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) a.wi = (a.wi + 1) % a.waypoints.length;
    else {
      a.x += (dx / d) * a.speed;
      a.y += (dy / d) * a.speed;
    }
  }

  if (t % 48 === 0) {
    const attacker = actors[1 + (t % 2)]!;
    const target = attacker.owner === 0 ? actors[3]! : actors[1]!;
    shots.push({ ax: attacker.x, ay: attacker.y, bx: target.x, by: target.y, life: 18 });
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    shots[i]!.life -= 1;
    if (shots[i]!.life <= 0) shots.splice(i, 1);
  }

  const profile0 = generateVisualProfile(CINEMA_SEED, 0);
  const profile1 = generateVisualProfile(CINEMA_SEED, 1);
  for (const a of actors) {
    const elev = map.heights[Math.floor(a.y) * map.width + Math.floor(a.x)] ?? 1;
    const s = tileToScreen(a.x, a.y, cam, elev);
    const pal = a.owner === 0 ? scene.us.palette : scene.them.palette;
    const spec = unitSprite(a.kind, pal, { profile: a.owner === 0 ? profile0 : profile1 });
    const img = rasterize(spec);
    const ax = (spec.anchorX ?? spec.w / 2) * cam.zoom;
    const ay = (spec.anchorY ?? spec.h) * cam.zoom;
    ctx.drawImage(img, s.x - ax, s.y + (TILE_H / 2) * cam.zoom - ay, spec.w * cam.zoom, spec.h * cam.zoom);
  }

  for (const sh of shots) {
    const ea = map.heights[Math.floor(sh.ay) * map.width + Math.floor(sh.ax)] ?? 1;
    const eb = map.heights[Math.floor(sh.by) * map.width + Math.floor(sh.bx)] ?? 1;
    const sa = tileToScreen(sh.ax, sh.ay, cam, ea);
    const sb = tileToScreen(sh.bx, sh.by, cam, eb);
    ctx.strokeStyle = "#ffe27d";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  }
}
