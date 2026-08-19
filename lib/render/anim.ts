import { BUILDING_STATS, UNIT_STATS } from "../catalog";
import { TICK_MS } from "../game/loop";
import type { BuildingKind, Entity, Facing, UnitKind } from "../types";

export type AnimFrame = 0 | 1 | 2 | 3;
export type UnitPose = "idle" | "move" | "attack" | "work";

export type UnitAnim = {
  pose: UnitPose;
  frame: AnimFrame;
  bobY: number;
  swayX: number;
  recoil: number;
};

export type BuildingAnim = {
  frame: AnimFrame;
  constructing: boolean;
  producing: boolean;
  repairing: boolean;
  damageStage: 0 | 1 | 2;
  lightOn: boolean;
  smoke: number;
  spark: number;
  antenna: number;
  doorOpen: boolean;
};

export function animClock(tick: number, clockMs?: number): number {
  return clockMs ?? tick * TICK_MS;
}

export function animFrame(timeMs: number, periodMs: number, count: 4, offset = 0): AnimFrame {
  const n = Math.max(1, count);
  const period = Math.max(1, periodMs);
  return (((Math.floor(timeMs / period) + offset) % n) + n) % n as AnimFrame;
}

export function toFacing(dx: number, dy: number): Facing {
  const angle = Math.atan2(dy, dx);
  return ((Math.round((angle / (Math.PI * 2)) * 8) + 8) % 8) as Facing;
}

export function facingVector(facing: Facing): { x: number; y: number } {
  const angle = (facing / 8) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) * 0.52 };
}

export function unitMovementOffset(kind: UnitKind, frame: AnimFrame): { bobY: number; swayX: number } {
  const infantry = kind === "infantry" || kind === "antiArmor";
  const gait = [0, 1, 0, -1][frame] ?? 0;
  return {
    // Keep the unit's contact point close to the ground. Infantry gets a
    // restrained step bob; tracked vehicles stay level and sell movement
    // through their tread animation instead of hovering up and down.
    bobY: infantry ? gait * 0.55 : 0,
    swayX: infantry ? gait * 0.25 : 0,
  };
}

export function unitPose(e: Entity): UnitPose {
  if (e.class !== "unit") return "idle";
  if (e.path.length > 0) return "move";
  if (e.attackTarget !== undefined) return "attack";
  if (e.kind === "harvester" && e.gatherX !== undefined && e.carry < UNIT_STATS.harvester.carryMax) return "work";
  return "idle";
}

export function unitAnim(e: Entity, tick: number, clockMs?: number): UnitAnim {
  const t = animClock(tick, clockMs);
  const pose = unitPose(e);
  if (pose === "move") {
    const frame = animFrame(t, 90, 4, e.id);
    const offset = unitMovementOffset(e.kind as UnitKind, frame);
    return {
      pose,
      frame,
      bobY: offset.bobY,
      swayX: offset.swayX,
      recoil: 0,
    };
  }
  if (pose === "attack") {
    const recoil = attackRecoil(e);
    return {
      pose,
      frame: recoil > 0 ? 2 : 0,
      bobY: 0,
      swayX: 0,
      recoil,
    };
  }
  if (pose === "work") {
    const frame = animFrame(t, 140, 4, e.id);
    return { pose, frame, bobY: 0, swayX: 0, recoil: 0 };
  }
  return {
    pose: "idle",
    frame: 0,
    bobY: 0,
    swayX: 0,
    recoil: 0,
  };
}

export function buildingAnim(e: Entity, tick: number, clockMs?: number): BuildingAnim {
  const t = animClock(tick, clockMs);
  const phase = t * 0.001 + e.id * 0.29;
  const hpRatio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  const damageStage = hpRatio < 0.34 ? 2 : hpRatio < 0.67 ? 1 : 0;
  const constructing = e.constructing > 0;
  const producing = Boolean(e.producing);
  const repairing = Boolean(e.repairing) && !constructing;
  const frame = animFrame(t, constructing || producing || repairing ? 110 : 280, 4, e.id);
  return {
    frame,
    constructing,
    producing,
    repairing,
    damageStage,
    lightOn: Math.sin(phase * (producing ? 14 : 5.5)) > (damageStage > 0 ? 0.15 : -0.15),
    smoke: (Math.sin(phase * 1.8) + 1) * 0.5,
    spark: constructing || producing || repairing ? (Math.sin(phase * 17) + 1) * 0.5 : 0,
    antenna: Math.sin(phase * 3.2) * 3,
    doorOpen: producing && frame >= 1,
  };
}

export function constructionProgress(e: Entity): number {
  if (e.constructing <= 0 || e.class !== "building") return 1;
  const total = BUILDING_STATS[e.kind as BuildingKind].buildTicks || 1;
  return Math.max(0, Math.min(1, 1 - e.constructing / total));
}

export function waterShimmer(timeMs: number, x: number, y: number): { offset: number; alpha: number } {
  const phase = timeMs * 0.0022 + x * 0.73 + y * 0.41;
  return {
    offset: Math.sin(phase) * 3.2,
    alpha: 0.1 + (Math.sin(phase * 1.4) + 1) * 0.08,
  };
}

export function selectionPulse(timeMs: number): number {
  return 0.55 + (Math.sin(timeMs * 0.007) + 1) * 0.22;
}

export function damageFlicker(timeMs: number, id: number, damageStage: 0 | 1 | 2): number {
  if (damageStage <= 0) return 1;
  const phase = timeMs * 0.011 + id * 1.7;
  const dip = damageStage > 1 ? 0.28 : 0.14;
  return 1 - ((Math.sin(phase) + 1) * 0.5) * dip;
}

function attackRecoil(e: Entity): number {
  const max = e.class === "unit" ? UNIT_STATS[e.kind as UnitKind].cooldown : e.kind === "turret" ? 14 : 0;
  if (max <= 0 || e.cooldown <= 0) return 0;
  const firedAgo = max - e.cooldown;
  if (firedAgo > 4) return 0;
  return 1 - firedAgo / 4;
}
