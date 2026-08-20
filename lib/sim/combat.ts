import { BUILDING_STATS, UNIT_STATS } from "../catalog";
import type { ArmorType, BuildingKind, Entity, SimEvent, SimState, UnitKind, WeaponType } from "../types";
import { tryFindPath } from "./pathBudget";
import { byId, closestApproach, distToEntity, living } from "./world";
import { rngFromState, type Rng } from "../seed/rng";

const CELL = 8;
const ALERT_MUTE_TICKS = 72;

type AlertMute = { harvesterUntil: number; yardUntil: number; convoyUntil: number };
type PendingAlerts = { harvester: boolean; yard: boolean; convoy: boolean };

const alertMute = new WeakMap<SimState, AlertMute>();

type CombatGrid = {
  cols: number;
  rows: number;
  cells: Entity[][];
  order: Map<number, number>;
  all: Entity[];
};

function statsFor(e: Entity): { damage: number; range: number; cooldown: number; weapon: WeaponType; splashRadius: number; suppression: number } {
  if (e.class === "unit") return UNIT_STATS[e.kind as UnitKind];
  if (e.kind === "turret") {
    return { damage: 9, range: 5.5, cooldown: 14, weapon: "cannon", splashRadius: 0.5, suppression: 10 };
  }
  return { damage: 0, range: 0, cooldown: 0, weapon: "smallArms", splashRadius: 0, suppression: 0 };
}

function isCombatTarget(e: Entity): boolean {
  return !e.neutral || e.scenarioRole === "convoy";
}

function isCombatThreat(e: Entity): boolean {
  if (!isCombatTarget(e)) return false;
  if (e.class === "building" && e.constructing > 0) return false;
  return statsFor(e).damage > 0;
}

function buildGrid(state: SimState): CombatGrid {
  const cols = Math.max(1, Math.ceil(state.width / CELL));
  const rows = Math.max(1, Math.ceil(state.height / CELL));
  const cells: Entity[][] = Array.from({ length: cols * rows }, () => []);
  const order = new Map<number, number>();
  const all = living(state);
  for (let i = 0; i < all.length; i++) {
    const e = all[i]!;
    order.set(e.id, i);
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(e.x / CELL)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(e.y / CELL)));
    cells[cy * cols + cx]!.push(e);
  }
  return { cols, rows, cells, order, all };
}

function closestEnemy(
  grid: CombatGrid,
  e: Entity,
  maxDist: number,
  threatsOnly: boolean,
): Entity | undefined {
  const reach = maxDist + 3;
  const x0 = Math.max(0, Math.floor((e.x - reach) / CELL));
  const y0 = Math.max(0, Math.floor((e.y - reach) / CELL));
  const x1 = Math.min(grid.cols - 1, Math.floor((e.x + reach) / CELL));
  const y1 = Math.min(grid.rows - 1, Math.floor((e.y + reach) / CELL));
  let best: Entity | undefined;
  let bestD = Infinity;
  let bestOrder = Infinity;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const bucket = grid.cells[cy * grid.cols + cx];
      if (!bucket) continue;
      for (const o of bucket) {
        if (o.hp <= 0) continue;
        if (!isCombatTarget(o)) continue;
        if (o.owner === e.owner) continue;
        if (threatsOnly && !isCombatThreat(o)) continue;
        const d = distToEntity(e, o);
        if (d > maxDist) continue;
        const rank = grid.order.get(o.id) ?? Infinity;
        if (d < bestD || (d === bestD && rank < bestOrder)) {
          bestD = d;
          bestOrder = rank;
          best = o;
        }
      }
    }
  }
  return best;
}

function acquire(grid: CombatGrid, e: Entity, threatsOnly = false): Entity | undefined {
  const { range } = statsFor(e);
  const sight = e.class === "unit" ? UNIT_STATS[e.kind as UnitKind].sight : BUILDING_STATS[e.kind as BuildingKind].sight;
  return closestEnemy(grid, e, Math.max(range + 4, sight), threatsOnly);
}

function acquirePreferred(grid: CombatGrid, e: Entity): Entity | undefined {
  return acquire(grid, e, true) ?? acquire(grid, e, false);
}

function pathDest(path: { x: number; y: number }[]): { x: number; y: number } | undefined {
  return path[path.length - 1];
}

