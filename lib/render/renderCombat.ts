import { UNIT_STATS, footprintOf } from "../catalog";
import { rubbleSprite, wreckSprite } from "../gen/assets";
import { animClock, facingVector } from "./anim";
import { fxProgress, isBuildingKind, isUnitKind, type FxBurst } from "./fx";
import { TILE_H, tileToScreen, type Camera } from "../iso";
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

export function isScenarioTarget(state: SimState, e: Entity): boolean {
  return e.class === "unit" && Boolean(state.runtime?.targetIds.includes(e.id));
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
    const coreWidth = Math.max(1, Math.round(z * (heavy ? 3 : anti ? 2 : 1)));
    const glowWidth = coreWidth + Math.max(2, Math.round((heavy ? 5 : 3) * z));
    const coreColor = anti ? "#ff8b3d" : heavy ? "#ffe08a" : "#f6d06c";
    const glowColor = anti ? "rgba(255, 90, 40, 0.32)" : "rgba(255, 213, 106, 0.34)";
    ctx.save();
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.55 + (1 - u) * 0.35;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = glowWidth;
    ctx.beginPath();
    ctx.moveTo(Math.round(ax), Math.round(ay));
    ctx.lineTo(Math.round(px), Math.round(py));
    ctx.stroke();
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = coreWidth;
    ctx.beginPath();
    ctx.moveTo(Math.round(ax), Math.round(ay));
    ctx.lineTo(Math.round(px), Math.round(py));
    ctx.stroke();
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
  reducedMotion = false,
): void {
  if (!fx?.length) return;
  const z = cam.zoom;
  const position = (burst: FxBurst) => {
    let cx = burst.x;
    let cy = burst.y;
    if (burst.entityClass === "building" && isBuildingKind(burst.entityKind)) {
      const fp = footprintOf(burst.entityKind);
      cx += (fp.w - 1) / 2;
      cy += (fp.h - 1) / 2;
    }
    return tileToScreen(cx, cy, cam, burst.elev);
  };
  const visible = (s: { x: number; y: number }) => {
    const pad = 140 * Math.max(1, z);
    return s.x >= -pad && s.y >= -pad && s.x <= ctx.canvas.width + pad && s.y <= ctx.canvas.height + pad;
  };

  if (layer === "ground") {
    for (const burst of fx) {
      if (burst.kind !== "scorch") continue;
      const p = fxProgress(burst, nowMs);
      const s = position(burst);
      if (!visible(s)) continue;
      const fade = p > 0.78 ? 1 - (p - 0.78) / 0.22 : 1;
      const radius = (13 + (burst.magnitude ?? 1) * 13) * z;
      ctx.save();
      ctx.globalAlpha = 0.26 * fade;
      ctx.fillStyle = "#080909";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + (TILE_H / 2) * z, radius, radius * 0.38, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.14 * fade;
      ctx.strokeStyle = "#5a3925";
      ctx.lineWidth = Math.max(1, 2 * z);
      ctx.stroke();
      ctx.restore();
    }
    for (const burst of fx) {
      if (burst.kind !== "rubble" && burst.kind !== "wreck") continue;
      const p = fxProgress(burst, nowMs);
      const s = position(burst);
      if (!visible(s)) continue;
      const pal = state.factions[burst.owner]?.palette ?? state.factions[0]!.palette;
      const spec = burst.kind === "wreck" && isUnitKind(burst.entityKind)
        ? wreckSprite(burst.entityKind, pal)
        : isBuildingKind(burst.entityKind)
          ? rubbleSprite(burst.entityKind, pal)
          : rubbleSprite("turret", pal);
      const img = rasterize(spec);
      const ax = (spec.anchorX ?? spec.w / 2) * z;
      const ay = (spec.anchorY ?? spec.h) * z;
      ctx.globalAlpha = p > 0.78 ? 1 - (p - 0.78) / 0.22 : 1;
      drawSprite(ctx, spec, img, Math.round(s.x - ax), Math.round(s.y + (TILE_H / 2) * z - ay), spec.w * z, spec.h * z);
      ctx.globalAlpha = 1;
    }
    return;
  }

  for (const burst of fx) {
    if (burst.kind === "rubble" || burst.kind === "wreck" || burst.kind === "scorch") continue;
    const p = fxProgress(burst, nowMs);
    const s = position(burst);
    if (!visible(s)) continue;
    const fade = 1 - p;
    const magnitude = burst.magnitude || 1;
    const phase = ((burst.variant ?? burst.id) % 628) / 100;

    ctx.save();
    if (burst.kind === "muzzle") {
      if (reducedMotion) {
        ctx.globalAlpha = 0.32 * fade;
        ctx.fillStyle = "#fff2b2";
        ctx.fillRect(Math.round(s.x - 2 * z), Math.round(s.y + 2 * z), Math.max(2, 4 * z), Math.max(2, 3 * z));
        ctx.restore();
        continue;
      }
      const radius = (5 + magnitude * 8) * z * (0.8 + fade * 0.35);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = burst.weapon === "antiArmor" ? "#ff9b56" : "#fff2b2";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4 * z, radius * 0.48, radius * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff7d6";
      ctx.lineWidth = Math.max(1, z);
      for (let i = 0; i < 5; i++) {
        const angle = phase + (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + 4 * z);
        ctx.lineTo(s.x + Math.cos(angle) * radius, s.y + 4 * z + Math.sin(angle) * radius * 0.58);
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }

    if (burst.kind === "impact") {
      const metal = burst.targetDomain === "vehicle";
      const structure = burst.targetDomain === "building";
      const radius = (4 + magnitude * 13 + p * 8) * z;
      ctx.globalAlpha = (reducedMotion ? 0.28 : 0.68) * fade;
      ctx.strokeStyle = metal ? "#d8f2ff" : structure ? "#f1b66d" : "#d7c0a1";
      ctx.lineWidth = Math.max(1, (1 + magnitude) * z);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 7 * z, radius, radius * 0.46, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (!reducedMotion) {
        const count = burst.weapon === "smallArms" ? 4 : burst.weapon === "antiArmor" ? 7 : 10;
        for (let i = 0; i < count; i++) {
          const angle = phase + (i / count) * Math.PI * 2;
          const travel = radius * (0.45 + ((((burst.variant ?? burst.id) >>> (i % 16)) & 3) * 0.2));
          const rise = (5 + p * 18 * magnitude) * z;
          ctx.globalAlpha = fade * (metal ? 0.9 : 0.58);
          ctx.fillStyle = metal && i % 2 ? "#d8f2ff" : structure ? "#c98b50" : "#8d7663";
          ctx.fillRect(
            Math.round(s.x + Math.cos(angle) * travel - z),
            Math.round(s.y + 6 * z + Math.sin(angle) * travel * 0.42 - rise),
            Math.max(1, (metal ? 2 : 3) * z),
            Math.max(1, 2 * z),
          );
        }
      }
      ctx.restore();
      continue;
    }

    if (burst.kind === "explosion") {
      const radius = (8 + p * 28) * z * magnitude;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (reducedMotion ? 0.42 : 0.9) * fade;
      ctx.fillStyle = p < 0.38 ? "#fff0a3" : "#e16a32";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 5 * z, radius, radius * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      if (!reducedMotion) {
        ctx.globalAlpha = 0.3 * fade;
        ctx.fillStyle = "#20252a";
        for (let i = 0; i < 6; i++) {
          const angle = phase + i * 1.9;
          const drift = (8 + i * 3 + p * 22) * z;
          ctx.beginPath();
          ctx.ellipse(
            s.x + Math.cos(angle) * drift * 0.6,
            s.y - (8 + p * 32 + i * 2) * z,
            (5 + p * 8 + i) * z,
            (3 + p * 5) * z,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.globalAlpha = 0.78 * fade;
        ctx.strokeStyle = p < 0.45 ? "#ffd38a" : "#6b4a38";
        ctx.lineWidth = Math.max(1, 1.5 * z);
        for (let i = 0; i < 10; i++) {
          const angle = phase + (i / 10) * Math.PI * 2;
          const inner = radius * 0.28;
          const outer = radius * (0.72 + (i % 3) * 0.14);
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(angle) * inner, s.y + 5 * z + Math.sin(angle) * inner * 0.5);
          ctx.lineTo(s.x + Math.cos(angle) * outer, s.y + 5 * z + Math.sin(angle) * outer * 0.5);
          ctx.stroke();
        }
      }
      ctx.restore();
      continue;
    }

    const palette = state.factions[burst.owner]?.palette ?? state.factions[0]!.palette;
    if (burst.kind === "build" || burst.kind === "deploy") {
      const radius = (10 + p * (burst.kind === "build" ? 36 : 24)) * z;
      ctx.globalAlpha = (reducedMotion ? 0.34 : 0.72) * fade;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(1, 2 * z);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + (TILE_H / 2) * z, radius, radius * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (!reducedMotion) {
        const count = burst.kind === "build" ? 10 : 6;
        for (let i = 0; i < count; i++) {
          const angle = phase + (i / count) * Math.PI * 2;
          const travel = radius * (0.35 + (i % 3) * 0.18);
          ctx.globalAlpha = 0.5 * fade;
          ctx.fillStyle = i % 2 ? palette.accent : "#c8b58a";
          ctx.beginPath();
          ctx.ellipse(
            s.x + Math.cos(angle) * travel,
            s.y + 12 * z + Math.sin(angle) * travel * 0.3 - p * 14 * z,
            (2 + (i % 2)) * z,
            (1.2 + (i % 2) * 0.5) * z,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.restore();
      continue;
    }

    if (burst.kind === "repair" || burst.kind === "heal") {
      const heal = burst.kind === "heal";
      const color = heal ? "#79efbd" : "#8edaff";
      ctx.globalAlpha = (reducedMotion ? 0.3 : 0.72) * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, 1.5 * z);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 5 * z, (8 + p * 8) * z, (4 + p * 4) * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (!reducedMotion) {
        ctx.fillStyle = color;
        for (let i = 0; i < 5; i++) {
          const angle = phase + i * 1.7;
          const x = s.x + Math.cos(angle) * (7 + i) * z;
          const y = s.y + 7 * z - (p * 18 + i * 2) * z;
          if (heal) {
            ctx.fillRect(Math.round(x - z), Math.round(y - 3 * z), Math.max(2, 2 * z), Math.max(5, 6 * z));
            ctx.fillRect(Math.round(x - 3 * z), Math.round(y - z), Math.max(5, 6 * z), Math.max(2, 2 * z));
          } else {
            ctx.fillRect(Math.round(x), Math.round(y), Math.max(2, 2 * z), Math.max(2, 2 * z));
          }
        }
      }
    }
    ctx.restore();
  }
}
