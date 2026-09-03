import {
  unitSprite,
} from "@/lib/gen/assets";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { TILE_H, tileToScreen, type Camera } from "@/lib/iso";
import { animFrame, toFacing, unitMovementOffset } from "@/lib/render/anim";
import { rasterize } from "@/lib/render/sprites";
import {
  CINEMA_SCROLL_PAD,
  scrollLayerBlitOffset,
  scrollLayerNeedsRebuild,
  scrollLayerPaintCamera,
  terrainScrollPad,
  type ScrollLayer,
} from "@/lib/render/scrollLayer";
import { terrainColors } from "@/lib/render/terrainMaterials";
import { drawUnitShadow } from "@/lib/render/unitMotion";
import { FX_DURATION } from "@/lib/render/fx";
import { renderWorld } from "@/lib/render/renderer";
import { tick } from "@/lib/sim/api";
import { nearest } from "@/lib/sim/world";
import { assignAttack } from "@/lib/sim/ai/combat";
import type { Facing } from "@/lib/types";
import { type Actor, type CinemaScene, type Shot } from "./scene";
import { cinemaCamera, cinemaOrigin, paintCinemaStatic } from "./paint";

type CinemaTerrainCache = ScrollLayer & {
  canvas: HTMLCanvasElement | null;
};

const CINEMA_TERRAIN_CACHE_LIMIT = 4;
const cinemaTerrains = new Map<string, CinemaTerrainCache>();

function cinemaTerrainContentKey(scene: CinemaScene, w: number, h: number, zoom: number): string {
  return `${scene.seed}:${w}x${h}:${zoom}`;
}

function cinemaTerrainPad(zoom: number): number {
  return Math.max(CINEMA_SCROLL_PAD, terrainScrollPad(zoom));
}

function takeCinemaTerrain(contentKey: string): CinemaTerrainCache {
  const existing = cinemaTerrains.get(contentKey);
  if (existing) {
    cinemaTerrains.delete(contentKey);
    cinemaTerrains.set(contentKey, existing);
    return existing;
  }
  const created: CinemaTerrainCache = {
    canvas: null,
    key: "",
    originX: 0,
    originY: 0,
    pad: CINEMA_SCROLL_PAD,
  };
  cinemaTerrains.set(contentKey, created);
  while (cinemaTerrains.size > CINEMA_TERRAIN_CACHE_LIMIT) {
    const oldest = cinemaTerrains.keys().next().value;
    if (oldest === undefined || oldest === contentKey) break;
    cinemaTerrains.delete(oldest);
  }
  return created;
}