function armorFor(e: Entity): ArmorType {
  return e.armor ?? (e.class === "building" ? BUILDING_STATS[e.kind as BuildingKind].armor : UNIT_STATS[e.kind as UnitKind].armor);
}

function lineOfSight(state: SimState, from: Entity, to: Entity): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(from.x - to.x, from.y - to.y) * 2));
  const source = state.heights[Math.round(from.y) * state.width + Math.round(from.x)] ?? 1;
  const target = state.heights[Math.round(to.y) * state.width + Math.round(to.x)] ?? 1;
  const horizon = Math.max(source, target);
  for (let i = 1; i < steps; i++) {
    const x = Math.round(from.x + (to.x - from.x) * i / steps);
    const y = Math.round(from.y + (to.y - from.y) * i / steps);
    if ((state.heights[y * state.width + x] ?? 1) > horizon) return false;
  }
  return true;
}

function damageMultiplier(weapon: WeaponType, armor: ArmorType): number {
  if (weapon === "smallArms") return armor === "light" ? 1 : armor === "heavy" ? 0.45 : 0.2;
  if (weapon === "antiArmor") return armor === "heavy" ? 1.35 : armor === "structure" ? 0.95 : 0.9;
  return armor === "light" ? 1.15 : 1;
}

function heightMultiplier(state: SimState, from: Entity, to: Entity): number {
  const source = state.heights[Math.round(from.y) * state.width + Math.round(from.x)] ?? 1;
  const target = state.heights[Math.round(to.y) * state.width + Math.round(to.x)] ?? 1;
  return source > target ? 1.12 : source < target ? 0.9 : 1;
}

function notePlayerAlert(attacker: Entity, target: Entity, pending: PendingAlerts): void {
  if (attacker.owner !== 1 || target.owner !== 0) return;
  if (target.kind === "constructionYard") pending.yard = true;
  else if (target.scenarioRole === "convoy") pending.convoy = true;
  else if (target.kind === "harvester") pending.harvester = true;
}

function flushPlayerAlerts(state: SimState, pending: PendingAlerts, events: SimEvent[]): void {
  const category = pending.yard ? "yard" : pending.convoy ? "convoy" : pending.harvester ? "harvester" : undefined;
  if (!category) return;
  const mute = alertMute.get(state) ?? {
    harvesterUntil: Number.NEGATIVE_INFINITY,
    yardUntil: Number.NEGATIVE_INFINITY,
    convoyUntil: Number.NEGATIVE_INFINITY,
  };
  const until = category === "yard" ? mute.yardUntil : category === "convoy" ? mute.convoyUntil : mute.harvesterUntil;
  if (state.tick < until) return;
  if (category === "yard") mute.yardUntil = state.tick + ALERT_MUTE_TICKS;
  else if (category === "convoy") mute.convoyUntil = state.tick + ALERT_MUTE_TICKS;
  else mute.harvesterUntil = state.tick + ALERT_MUTE_TICKS;
  alertMute.set(state, mute);
  events.push(
    category === "yard"
      ? { type: "alert", kind: "warning", text: "Construction yard under attack" }
      : category === "convoy"
        ? { type: "alert", kind: "contact", text: "Convoy under attack" }
        : { type: "alert", kind: "contact", text: "Harvester under attack" },
  );
}

function strike(
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
    for (const splash of living(state)) {
      if (splash.id === target.id || splash.hp <= 0 || splash.owner === e.owner || splash.neutral) continue;
      if (Math.hypot(splash.x - target.x, splash.y - target.y) > stats.splashRadius) continue;
      splash.hp -= damage * 0.35;
      if (splash.class === "unit") splash.suppression = Math.min(100, (splash.suppression ?? 0) + Math.round(stats.suppression * 0.35));
    }
  }
  if (target.hp > 0) return;
  target.hp = 0;
  if (target.class === "unit") state.losses.units[target.owner] += 1;
  else state.losses.buildings[target.owner] += 1;
  events.push({ type: "destroyed", id: target.id, kind: String(target.kind) });
  if (e.attackTarget === target.id) e.attackTarget = undefined;
}

