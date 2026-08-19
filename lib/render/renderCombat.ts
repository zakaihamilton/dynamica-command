import { UNIT_STATS, footprintOf } from "../catalog";
import { rubbleSprite, wreckSprite } from "../gen/assets";
import { animClock, facingVector } from "./anim";
import { fxProgress, isBuildingKind, isUnitKind, type FxBurst } from "./fx";
import { TILE_H, tileToScreen, type Camera } from "./iso";
import { drawSprite, rasterize } from "./sprites";
import { entityElev } from "./renderPicking";
import { turretAimMap } from "./renderStructures";
import type { Entity, Facing, SimState, UnitKind } from "../types";

export function isLockedContactUnit(state: SimState, e: Entity): boolean {
  return (
    e.class === "unit" &&
    e.neutral === true &&
    (state.runtime?.kind === "rescue" || state.runtime?.kind === "extraction") &&
    Boolean(state.runtime.targetIds?.includes(e.id))
  );
}

export function isExtractableUnit(state: SimState, e: Entity): boolean {
  return (
    e.class === "unit" &&
    state.runtime?.kind === "extraction" &&
    Boolean(state.runtime.targetIds?.includes(e.id)) &&
    !Boolean(state.runtime.extractedIds?.includes(e.id))
  );
}

export function drawCombatEffects(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  drawList: Entity[],
  entityById: Map<number, Entity>,
  facingFor: (state: SimState, e: Entity) => Facing,
  clockMs?: number,
): void {
  const z = cam.zoom;
  const t = animClock(state.tick, clockMs);
  for (const e of drawList) {
    if (e.attackTarget === undefined || e.cooldown <= 0) continue;
    const target = entityById.get(e.attackTarget);
    if (!target || target.hp <= 0) continue;
    const maxCooldown = e.class === "unit" ? UNIT_STATS[e.kind as UnitKind].cooldown : e.kind === "turret" ? 14 : 0;
    if (maxCooldown <= 0 || e.cooldown < maxCooldown - 3) continue;
    const facing = facingFor(state, e);
    const dir = facingVector(facing);
    const a = tileToScreen(e.x, e.y, cam, entityElev(state, e));
    const b = tileToScreen(target.x, target.y, cam, entityElev(state, target));
    const age = maxCooldown - e.cooldown;
    const u = Math.max(0, Math.min(1, (age + (t % 80) / 80) / 2.4));
    let ax: number;
    let ay: number;
    if (e.kind === "turret") {
      const aim = turretAimMap.get(e.id);
      const mountX = a.x + 1.67 * z;
      const mountY = a.y + 15.34 * z;
      const angle = aim ? aim.angle : Math.atan2(b.y + 6 * z - mountY, b.x - mountX);
      ax = mountX + Math.cos(angle) * 24 * z;
      ay = mountY + Math.sin(angle) * 24 * z;
    } else {
      const muzzle = e.class === "building" ? 18 : e.kind === "infantry" ? 14 : 20;
      ax = a.x + dir.x * muzzle * z;
      ay = a.y + 6 * z + dir.y * muzzle * z;
    }
    const bx = b.x;
    const by = b.y + 9 * z;
    const px = ax + (bx - ax) * u;
    const py = ay + (by - ay) * u;
    const anti = e.kind === "antiArmor";
    const heavy = e.kind === "tank" || e.kind === "turret";
    ctx.save();
    ctx.globalAlpha = 0.55 + (1 - u) * 0.35;
    ctx.strokeStyle = anti ? "#ff8b3d" : heavy ? "#ffe08a" : "#f6d06c";
    ctx.lineWidth = Math.max(1, Math.round(z * (heavy ? 3 : anti ? 2 : 1)));
    ctx.shadowColor = anti ? "#ff5a28" : "#ffd56a";
    ctx.shadowBlur = (heavy ? 7 : 4) * z;
    ctx.beginPath();
    ctx.moveTo(Math.round(ax), Math.round(ay));
    ctx.lineTo(Math.round(px), Math.round(py));
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (anti) {
      for (let i = 1; i <= 3; i++) {
        const trail = Math.max(0, u - i * 0.045);
        const tx = ax + (bx - ax) * trail;
        const ty = ay + (by - ay) * trail;
        ctx.globalAlpha = 0.22 * (1 - i / 4);
        ctx.fillStyle = "#9aa09a";
        ctx.beginPath();
        ctx.ellipse(tx, ty, (2 + i) * z, (1.2 + i * 0.55) * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 0.55 + (1 - u) * 0.35;
    ctx.fillStyle = heavy ? "#fff4c4" : "#fff0a0";
    const shell = heavy ? 5 : 3;
    ctx.fillRect(Math.round(px - shell / 2), Math.round(py - shell / 2), shell, shell);
    if (age < 1) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath();
      ctx.arc(ax, ay, Math.max(2, 3 * z), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = anti ? "#ff8b3d" : "#fff4c4";
      ctx.lineWidth = Math.max(1, z);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + facing * 0.3;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(ang) * 8 * z, ay + Math.sin(ang) * 5 * z);
        ctx.stroke();
      }
    }
    if (u > 0.72) {
      const burst = (u - 0.72) / 0.28;
      ctx.globalAlpha = 0.85 * (1 - burst);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + e.id;
        const rad = (4 + burst * 10) * z;
        ctx.fillStyle = i % 2 ? "#ffe08a" : "#a54b25";
        ctx.fillRect(
          Math.round(bx + Math.cos(ang) * rad - 2),
          Math.round(by + Math.sin(ang) * rad * 0.5 - 2),
          Math.max(2, 3 * z),
          Math.max(2, 3 * z),
        );
      }
    }
    ctx.restore();
  }
}

