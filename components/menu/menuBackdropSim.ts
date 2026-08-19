import {
  cliffFaces,
  drawElevationFaces,
  buildingSprite,
  tileSprite,
  TILE_SPRITE_PAD_X,
  TILE_SPRITE_PAD_Y,
  unitSprite,
} from "@/lib/gen/assets";
import { generateFactions } from "@/lib/gen/factions";
import { generateMap } from "@/lib/gen/map";
import { generateCampaignVisualProfile, generateVisualProfile } from "@/lib/gen/visualProfile";
import { HEIGHT_STEP, TILE_H, TILE_W, tileToScreen, type Camera } from "@/lib/render/iso";
import { rasterize } from "@/lib/render/sprites";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "@/lib/types";
import type { BuildingKind, UnitKind } from "@/lib/types";

export const CINEMA_SEED = 1847;

export type Actor = {
  x: number;
  y: number;
  kind: UnitKind;
  owner: 0 | 1;
  waypoints: { x: number; y: number }[];
  wi: number;
  speed: number;
};

export type Shot = { ax: number; ay: number; bx: number; by: number; life: number };

export function createCinemaScene() {
  const map = generateMap(CINEMA_SEED, {
    index: 0,
    win: { kind: "razeAll" },
    mapSize: 28,
  });
  const [us, them] = generateFactions(CINEMA_SEED);
  const campaignProfile = generateCampaignVisualProfile(CINEMA_SEED);

  const p0 = map.playerStart;
  const e0 = map.enemyStart;
  const buildings: { x: number; y: number; kind: BuildingKind; owner: 0 | 1 }[] = [
    { x: p0.x, y: p0.y, kind: "constructionYard", owner: 0 },
    { x: p0.x + 3, y: p0.y, kind: "power", owner: 0 },
    { x: p0.x, y: p0.y + 3, kind: "refinery", owner: 0 },
    { x: p0.x + 4, y: p0.y + 3, kind: "factory", owner: 0 },
    { x: p0.x + 7, y: p0.y + 1, kind: "turret", owner: 0 },
    { x: e0.x, y: e0.y, kind: "constructionYard", owner: 1 },
    { x: e0.x - 3, y: e0.y, kind: "power", owner: 1 },
    { x: e0.x - 5, y: e0.y - 3, kind: "barracks", owner: 1 },
    { x: e0.x, y: e0.y - 6, kind: "factory", owner: 1 },
    { x: e0.x - 5, y: e0.y, kind: "turret", owner: 1 },
  ];

  const p = map.playerStart;
  const e = map.enemyStart;
  const actors: Actor[] = [
    {
      x: p.x + 1,
      y: p.y + 3,
      kind: "harvester",
      owner: 0,
      waypoints: [
        { x: p.x + 4, y: p.y + 5 },
        { x: p.x + 1, y: p.y + 2 },
      ],
      wi: 0,
      speed: 0.018,
    },
    {
      x: p.x + 4,
      y: p.y,
      kind: "tank",
      owner: 0,
      waypoints: [
        { x: (p.x + e.x) / 2, y: (p.y + e.y) / 2 - 2 },
        { x: p.x + 5, y: p.y + 1 },
      ],
      wi: 0,
      speed: 0.014,
    },
    {
      x: p.x + 5,
      y: p.y + 2,
      kind: "infantry",
      owner: 0,
      waypoints: [
        { x: p.x + 8, y: p.y + 4 },
        { x: p.x + 5, y: p.y + 2 },
      ],
      wi: 0,
      speed: 0.022,
    },
    {
      x: e.x - 4,
      y: e.y,
      kind: "tank",
      owner: 1,
      waypoints: [
        { x: (p.x + e.x) / 2 + 1, y: (p.y + e.y) / 2 },
        { x: e.x - 3, y: e.y - 1 },
      ],
      wi: 0,
      speed: 0.013,
    },
    {
      x: e.x - 1,
      y: e.y - 3,
      kind: "antiArmor",
      owner: 1,
      waypoints: [
        { x: e.x - 6, y: e.y - 4 },
        { x: e.x - 1, y: e.y - 3 },
      ],
      wi: 0,
      speed: 0.02,
    },
    {
      x: e.x - 2,
      y: e.y + 1,
      kind: "harvester",
      owner: 1,
      waypoints: [
        { x: e.x - 5, y: e.y - 5 },
        { x: e.x, y: e.y - 2 },
      ],
      wi: 0,
      speed: 0.016,
    },
  ];

  return { map, us, them, campaignProfile, buildings, actors };
}