function chase(state: SimState, e: Entity, target: Entity): void {
  const dest = target.class === "building" ? closestApproach(state, e, target) : target;
  const end = pathDest(e.path);
  const stale = !end || Math.hypot(end.x - dest.x, end.y - dest.y) > 1.25;
  if (!e.path.length || stale) {
    const path = tryFindPath(state, e, dest);
    if (path !== undefined) e.path = path;
  }
}

function resumeAttackMove(state: SimState, e: Entity): void {
  if (e.orderMode !== "attackMove" || !e.orderDestination) {
    e.idle = true;
    return;
  }
  const path = tryFindPath(state, e, e.orderDestination);
  if (path !== undefined) e.path = path;
  e.idle = false;
}

export function tickCombat(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const pending: PendingAlerts = { harvester: false, yard: false, convoy: false };
  const rng = rngFromState(state.rngState);
  const grid = buildGrid(state);
  for (const e of living(state)) {
    if (e.class === "unit") e.suppression = Math.max(0, (e.suppression ?? 0) - 1);
    const st = statsFor(e);
    if (st.damage <= 0 || e.neutral) continue;
    if (e.constructing > 0) continue;
    if (e.cooldown > 0) e.cooldown -= 1;

    const ordered = e.class === "unit" && !e.idle;
    if (ordered && e.attackTarget !== undefined) {
      const assigned = byId(state, e.attackTarget);
      if (!assigned) {
        e.attackTarget = undefined;
        resumeAttackMove(state, e);
      } else {
        const d = distToEntity(e, assigned);
        if (d <= st.range) {
          e.path = [];
          if (lineOfSight(state, e, assigned)) strike(state, e, assigned, st, rng, events, pending);
          if (e.attackTarget === undefined) resumeAttackMove(state, e);
        } else {
          const intercept = e.owner === 1 && !isCombatThreat(assigned)
            ? closestEnemy(grid, e, st.range, true)
            : undefined;
          if (intercept && lineOfSight(state, e, intercept)) {
            e.attackTarget = intercept.id;
            e.path = [];
            strike(state, e, intercept, st, rng, events, pending);
          } else {
            chase(state, e, assigned);
          }
        }
        continue;
      }
    }

    if (ordered && e.path.length > 0) {
      if (e.orderMode === "attackMove") {
        const visible = acquire(grid, e, false);
        if (visible && lineOfSight(state, e, visible)) {
          e.attackTarget = visible.id;
          e.path = [];
          if (distToEntity(e, visible) <= st.range) {
            strike(state, e, visible, st, rng, events, pending);
            if (e.attackTarget === undefined) resumeAttackMove(state, e);
          } else chase(state, e, visible);
        } else {
          const opportunity = closestEnemy(grid, e, st.range, false);
          if (opportunity && lineOfSight(state, e, opportunity)) strike(state, e, opportunity, st, rng, events, pending);
        }
      } else {
        const opportunity = closestEnemy(grid, e, st.range, false);
        if (opportunity && lineOfSight(state, e, opportunity)) strike(state, e, opportunity, st, rng, events, pending);
      }
      continue;
    }

    if (ordered) e.idle = true;

    const stance = e.class === "unit" ? (e.stance ?? "aggressive") : "aggressive";
    const hold = stance === "hold";
    const defend = stance === "defensive";
    const inRangeThreat = hold ? undefined : closestEnemy(grid, e, st.range, true);
    let target = inRangeThreat ?? (hold ? undefined : e.attackTarget !== undefined ? byId(state, e.attackTarget) : undefined);
    if (target && !isCombatThreat(target)) {
      const threat = hold || defend ? closestEnemy(grid, e, st.range, true) : acquire(grid, e, true);
      if (threat) {
        target = threat;
        e.path = [];
      }
    }
    if (!target && !hold && !defend) target = acquirePreferred(grid, e);
    if (target) e.attackTarget = target.id;
    else {
      if (hold || defend) e.attackTarget = undefined;
      continue;
    }

    const d = distToEntity(e, target);
    if (d <= st.range && lineOfSight(state, e, target)) {
      e.path = [];
      strike(state, e, target, st, rng, events, pending);
      continue;
    }

    if (e.class === "unit" && !hold && !defend) chase(state, e, target);
    else {
      e.path = [];
      e.attackTarget = undefined;
    }
  }
  flushPlayerAlerts(state, pending, events);
  state.rngState = rng.state;
  return events;
}