export function drawFxLayer(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  fx: FxBurst[] | undefined,
  nowMs: number,
  layer: "ground" | "burst",
): void {
  if (!fx?.length) return;
  const z = cam.zoom;
  for (const burst of fx) {
    if (layer === "ground" && burst.kind !== "rubble") continue;
    if (layer === "burst" && burst.kind === "rubble") continue;
    const p = fxProgress(burst, nowMs);
    let cx = burst.x;
    let cy = burst.y;
    if (burst.entityClass === "building" && isBuildingKind(burst.entityKind)) {
      const fp = footprintOf(burst.entityKind);
      cx = burst.x + (fp.w - 1) / 2;
      cy = burst.y + (fp.h - 1) / 2;
    }
    const s = tileToScreen(cx, cy, cam, burst.elev);
    if (burst.kind === "rubble") {
      const pal = state.factions[burst.owner]?.palette ?? state.factions[0]!.palette;
      const spec = isBuildingKind(burst.entityKind)
        ? rubbleSprite(burst.entityKind, pal)
        : isUnitKind(burst.entityKind)
          ? wreckSprite(burst.entityKind, pal)
          : rubbleSprite("turret", pal);
      const img = rasterize(spec);
      const ax = (spec.anchorX ?? spec.w / 2) * z;
      const ay = (spec.anchorY ?? spec.h) * z;
      ctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      drawSprite(ctx, spec, img, Math.round(s.x - ax), Math.round(s.y + (TILE_H / 2) * z - ay), spec.w * z, spec.h * z);
      ctx.globalAlpha = 1;
      continue;
    }
    if (burst.kind === "explosion") {
      const pal = state.factions[burst.owner]?.palette ?? state.factions[0]!.palette;
      if (burst.entityClass === "unit" && isUnitKind(burst.entityKind) && p < 0.65) {
        const wreck = wreckSprite(burst.entityKind, pal);
        const img = rasterize(wreck);
        const ax = (wreck.anchorX ?? wreck.w / 2) * z;
        const ay = (wreck.anchorY ?? wreck.h) * z;
        ctx.globalAlpha = 1 - p;
        drawSprite(ctx, wreck, img, Math.round(s.x - ax), Math.round(s.y + (TILE_H / 2) * z - ay), wreck.w * z, wreck.h * z);
        ctx.globalAlpha = 1;
      }
      const radius = (6 + p * 22) * z;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.9 * (1 - p);
      ctx.fillStyle = "#a54b25";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 6 * z, radius, radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.28 * (1 - p);
      ctx.fillStyle = "#20252a";
      for (let i = 0; i < 5; i++) {
        const drift = ((burst.id + i * 7) % 9) - 4;
        ctx.beginPath();
        ctx.ellipse(
          s.x + drift * z + Math.cos(i * 2.2) * radius * 0.35,
          s.y - (5 + p * 24 + i * 2) * z,
          radius * (0.28 + i * 0.035),
          radius * (0.2 + i * 0.03),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 0.74 * (1 - p);
      ctx.strokeStyle = p < 0.42 ? "#ffd38a" : "#6b4a38";
      ctx.lineWidth = Math.max(1, 1.3 * z);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + burst.id * 0.7;
        const inner = radius * 0.32;
        const outer = radius * (0.7 + (i % 3) * 0.16);
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(ang) * inner, s.y + 4 * z + Math.sin(ang) * inner * 0.55);
        ctx.lineTo(s.x + Math.cos(ang) * outer, s.y + 4 * z + Math.sin(ang) * outer * 0.55);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4 * z, radius * 0.45, radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + burst.id;
        const rad = radius * (0.7 + (i % 2) * 0.25);
        ctx.fillStyle = i % 2 ? "#ff9a3a" : "#3a322c";
        ctx.fillRect(
          Math.round(s.x + Math.cos(ang) * rad - 2),
          Math.round(s.y + Math.sin(ang) * rad * 0.5 - 2),
          Math.max(2, 3 * z),
          Math.max(2, 3 * z),
        );
      }
      ctx.restore();
    }
  }
}