function tileKind(tile: number): "clear" | "water" | "resource" | "blocked" {
  if (tile === TILE_WATER) return "water";
  if (tile === TILE_RESOURCE) return "resource";
  if (tile === TILE_BLOCKED) return "blocked";
  return "clear";
}

export function renderCinemaFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  scene: ReturnType<typeof createCinemaScene>,
  shots: Shot[],
) {
  const { map, us, them, campaignProfile, buildings, actors } = scene;

  ctx.imageSmoothingEnabled = false;
  const cam: Camera = {
    zoom: 0.92,
    x: w * 0.52 + Math.sin(t * 0.004) * 140,
    y: h * 0.08 + Math.cos(t * 0.0032) * 70,
  };

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#0a1018");
  sky.addColorStop(0.45, "#12180f");
  sky.addColorStop(1, "#1a140c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const margin = TILE_W * cam.zoom;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const elev = map.heights[y * map.width + x] ?? 1;
      const s = tileToScreen(x, y, cam, elev);
      if (s.x < -margin || s.y < -margin || s.x > w + margin || s.y > h + margin) continue;
      const kind = tileKind(map.tiles[y * map.width + x]!);
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
      if (kind === "resource") {
        ctx.globalAlpha = 0.85 + Math.sin(t * 0.08 + x + y) * 0.15;
      }
      const padX = TILE_SPRITE_PAD_X * cam.zoom;
      const padY = TILE_SPRITE_PAD_Y * cam.zoom;
      ctx.drawImage(img, s.x - tw / 2 - padX, s.y - padY, tw + padX * 2, th + padY * 2);
      ctx.globalAlpha = 1;
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

  type DrawItem =
    | { type: "b"; x: number; y: number; kind: BuildingKind; owner: 0 | 1 }
    | { type: "u"; x: number; y: number; kind: UnitKind; owner: 0 | 1 };
  const list: DrawItem[] = [
    ...buildings.map((b) => ({ type: "b" as const, ...b })),
    ...actors.map((a) => ({ type: "u" as const, x: a.x, y: a.y, kind: a.kind, owner: a.owner })),
  ];
  list.sort((a, b) => a.x + a.y - (b.x + b.y));

  for (const item of list) {
    const elev = map.heights[Math.floor(item.y) * map.width + Math.floor(item.x)] ?? 1;
    const s = tileToScreen(item.x, item.y, cam, elev);
    const pal = item.owner === 0 ? us.palette : them.palette;
    const profile = generateVisualProfile(CINEMA_SEED, item.owner);
    if (item.type === "b") {
      const spec = buildingSprite(item.kind, pal, { profile });
      const img = rasterize(spec);
      const ax = (spec.anchorX ?? spec.w / 2) * cam.zoom;
      const ay = (spec.anchorY ?? spec.h) * cam.zoom;
      ctx.drawImage(img, s.x - ax, s.y + (TILE_H / 2) * cam.zoom - ay, spec.w * cam.zoom, spec.h * cam.zoom);
    } else {
      const spec = unitSprite(item.kind, pal, { profile });
      const img = rasterize(spec);
      const ax = (spec.anchorX ?? spec.w / 2) * cam.zoom;
      const ay = (spec.anchorY ?? spec.h) * cam.zoom;
      ctx.drawImage(img, s.x - ax, s.y + (TILE_H / 2) * cam.zoom - ay, spec.w * cam.zoom, spec.h * cam.zoom);
    }
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
