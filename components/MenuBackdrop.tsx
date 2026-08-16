"use client";

import { useEffect, useRef } from "react";
import { buildingSprite, tileSprite, unitSprite } from "@/lib/gen/assets";
import { generateFactions } from "@/lib/gen/factions";
import { generateMap } from "@/lib/gen/map";
import { HEIGHT_STEP, TILE_H, TILE_W, tileToScreen, type Camera } from "@/lib/render/iso";
import { rasterize } from "@/lib/render/sprites";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "@/lib/types";
import type { BuildingKind, UnitKind } from "@/lib/types";
import { BUILDING_STATS } from "@/lib/catalog";

const CINEMA_SEED = 1847;

type Actor = {
  x: number;
  y: number;
  kind: UnitKind;
  owner: 0 | 1;
  waypoints: { x: number; y: number }[];
  wi: number;
  speed: number;
};

type Shot = { ax: number; ay: number; bx: number; by: number; life: number };

export function MenuBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const map = generateMap(CINEMA_SEED, {
      index: 0,
      win: { kind: "razeAll" },
      mapSize: 28,
    });
    const [us, them] = generateFactions(CINEMA_SEED);

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

    const shots: Shot[] = [];
    let raf = 0;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const tileKind = (tile: number): "clear" | "water" | "resource" | "blocked" => {
      if (tile === TILE_WATER) return "water";
      if (tile === TILE_RESOURCE) return "resource";
      if (tile === TILE_BLOCKED) return "blocked";
      return "clear";
    };

    const drawDiamond = (x: number, y: number, w: number, h: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x - w / 2, y + h / 2);
      ctx.closePath();
    };

    const frame = () => {
      t += 1;
      const w = canvas.width;
      const h = canvas.height;
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
          const dropE = Math.max(0, elev - east) * HEIGHT_STEP * cam.zoom;
          const dropS = Math.max(0, elev - south) * HEIGHT_STEP * cam.zoom;
          const tw = TILE_W * cam.zoom;
          const th = TILE_H * cam.zoom;
          if (dropS > 0) {
            ctx.fillStyle = elev >= 3 ? "#332d27" : "#262d23";
            ctx.beginPath();
            ctx.moveTo(s.x - tw / 2, s.y + th / 2);
            ctx.lineTo(s.x, s.y + th);
            ctx.lineTo(s.x, s.y + th + dropS);
            ctx.lineTo(s.x - tw / 2, s.y + th / 2 + dropS);
            ctx.closePath();
            ctx.fill();
          }
          if (dropE > 0) {
            ctx.fillStyle = elev >= 3 ? "#51483d" : "#394334";
            ctx.beginPath();
            ctx.moveTo(s.x + tw / 2, s.y + th / 2);
            ctx.lineTo(s.x, s.y + th);
            ctx.lineTo(s.x, s.y + th + dropE);
            ctx.lineTo(s.x + tw / 2, s.y + th / 2 + dropE);
            ctx.closePath();
            ctx.fill();
          }
          const img = rasterize(tileSprite(kind, elev, {
            biome: map.biome,
            variant: (x * 13 + y * 7) % 16,
            surface: map.surfaces[y * map.width + x],
            resourceLevel: 4,
          }));
          if (kind === "resource") {
            ctx.globalAlpha = 0.85 + Math.sin(t * 0.08 + x + y) * 0.15;
          }
          ctx.drawImage(img, s.x - (TILE_W / 2) * cam.zoom, s.y, TILE_W * cam.zoom, TILE_H * cam.zoom);
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

      const sprites = [
        ...buildings.map((b) => ({ ...b, class: "building" as const, sort: b.x + b.y })),
        ...actors.map((a) => ({ ...a, class: "unit" as const, sort: a.x + a.y })),
      ].sort((a, b) => a.sort - b.sort);

      for (const item of sprites) {
        const pal = item.owner === 0 ? us.palette : them.palette;
        const spec =
          item.class === "unit"
            ? unitSprite(item.kind as UnitKind, pal, {
                variant: Math.round(item.x * 31 + item.y * 17),
                facing: (() => {
                  const actor = item as Actor;
                  const dest = actor.waypoints?.[actor.wi];
                  if (!dest) return item.owner === 0 ? 0 : 4;
                  const angle = Math.atan2(dest.y - item.y, dest.x - item.x);
                  return ((Math.round(angle / (Math.PI * 2) * 8) + 8) % 8) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
                })(),
                animationFrame: Math.floor(t / 8) % 2 as 0 | 1,
              })
            : buildingSprite(item.kind as BuildingKind, pal, {
                variant: Math.round(item.x * 31 + item.y * 17),
                animationFrame: Math.floor(t / 12) % 2 as 0 | 1,
              });
        const img = rasterize(spec);
        let cx = item.x;
        let cy = item.y;
        if (item.class === "building") {
          const fp = BUILDING_STATS[item.kind as BuildingKind].footprint;
          cx = item.x + (fp.w - 1) / 2;
          cy = item.y + (fp.h - 1) / 2;
        }
        const elev = map.heights[Math.round(item.y) * map.width + Math.round(item.x)] ?? 1;
        const s = tileToScreen(cx, cy, cam, elev);
        const z = cam.zoom;
        const ax = (spec.anchorX ?? spec.w / 2) * z;
        const ay = (spec.anchorY ?? spec.h) * z;
        ctx.drawImage(img, s.x - ax, s.y + (TILE_H / 2) * z - ay, spec.w * z, spec.h * z);
      }

      for (const shot of shots) {
        const a = tileToScreen(shot.ax, shot.ay, cam);
        const b = tileToScreen(shot.bx, shot.by, cam);
        ctx.strokeStyle = `rgba(255, 210, 90, ${shot.life / 22})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 12);
        ctx.lineTo(b.x, b.y - 12);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(243, 230, 196, 0.04)";
      for (let i = 0; i < 18; i++) {
        const px = ((t * 0.4 + i * 90) % (w + 80)) - 40;
        const py = 40 + i * (h / 18);
        drawDiamond(px, py, 18, 9);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
