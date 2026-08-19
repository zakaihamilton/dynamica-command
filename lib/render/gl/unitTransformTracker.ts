import { UNIT_STATS } from "../../catalog";
import { groundHeight } from "../../sim/world";
import type { Entity, SimState, UnitKind } from "../../types";
import { lerp, lerpAngle } from "./glMath";

export type UnitDynamicTransform = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  turretYaw: number;
  barrelPitch: number;
  recoil: number;
  legLAngle: number;
  legRAngle: number;
  scoopAngle: number;
};

type UnitStateHistory = {
  id: number;
  prevX: number;
  prevY: number;
  currX: number;
  currY: number;
  lastUpdateTick: number;
  yaw: number;
  turretYaw: number;
  stridePhase: number;
  lastClockMs: number;
};

const historyMap = new Map<number, UnitStateHistory>();

export function resetUnitTransformTracker(): void {
  historyMap.clear();
}

export function updateUnitHistory(state: SimState, clockMs: number): void {
  const activeIds = new Set<number>();

  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit") continue;
    activeIds.add(e.id);

    let hist = historyMap.get(e.id);
    if (!hist) {
      const initialYaw = e.facing !== undefined ? (e.facing / 8) * Math.PI * 2 - Math.PI / 4 : -Math.PI / 4;
      hist = {
        id: e.id,
        prevX: e.x,
        prevY: e.y,
        currX: e.x,
        currY: e.y,
        lastUpdateTick: state.tick,
        yaw: initialYaw,
        turretYaw: initialYaw,
        stridePhase: 0,
        lastClockMs: clockMs,
      };
      historyMap.set(e.id, hist);
    } else {
      if (state.tick !== hist.lastUpdateTick) {
        const tickGap = state.tick - hist.lastUpdateTick;
        const jump = Math.hypot(e.x - hist.currX, e.y - hist.currY);
        if (tickGap > 2 || jump > 2) {
          hist.prevX = e.x;
          hist.prevY = e.y;
        } else {
          hist.prevX = hist.currX;
          hist.prevY = hist.currY;
        }
        hist.currX = e.x;
        hist.currY = e.y;
        hist.lastUpdateTick = state.tick;
      }
    }
  }

  // Cleanup dead/removed entities
  for (const id of historyMap.keys()) {
    if (!activeIds.has(id)) {
      historyMap.delete(id);
    }
  }
}

export function computeUnitDynamicTransform(
  e: Entity,
  state: SimState,
  subTickAlpha: number,
  clockMs: number,
): UnitDynamicTransform {
  let hist = historyMap.get(e.id);
  if (!hist) {
    const initialYaw = e.facing !== undefined ? (e.facing / 8) * Math.PI * 2 - Math.PI / 4 : -Math.PI / 4;
    hist = {
      id: e.id,
      prevX: e.x,
      prevY: e.y,
      currX: e.x,
      currY: e.y,
      lastUpdateTick: state.tick,
      yaw: initialYaw,
      turretYaw: initialYaw,
      stridePhase: 0,
      lastClockMs: clockMs,
    };
    historyMap.set(e.id, hist);
  }

  const dt = Math.max(0.001, Math.min(0.1, (clockMs - hist.lastClockMs) * 0.001));
  hist.lastClockMs = clockMs;

  const alpha = Math.max(0, Math.min(1, subTickAlpha));
  const x = lerp(hist.prevX, hist.currX, alpha);
  const y = lerp(hist.prevY, hist.currY, alpha);
  const z = groundHeight(state, x, y);

  // Terrain slope calculation (pitch / roll)
  const delta = 0.35;
  const hX1 = groundHeight(state, x + delta, y);
  const hX0 = groundHeight(state, x - delta, y);
  const hY1 = groundHeight(state, x, y + delta);
  const hY0 = groundHeight(state, x, y - delta);

  const slopeX = (hX1 - hX0) / (delta * 2);
  const slopeY = (hY1 - hY0) / (delta * 2);

  // Target yaw calculation based on movement velocity, path, or explicit facing
  const moveDx = hist.currX - hist.prevX;
  const moveDy = hist.currY - hist.prevY;
  const moveDist = Math.hypot(moveDx, moveDy);

  let targetYaw = hist.yaw;
  if (moveDist > 0.005) {
    targetYaw = Math.atan2(moveDy, moveDx) - Math.PI / 4;
  } else if (e.path.length > 0 && e.path[0]) {
    targetYaw = Math.atan2(e.path[0].y - y, e.path[0].x - x) - Math.PI / 4;
  } else if (e.facing !== undefined) {
    targetYaw = (e.facing / 8) * Math.PI * 2 - Math.PI / 4;
  }

  // Smooth angular interpolation for chassis
  const turnSpeed = e.kind === "tank" ? 9.0 : 14.0;
  hist.yaw = lerpAngle(hist.yaw, targetYaw, Math.min(1, dt * turnSpeed));

  // Compute pitch and roll aligned with current heading
  const cosYaw = Math.cos(hist.yaw + Math.PI / 4);
  const sinYaw = Math.sin(hist.yaw + Math.PI / 4);
  const pitch = -(slopeX * cosYaw + slopeY * sinYaw) * 0.45;
  const roll = (slopeX * sinYaw - slopeY * cosYaw) * 0.45;

  // Turret aim tracking
  let targetTurretYaw = targetYaw;
  let barrelPitch = 0;
  if (e.attackTarget !== undefined) {
    const targetEntity = state.entities.find((t) => t.id === e.attackTarget && t.hp > 0);
    if (targetEntity) {
      const tDx = targetEntity.x - x;
      const tDy = targetEntity.y - y;
      targetTurretYaw = Math.atan2(tDy, tDx) - Math.PI / 4;
      const tZ = groundHeight(state, targetEntity.x, targetEntity.y);
      const dist = Math.max(0.5, Math.hypot(tDx, tDy));
      barrelPitch = Math.atan2(tZ - z, dist) * 0.5;
    }
  }

  hist.turretYaw = lerpAngle(hist.turretYaw, targetTurretYaw, Math.min(1, dt * 12.0));

  // Stride phase for walkers
  const isMoving = moveDist > 0.001 || e.path.length > 0;
  const speed = isMoving ? UNIT_STATS[e.kind as UnitKind].speed * 20 : 0;
  hist.stridePhase += speed * dt * 12.0;

  const legLAngle = isMoving ? Math.sin(hist.stridePhase) * 0.6 : 0;
  const legRAngle = isMoving ? -Math.sin(hist.stridePhase) * 0.6 : 0;

  // Recoil
  let recoil = 0;
  const maxCooldown = UNIT_STATS[e.kind as UnitKind].cooldown;
  if (maxCooldown > 0 && e.cooldown > 0) {
    const firedAgo = maxCooldown - e.cooldown;
    if (firedAgo <= 4) {
      recoil = 1 - firedAgo / 4;
    }
  }

  // Harvester scoop
  let scoopAngle = 0;
  if (e.kind === "harvester") {
    if (e.gatherX !== undefined) {
      scoopAngle = Math.sin(clockMs * 0.008) * 0.25 - 0.2;
    }
  }

  return {
    x,
    y,
    z,
    yaw: hist.yaw,
    pitch,
    roll,
    turretYaw: hist.turretYaw,
    barrelPitch,
    recoil,
    legLAngle,
    legRAngle,
    scoopAngle,
  };
}
