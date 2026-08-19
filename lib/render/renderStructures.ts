import { footprintOf } from "../catalog";
import { TILE_H, TILE_W, tileToScreen, type Camera } from "./iso";
import { groundHeight, heightAt } from "../sim/world";
import { lerpAngle } from "./gl/glMath";
import type { BuildingAnim } from "./anim";
import type { BuildingKind, Entity, SimState } from "../types";
import { entityElev } from "./renderPicking";
import { buildTurretHeadModel, type UnitModel } from "./gl/modelLoader";
import { draw3dModel } from "./gl/modelRenderer";

export const turretAimMap = new Map<number, { angle: number; lastMs: number }>();

let cachedTurretModel: UnitModel | null = null;
export function getTurretModel(): UnitModel {
  if (!cachedTurretModel) {
    cachedTurretModel = buildTurretHeadModel();
  }
  return cachedTurretModel;
}

function footprintPath(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const e0 = heightAt(state, Math.round(x), Math.round(y));
  const e1 = heightAt(state, Math.min(state.width - 1, Math.round(x + w - 1)), Math.round(y));
  const e2 = heightAt(state, Math.min(state.width - 1, Math.round(x + w - 1)), Math.min(state.height - 1, Math.round(y + h - 1)));
  const e3 = heightAt(state, Math.round(x), Math.min(state.height - 1, Math.round(y + h - 1)));
  const top = tileToScreen(x, y, cam, e0);
  const right = tileToScreen(x + w, y, cam, e1);
  const bot = tileToScreen(x + w, y + h, cam, e2);
  const left = tileToScreen(x, y + h, cam, e3);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x + (TILE_W / 2) * cam.zoom, right.y + (TILE_H / 2) * cam.zoom);
  ctx.lineTo(bot.x, bot.y + TILE_H * cam.zoom);
  ctx.lineTo(left.x - (TILE_W / 2) * cam.zoom, left.y + (TILE_H / 2) * cam.zoom);
  ctx.closePath();
}

export function strokeFootprint(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  footprintPath(ctx, state, cam, x, y, w, h);
  ctx.stroke();
}

export function drawBuildingShadow(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  e: Entity,
  z: number,
): void {
  const fp = footprintOf(e.kind as BuildingKind);
  ctx.save();
  ctx.translate(5 * z, 4 * z);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#000";
  footprintPath(ctx, state, cam, e.x, e.y, fp.w, fp.h);
  ctx.fill();
  ctx.restore();
}

