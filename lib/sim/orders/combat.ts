import { UNIT_STATS, isSupportUnit } from "../../catalog";
import { type Formation, type SimEvent, type SimState, type UnitKind } from "../../types";
import { findPath } from "../pathfinding";
import { byId, closestApproach } from "../world";
import { assignSupportTarget, canSupportEntity } from "../support";

export function attackUnits(state: SimState, ids: number[], targetId: number): SimEvent[] {
  const target = byId(state, targetId);
  if (!target || target.owner !== 1 || target.neutral) return [{ type: "commandRejected", reason: "invalid attack target" }];
  for (const id of ids) {
    const e = byId(state, id);
    if (!e || e.class !== "unit" || e.owner !== 0 || e.neutral) continue;
    if (e.kind === "harvester" || isSupportUnit(e.kind as UnitKind)) continue;
    e.attackTarget = targetId;
    e.orderMode = "attack";
    e.orderDestination = { x: target.x, y: target.y };
    e.gatherX = undefined;
    e.gatherY = undefined;
    e.idle = false;
    const range = UNIT_STATS[e.kind as UnitKind].range;
    const dest = target.class === "building" ? closestApproach(state, e, target) : target;
    if (Math.hypot(e.x - dest.x, e.y - dest.y) > range) {
      e.path = findPath(state, e, dest);
    }
  }
  return [];
}

export function supportUnits(state: SimState, ids: number[], targetId: number): SimEvent[] {
  const target = byId(state, targetId);
  if (!target || target.owner !== 0 || target.class !== "unit" || target.neutral) {
    return [{ type: "commandRejected", reason: "invalid support target" }];
  }
  let assigned = 0;
  for (const id of ids) {
    const provider = byId(state, id);
    if (!provider || provider.owner !== 0 || provider.class !== "unit" || provider.neutral) continue;
    if (!isSupportUnit(provider.kind as UnitKind) || !canSupportEntity(provider, target)) continue;
    assignSupportTarget(state, provider, target);
    assigned += 1;
  }
  return assigned ? [] : [{ type: "commandRejected", reason: "no eligible support unit" }];
}

export function setStance(state: SimState, ids: number[], stance: "aggressive" | "defensive" | "hold"): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (e?.owner === 0 && e.class === "unit") e.stance = stance;
  }
  return [];
}

export function setFormation(state: SimState, ids: number[], formation: Formation): SimEvent[] {
  for (const id of ids) {
    const e = byId(state, id);
    if (e?.owner === 0 && e.class === "unit") e.formation = formation;
  }
  return [];
}
