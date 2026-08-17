import { HARVEST_PER_TICK, UNIT_STATS } from "../catalog";
import { TILE_RESOURCE } from "../types";
import type { Entity, SimEvent, SimState } from "../types";
import { findPath } from "./pathfinding";
import { at, closestApproach, dist, distToEntity, living, nearest, tileAt } from "./world";

const CARRY_MAX = UNIT_STATS.harvester.carryMax;
const resourceIndex = new WeakMap<SimState, number[]>();

function resourceTiles(state: SimState): number[] {
  let list = resourceIndex.get(state);
  if (!list) {
    list = [];
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const i = at(state, x, y);
        if (tileAt(state, x, y) === TILE_RESOURCE && state.resourceAmount[i]! > 0) list.push(i);
      }
    }
    resourceIndex.set(state, list);
  }
  return list;
}

function dropResourceTile(state: SimState, index: number): void {
  const list = resourceIndex.get(state);
  if (!list) return;
  const atIndex = list.indexOf(index);
  if (atIndex >= 0) list.splice(atIndex, 1);
}

function nearestResource(state: SimState, from: Entity): { x: number; y: number } | undefined {
  const list = resourceTiles(state);
  let best: { x: number; y: number } | undefined;
  let bestD = Infinity;
  for (const i of list) {
    if (state.resourceAmount[i]! <= 0) continue;
    const x = i % state.width;
    const y = (i - x) / state.width;
    const d = dist(from, { x, y });
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  return best;
}

export function tickEconomy(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const e of living(state)) {
    if (e.kind !== "harvester" || e.hp <= 0) continue;
    if (e.carry >= CARRY_MAX) {
      const ref = nearest(
        state,
        e,
        (b) =>
          b.class === "building" &&
          b.kind === "refinery" &&
          b.owner === e.owner &&
          b.constructing === 0,
      );
      if (!ref) continue;
      if (distToEntity(e, ref) <= 1.6) {
        const amount = e.carry;
        e.carry = 0;
        state.credits[e.owner] += amount;
        state.creditsEarned[e.owner] += amount;
        events.push({ type: "credits", owner: e.owner, amount });
        e.path = [];
      } else if (!e.path.length) {
        e.path = findPath(state, e, closestApproach(state, e, ref));
      }
      continue;
    }

    let gx = e.gatherX;
    let gy = e.gatherY;
    if (gx === undefined || gy === undefined || state.resourceAmount[at(state, gx, gy)]! <= 0) {
      const n = nearestResource(state, e);
      if (!n) continue;
      gx = n.x;
      gy = n.y;
      e.gatherX = gx;
      e.gatherY = gy;
    }
    if (dist(e, { x: gx, y: gy }) <= 0.6) {
      const i = at(state, gx, gy);
      const take = Math.min(HARVEST_PER_TICK, state.resourceAmount[i]!, CARRY_MAX - e.carry);
      state.resourceAmount[i]! -= take;
      e.carry += take;
      e.path = [];
      if (state.resourceAmount[i]! <= 0) {
        state.tiles[i] = 0;
        e.gatherX = undefined;
        e.gatherY = undefined;
        dropResourceTile(state, i);
      }
    } else if (!e.path.length) {
      e.path = findPath(state, e, { x: gx, y: gy });
    }
  }
  return events;
}