export function drawBuildingFx(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  s: { x: number; y: number },
  z: number,
  anim: BuildingAnim,
): void {
  const kind = e.kind as BuildingKind;
  ctx.save();
  if (anim.lightOn && (kind === "power" || kind === "constructionYard" || kind === "objective" || kind === "turret")) {
    ctx.fillStyle = kind === "objective" ? "#f3dc79" : "#c7f0d4";
    ctx.globalAlpha = 0.5 + anim.smoke * 0.3;
    ctx.beginPath();
    ctx.ellipse(s.x + 6 * z, s.y - 12 * z, 3.5 * z, 2.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === "refinery" || kind === "power" || kind === "factory" || anim.damageStage > 0) {
    const puff = anim.smoke;
    const columns = anim.damageStage > 1 ? 3 : anim.damageStage > 0 ? 2 : 1;
    for (let i = 0; i < columns; i++) {
      const rise = (12 + puff * (14 + anim.damageStage * 6) + i * 7) * z;
      ctx.globalAlpha = (0.2 + puff * 0.22) * (1 - i * 0.18);
      ctx.fillStyle = anim.damageStage > 0 ? "rgba(40,36,32,0.78)" : "rgba(190,190,180,0.55)";
      ctx.beginPath();
      ctx.ellipse(
        s.x - (8 - i * 6) * z,
        s.y - rise,
        (4 + puff * 4 + i * 2) * z,
        (3 + puff * 3 + i) * z,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  if (anim.spark > 0.55 && (anim.constructing || anim.producing || anim.repairing)) {
    ctx.globalAlpha = anim.spark;
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(s.x + (anim.frame - 1.5) * 5 * z, s.y + 2 * z, 2 * z, 2 * z);
    ctx.fillStyle = "#ff9a3a";
    ctx.fillRect(s.x - 7 * z, s.y + 5 * z, 2 * z, 2 * z);
  }
  if ((kind === "barracks" || kind === "factory") && anim.doorOpen) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffc14a";
    ctx.fillRect(s.x - 6 * z, s.y + 4 * z, 12 * z, 5 * z);
  }
  if (kind === "constructionYard") {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "#c3a65d";
    ctx.lineWidth = Math.max(1, z);
    ctx.beginPath();
    ctx.moveTo(s.x - 4 * z, s.y - 16 * z);
    ctx.lineTo(s.x - 4 * z + anim.antenna * z, s.y - 24 * z);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTurretCannon(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  s: { x: number; y: number },
  z: number,
  state: SimState,
  cam: Camera,
  timeMs: number,
  targetEntity?: Entity,
): void {
  if (e.hp <= 0 || e.constructing > 0) return;
  const target = targetEntity;

  const mountX = s.x + 1.67 * z;
  const mountY = s.y + 15.34 * z;

  let targetAngle: number;
  if (target && target.hp > 0) {
    const b = tileToScreen(target.x, target.y, cam, entityElev(state, target));
    const targetY = b.y + 6 * z;
    targetAngle = Math.atan2(targetY - mountY, b.x - mountX);
  } else {
    const sweep = Math.sin(timeMs * 0.0012 + e.id * 1.7) * 0.55;
    targetAngle = (e.owner === 0 ? Math.PI * 0.25 : -Math.PI * 0.75) + sweep;
  }

  let aim = turretAimMap.get(e.id);
  if (!aim) {
    aim = { angle: targetAngle, lastMs: timeMs };
    turretAimMap.set(e.id, aim);
  }
  const dt = Math.max(0.001, Math.min(0.1, (timeMs - aim.lastMs) * 0.001));
  aim.lastMs = timeMs;
  aim.angle = lerpAngle(aim.angle, targetAngle, Math.min(1, dt * 10.0));

  const angle = aim.angle;
  const isFiring = e.cooldown >= 11;
  const recoil = isFiring ? ((e.cooldown - 11) / 3) * 3 * z : 0;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  ctx.save();

  if (target && target.hp > 0) {
    const b = tileToScreen(target.x, target.y, cam, entityElev(state, target));
    const muzzleX = mountX + cos * (24 * z - recoil);
    const muzzleY = mountY + sin * (24 * z - recoil);
    ctx.strokeStyle = e.owner === 0 ? "rgba(70, 220, 255, 0.4)" : "rgba(255, 70, 50, 0.45)";
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.setLineDash([4 * z, 4 * z]);
    ctx.beginPath();
    ctx.moveTo(muzzleX, muzzleY);
    ctx.lineTo(b.x, b.y + 6 * z);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = e.owner === 0 ? "#46e2ff" : "#ff4d36";
    ctx.beginPath();
    ctx.arc(b.x, b.y + 6 * z, 2 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  // Turntable well shadow under the head
  ctx.fillStyle = "rgba(10, 14, 18, 0.45)";
  ctx.beginPath();
  ctx.ellipse(mountX, mountY - 1 * z, 13 * z, 6.5 * z, 0, 0, Math.PI * 2);
  ctx.fill();

  const pal = state.factions[e.owner]?.palette ?? state.factions[0]?.palette;
  const model = getTurretModel();
  draw3dModel(ctx, model, mountX, mountY - 3 * z, z, angle - Math.PI / 4, pal, isFiring ? (e.cooldown - 11) / 3 : 0);

  // Muzzle flash when firing
  if (isFiring) {
    const muzzleX = mountX + cos * (24 * z - recoil);
    const muzzleY = mountY + sin * (24 * z - recoil);
    const flashR = (3 + (e.cooldown - 11) * 2.5) * z;
    ctx.fillStyle = "#fff4c4";
    ctx.shadowColor = "#ffb03a";
    ctx.shadowBlur = 8 * z;
    ctx.beginPath();
    ctx.arc(muzzleX, muzzleY, flashR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

export function drawHarvestFx(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  e: Entity,
  cam: Camera,
  timeMs: number,
): void {
  if (e.gatherX === undefined || e.gatherY === undefined) return;
  const z = cam.zoom;
  const a = tileToScreen(e.gatherX, e.gatherY, cam, heightAt(state, e.gatherX, e.gatherY));
  const b = tileToScreen(e.x, e.y, cam, groundHeight(state, e.x, e.y));
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const u = (((timeMs * 0.0018 + e.id * 0.2 + i * 0.33) % 1) + 1) % 1;
    const x = a.x + (b.x - a.x) * u;
    const y = a.y + (b.y - a.y) * u - 10 * z * Math.sin(u * Math.PI);
    ctx.globalAlpha = 0.75 * (1 - u);
    ctx.fillStyle = i % 2 ? "#f6de7a" : "#c4a040";
    ctx.fillRect(Math.round(x - 1), Math.round(y - 2), Math.max(2, 2 * z), Math.max(3, 3 * z));
  }
  ctx.restore();
}
