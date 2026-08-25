import { BUILDING_STATS, sellRefundFor } from "../../catalog";
import { isBuildingEntity, type BuildingKind, type Entity, type SimEvent, type SimState } from "../../types";
import { byId, canPlaceBuilding, spawnBuilding } from "../world";
import { canRepair } from "../repair";
import { canSell } from "../sell";
import { UNIT_STATS } from "../../catalog";

export function startBuild(state: SimState, kind: BuildingKind, x: number, y: number): SimEvent[] {
  if (kind === "constructionYard" || kind === "objective") return [{ type: "commandRejected", reason: "invalid building" }];
  const tx = Math.round(x);
  const ty = Math.round(y);
  if (!canPlaceBuilding(state, kind, tx, ty)) return [{ type: "commandRejected", reason: "invalid placement" }];
  const yard = state.entities.find(
    (e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0 && e.constructing === 0,
  );
  if (!yard) return [{ type: "commandRejected", reason: "construction yard unavailable" }];
  const cost = BUILDING_STATS[kind].cost;
  if (state.credits[0] < cost) return [{ type: "commandRejected", reason: "insufficient credits" }];
  state.credits[0] -= cost;
  spawnBuilding(state, 0, kind, tx, ty, BUILDING_STATS[kind].buildTicks);
  return [];
}

export function cancelBuild(state: SimState, kind: BuildingKind): SimEvent[] {
  if (kind === "constructionYard" || kind === "objective") return [];
  let target: Entity | undefined;
  for (const e of state.entities) {
    if (e.hp <= 0 || e.owner !== 0 || e.class !== "building") continue;
    if (e.kind !== kind || e.constructing <= 0) continue;
    target = e;
  }
  if (!target) return [];
  target.hp = 0;
  target.constructing = 0;
  state.credits[0] += BUILDING_STATS[kind].cost;
  return [];
}

export function toggleRepair(state: SimState, buildingId: number): SimEvent[] {
  const e = byId(state, buildingId);
  if (!e || e.class !== "building" || e.owner !== 0) return [];
  if (e.repairing) {
    e.repairing = false;
    return [];
  }
  if (!canRepair(e)) return [];
  e.repairing = true;
  return [{ type: "repairStarted", x: e.x, y: e.y }];
}

export function refundQueuedUnits(state: SimState, e: Entity): void {
  if (e.producing) {
    state.credits[0] += UNIT_STATS[e.producing.kind].cost;
    e.producing = undefined;
  }
  if (!e.queue?.length) return;
  for (const unit of e.queue) state.credits[0] += UNIT_STATS[unit].cost;
  e.queue = [];
}

export function sellBuilding(state: SimState, buildingId: number): SimEvent[] {
  const e = byId(state, buildingId);
  if (!e || !isBuildingEntity(e) || e.owner !== 0 || !canSell(e)) return [];
  refundQueuedUnits(state, e);
  state.credits[0] += sellRefundFor(e.kind, e.hp);
  e.hp = 0;
  e.repairing = false;
  state.losses.buildings[0] += 1;
  return [{ type: "sold", id: e.id, kind: e.kind, x: e.x, y: e.y }];
}