function ensureCinemaTerrain(
  scene: CinemaScene,
  w: number,
  h: number,
  cam: Camera,
  followCamera: boolean,
): CinemaTerrainCache | null {
  if (typeof document === "undefined") return null;
  const pad = cinemaTerrainPad(cam.zoom);
  const contentKey = cinemaTerrainContentKey(scene, w, h, cam.zoom);
  const cache = takeCinemaTerrain(contentKey);
  if (!cache.canvas) cache.canvas = document.createElement("canvas");
  const canvas = cache.canvas;
  const bw = w + pad * 2;
  const bh = h + pad * 2;
  const origin = followCamera ? { x: cam.x, y: cam.y } : cinemaOrigin(w, h);
  const sizeChanged = canvas.width !== bw || canvas.height !== bh;
  const jumped = followCamera && scrollLayerNeedsRebuild(cache, contentKey, cam.x, cam.y);
  const rebuild = sizeChanged || cache.key !== contentKey || jumped;
  if (!rebuild) return cache;

  if (sizeChanged) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, bw, bh);
  const paintCam = scrollLayerPaintCamera({ x: origin.x, y: origin.y, zoom: cam.zoom }, pad);
  paintCinemaStatic(ctx, scene, paintCam);
  cache.key = contentKey;
  cache.originX = origin.x;
  cache.originY = origin.y;
  cache.pad = pad;
  return cache;
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

  // Live battle highlight simulation tick (every 5 frames = 12 ticks/sec standard game rate)
  if (scene.state && t % 5 === 0) {
    const pUnits = scene.state.entities.filter((e) => e.owner === 0 && e.class === "unit" && e.hp > 0);
    const eUnits = scene.state.entities.filter((e) => e.owner === 1 && e.class === "unit" && e.hp > 0);
    for (const u of pUnits) {
      if (u.attackTarget === undefined || u.idle) {
        const target = nearest(scene.state, u, (e) => e.owner === 1 && e.hp > 0);
        if (target) assignAttack(scene.state, u, target);
      }
    }
    for (const u of eUnits) {
      if (u.attackTarget === undefined || u.idle) {
        const target = nearest(scene.state, u, (e) => e.owner === 0 && e.hp > 0);
        if (target) assignAttack(scene.state, u, target);
      }
    }

    const { events } = tick(scene.state);
    scene.state.fog.fill(2);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    for (const ev of events) {
      if (ev.type === "combat") {
        shots.push({ ax: ev.x, ay: ev.y, bx: ev.targetX, by: ev.targetY, life: 18 });
      } else if (ev.type === "destroyed") {
        scene.fx.push({
          id: ev.id,
          kind: "explosion",
          x: ev.x,
          y: ev.y,
          elev: 1,
          bornMs: now,
          durationMs: FX_DURATION.explosion,
          owner: ev.owner,
          entityKind: ev.kind,
          entityClass: "unit",
        });
      }
    }

    const fighting = scene.state.entities.filter((e) => e.class === "unit" && e.hp > 0);
    if (fighting.length > 0) {
      scene.combatEpicenter = {
        x: fighting.reduce((sum, u) => sum + u.x, 0) / fighting.length,
        y: fighting.reduce((sum, u) => sum + u.y, 0) / fighting.length,
      };
    }
  } else if (t % 48 === 0 && actors.length >= 4) {
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
  const followCamera = Boolean(options?.camera);
  const preview = !paintAmbient;

  // Render actual game gameplay directly onto PIP feed when available
  if (preview && scene.state) {
    try {
      renderWorld(ctx, scene.state, cam, new Set(), null, {
        clockMs: typeof performance !== "undefined" ? performance.now() : t * 16,
        fx: scene.fx,
      });
      return;
    } catch {
      // Fall through to standard cinema renderer if renderWorld is unsupported in this context
    }
  }

  ctx.imageSmoothingEnabled = true;
  if (preview && "imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";

  if (preview) {
    ctx.fillStyle = terrainColors(scene.map.biome).mid;
    ctx.fillRect(0, 0, w, h);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#0a1018");
    sky.addColorStop(0.45, "#12180f");
    sky.addColorStop(1, "#1a140c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
  }

  const cached = useTerrainCache ? ensureCinemaTerrain(scene, w, h, cam, followCamera) : null;
  if (cached?.canvas) {
    const blit = scrollLayerBlitOffset(cached, cam.x, cam.y);
    ctx.drawImage(cached.canvas, blit.x, blit.y);
  } else {
    paintCinemaStatic(ctx, scene, cam);
  }

  const profile0 = generateVisualProfile(scene.seed, 0);
  const profile1 = generateVisualProfile(scene.seed, 1);
  const ordered = preview
    ? [...actors].sort((left, right) => left.x + left.y - (right.x + right.y))
    : actors;
  for (const a of ordered) {
    paintCinemaActor(ctx, scene, cam, a, t, preview, profile0, profile1);
  }

  for (const sh of shots) {
    const ea = map.heights[Math.floor(sh.ay) * map.width + Math.floor(sh.ax)] ?? 1;
    const eb = map.heights[Math.floor(sh.by) * map.width + Math.floor(sh.bx)] ?? 1;
    const sa = tileToScreen(sh.ax, sh.ay, cam, ea);
    const sb = tileToScreen(sh.bx, sh.by, cam, eb);
    ctx.strokeStyle = "#ffe27d";
    ctx.lineWidth = preview ? 1.05 : 1.8;
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  }

  if (paintAmbient) paintAmbientSignals(ctx, w, h, t);
}

function actorFacing(actor: Actor): Facing {
  const dest = actor.waypoints[actor.wi]!;
  let dx = dest.x - actor.x;
  let dy = dest.y - actor.y;
  if (Math.hypot(dx, dy) < 0.05) {
    const next = actor.waypoints[(actor.wi + 1) % actor.waypoints.length]!;
    dx = next.x - actor.x;
    dy = next.y - actor.y;
  }
  return toFacing(dx, dy);
}

function paintCinemaActor(
  ctx: CanvasRenderingContext2D,
  scene: CinemaScene,
  cam: Camera,
  actor: Actor,
  t: number,
  preview: boolean,
  profile0: ReturnType<typeof generateVisualProfile>,
  profile1: ReturnType<typeof generateVisualProfile>,
): void {
  const elev = scene.map.heights[Math.floor(actor.y) * scene.map.width + Math.floor(actor.x)] ?? 1;
  const s = tileToScreen(actor.x, actor.y, cam, elev);
  const pal = actor.owner === 0 ? scene.us.palette : scene.them.palette;
  const facing = preview ? actorFacing(actor) : 0;
  const frame = preview ? animFrame(t * 17, actor.kind === "antiArmor" ? 105 : 90, 4) : 0;
  const spec = unitSprite(actor.kind, pal, {
    profile: actor.owner === 0 ? profile0 : profile1,
    facing,
    animationFrame: frame,
  });
  const img = rasterize(spec);
  const ax = (spec.anchorX ?? spec.w / 2) * cam.zoom;
  const ay = (spec.anchorY ?? spec.h) * cam.zoom;
  const groundX = s.x;
  const groundY = s.y + (TILE_H / 2) * cam.zoom;
  if (preview) {
    drawUnitShadow(ctx, actor.kind, groundX, groundY, cam.zoom, 1, true);
  }
  const bob = preview ? unitMovementOffset(actor.kind, frame).bobY * cam.zoom : 0;
  ctx.drawImage(img, s.x - ax, groundY - ay + bob, spec.w * cam.zoom, spec.h * cam.zoom);
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
