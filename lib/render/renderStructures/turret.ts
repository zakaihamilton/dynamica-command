import { tileToScreen, type Camera } from "../../iso";
import { lerpAngle } from "../gl/glMath";
import type { Entity, SimState } from "../../types";
import { entityElev } from "../renderPicking";
import { buildTurretHeadModel, type UnitModel } from "../gl/modelLoader";
import { drawCachedTurretModel } from "../gl/turretRaster";

export const turretAimMap = new Map<number, { angle: number; lastMs: number }>();

let cachedTurretModel: UnitModel | null = null;
export function getTurretModel(): UnitModel {
  if (!cachedTurretModel) {
    cachedTurretModel = buildTurretHeadModel();
  }
  return cachedTurretModel;
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

  ctx.save();
  ctx.fillStyle = "rgba(8, 12, 16, 0.55)";
  ctx.beginPath();
  ctx.ellipse(mountX - 0.5 * z, mountY + 0.5 * z, 14 * z, 7.2 * z, 0, 0, Math.PI * 2);
  ctx.fill();

  const shadowOffsetX = -cos * 2.5 * z + 1.2 * z;
  const shadowOffsetY = -sin * 1.2 * z + 2.0 * z;
  ctx.fillStyle = "rgba(6, 9, 12, 0.35)";
  ctx.beginPath();
  ctx.ellipse(mountX + shadowOffsetX, mountY + shadowOffsetY, 11 * z, 5.5 * z, angle - Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const pal = state.factions[e.owner]?.palette ?? state.factions[0]?.palette;
  const model = getTurretModel();
  const recoilRatio = isFiring ? (e.cooldown - 11) / 3 : 0;
  drawCachedTurretModel(ctx, model, mountX, mountY - 3 * z, z, angle - Math.PI / 4, pal, recoilRatio);

  const forwardDist = 26 * z - recoil;
  const barrelSpread = 2.4 * z;
  const perpX = -sin * barrelSpread;
  const perpY = cos * barrelSpread * 0.5;

  const muzzleLX = mountX + cos * forwardDist + perpX;
  const muzzleLY = mountY + sin * forwardDist + perpY - 3 * z;
  const muzzleRX = mountX + cos * forwardDist - perpX;
  const muzzleRY = mountY + sin * forwardDist - perpY - 3 * z;

  if (target && target.hp > 0) {
    const b = tileToScreen(target.x, target.y, cam, entityElev(state, target));
    const targetY = b.y + 6 * z;

    ctx.save();
    const laserColor = e.owner === 0 ? "rgba(70, 226, 255, 0.45)" : "rgba(255, 77, 54, 0.45)";
    const laserGlow = e.owner === 0 ? "#46e2ff" : "#ff4d36";

    ctx.strokeStyle = laserColor;
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.setLineDash([4 * z, 4 * z]);

    ctx.beginPath();
    ctx.moveTo(muzzleLX, muzzleLY);
    ctx.lineTo(b.x, targetY);
    ctx.moveTo(muzzleRX, muzzleRY);
    ctx.lineTo(b.x, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(70, 226, 255, 0.28)";
    if (e.owner !== 0) ctx.fillStyle = "rgba(255, 77, 54, 0.28)";
    ctx.beginPath();
    ctx.arc(b.x, targetY, 4.2 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = laserGlow;
    ctx.beginPath();
    ctx.arc(b.x, targetY, 2.5 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (isFiring) {
    ctx.save();
    const flashStage = (e.cooldown - 11) / 3;
    const flashR = (3.5 + flashStage * 3.5) * z;

    for (const [mx, my] of [[muzzleLX, muzzleLY], [muzzleRX, muzzleRY]]) {
      ctx.fillStyle = "rgba(255, 170, 40, 0.22)";
      ctx.beginPath();
      ctx.arc(mx, my, flashR * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 170, 40, 0.4)";
      ctx.beginPath();
      ctx.arc(mx, my, flashR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff8d6";
      ctx.beginPath();
      ctx.arc(mx, my, flashR * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffe49e";
      ctx.lineWidth = Math.max(1, 1.5 * z);
      ctx.beginPath();
      ctx.moveTo(mx + perpX * 0.8, my + perpY * 0.8);
      ctx.lineTo(mx + perpX * 2.2 + cos * 3 * z, my + perpY * 2.2 + sin * 3 * z);
      ctx.moveTo(mx - perpX * 0.8, my - perpY * 0.8);
      ctx.lineTo(mx - perpX * 2.2 + cos * 3 * z, my - perpY * 2.2 + sin * 3 * z);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}
