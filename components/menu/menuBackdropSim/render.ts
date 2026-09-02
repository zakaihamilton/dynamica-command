import {
  unitSprite,
} from "@/lib/gen/assets";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { TILE_H, TILE_W, tileToScreen, type Camera } from "@/lib/iso";
import { rasterize } from "@/lib/render/sprites";
import { CINEMA_SCROLL_PAD, scrollLayerBlitOffset, scrollLayerPaintCamera } from "@/lib/render/scrollLayer";
import { CINEMA_SEED, type CinemaScene, type Shot } from "./scene";
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

function ensureCinemaTerrain(scene: CinemaScene, w: number, h: number): CinemaTerrainCache | null {
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

export function stepCinemaScene(scene: CinemaScene, shots: Shot[], t: number): void {
  const { actors } = scene;
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
}

export type RenderCinemaOptions = {
  camera?: Camera;
  paintAmbient?: boolean;
  useTerrainCache?: boolean;
};

export function renderCinemaFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  scene: CinemaScene,
  shots: Shot[],
  options?: RenderCinemaOptions,
) {
  const { map, actors } = scene;
  const cam = options?.camera ?? cinemaCamera(w, h, t);
  const paintAmbient = options?.paintAmbient ?? true;
  const useTerrainCache = options?.useTerrainCache ?? true;

  ctx.imageSmoothingEnabled = false;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#0a1018");
  sky.addColorStop(0.45, "#12180f");
  sky.addColorStop(1, "#1a140c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const cached = useTerrainCache ? ensureCinemaTerrain(scene, w, h) : null;
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

  if (paintAmbient) paintAmbientSignals(ctx, w, h, t);
}

function paintAmbientSignals(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const minDimension = Math.min(w, h);
  const sweep = ((t * 0.006) % 1) * Math.PI * 2;
  const radarX = w * 0.84;
  const radarY = h * 0.2;
  const radarRadius = Math.max(34, minDimension * 0.13);
  const reticleX = w * 0.16 + Math.sin(t * 0.004) * Math.min(24, w * 0.02);
  const reticleY = h * 0.76 + Math.cos(t * 0.003) * Math.min(16, h * 0.02);
  const pulse = 0.38 + Math.sin(t * 0.055) * 0.1;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#5ce1e6";
  ctx.fillStyle = "#5ce1e6";

  ctx.globalAlpha = 0.11;
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarRadius * 0.64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(radarX - radarRadius, radarY);
  ctx.lineTo(radarX + radarRadius, radarY);
  ctx.moveTo(radarX, radarY - radarRadius);
  ctx.lineTo(radarX, radarY + radarRadius);
  ctx.stroke();

  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(radarX, radarY);
  ctx.lineTo(radarX + Math.cos(sweep) * radarRadius, radarY + Math.sin(sweep) * radarRadius);
  ctx.stroke();

  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(reticleX, reticleY, 16 + Math.sin(t * 0.04) * 2, 0, Math.PI * 2);
  ctx.moveTo(reticleX - 25, reticleY);
  ctx.lineTo(reticleX - 7, reticleY);
  ctx.moveTo(reticleX + 7, reticleY);
  ctx.lineTo(reticleX + 25, reticleY);
  ctx.moveTo(reticleX, reticleY - 25);
  ctx.lineTo(reticleX, reticleY + 7);
  ctx.moveTo(reticleX, reticleY + 7);
  ctx.lineTo(reticleX, reticleY + 25);
  ctx.stroke();

  ctx.globalAlpha = 0.08;
  const scanY = ((t * 0.45) % (h + 90)) - 45;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(w, scanY);
  ctx.stroke();

  ctx.globalAlpha = 0.18;
  const cornerLength = Math.max(18, minDimension * 0.045);
  for (const [x, y, xDirection, yDirection] of [
    [18, 58, 1, 1],
    [w - 18, 58, -1, 1],
    [18, h - 34, 1, -1],
    [w - 18, h - 34, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLength * yDirection);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLength * xDirection, y);
    ctx.stroke();
  }

  ctx.restore();
}
