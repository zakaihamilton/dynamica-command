import type { Entity, SimEvent, SimState } from "../../types";
import { isUnitEntity } from "../../types";
import { closestApproach } from "../world";
import { statsFor } from "./grid";
import { armorFor, damageMultiplier, heightMultiplier } from "./targeting";
import type { Rng } from "../../seed/rng";
import { type PendingAlerts, notePlayerAlert } from "./alerts";
import { tryFindPathDetailed } from "../pathBudget";
import { routePendingFor } from "../pathfinding";

export function strike(
  state: SimState,
  e: Entity,
  target: Entity,
  stats: ReturnType<typeof statsFor>,
  rng: Rng,
  events: SimEvent[],
  pending: PendingAlerts,
): void {
  if (e.cooldown > 0) return;
  notePlayerAlert(e, target, pending);
  const jitter = 0.85 + rng.next() * 0.3;
  const damage = stats.damage * jitter * damageMultiplier(stats.weapon, armorFor(target)) * heightMultiplier(state, e, target);
  target.hp -= damage;
  e.cooldown = stats.cooldown;
  if (target.class === "unit") {
    target.suppression = Math.min(100, (target.suppression ?? 0) + stats.suppression);
  }
  if (stats.splashRadius > 0) {
    for (const splash of state.entities.filter((e) => e.hp > 0)) {
      if (splash.id === target.id || splash.hp <= 0 || splash.owner === e.owner || splash.neutral) continue;
      if (Math.hypot(splash.x - target.x, splash.y - target.y) > stats.splashRadius) continue;
      splash.hp -= damage * 0.35;
      if (splash.class === "unit") splash.suppression = Math.min(100, (splash.suppression ?? 0) + Math.round(stats.suppression * 0.35));
    }
  }
  const destroyed = target.hp <= 0;
  events.push({
    type: "combat",
    owner: e.owner,
    weapon: stats.weapon,
    x: e.x,
    y: e.y,
    targetX: target.x,
    targetY: target.y,
    targetOwner: target.owner,
    targetKind: target.kind,
    destroyed,
  });
  if (!destroyed) return;
  target.hp = 0;
  if (isUnitEntity(target)) state.losses.units[target.owner] += 1;
  else state.losses.buildings[target.owner] += 1;
  events.push({ type: "destroyed", id: target.id, owner: target.owner, kind: target.kind, x: target.x, y: target.y });
  if (e.attackTarget === target.id) e.attackTarget = undefined;
}

export function chase(state: SimState, e: Entity, target: Entity): void {
  const dest = target.class === "building" ? closestApproach(state, e, target) : target;
  const end = pathDest(e.path);
  const stale = !end || Math.hypot(end.x - dest.x, end.y - dest.y) > 1.25;
  if (!e.path.length || stale) {
    const result = tryFindPathDetailed(state, e, dest);
    if (result) {
      e.path = result.path;
      e.routePending = routePendingFor(result.status);
    }
  }
}

export function resumeAttackMove(state: SimState, e: Entity): void {
  if (e.orderMode !== "attackMove" || !e.orderDestination) {
    e.idle = true;
    return;
  }
  const result = tryFindPathDetailed(state, e, e.orderDestination);
  if (result) {
    e.path = result.path;
    e.routePending = routePendingFor(result.status);
  }
  e.idle = false;
}

function pathDest(path: { x: number; y: number }[]): { x: number; y: number } | undefined {
  return path[path.length - 1];
}
