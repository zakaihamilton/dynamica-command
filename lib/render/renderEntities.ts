import { BUILDING_STATS, footprintOf } from "../catalog";
import { toFacing } from "./anim";
import type { BuildingKind, Entity, Facing, SimState } from "../types";

export function entityVariant(state: SimState, e: Entity): number {
  return ((state.seed * 2654435761) ^ (e.id * 2246822519)) >>> 0;
}

export function constructionStage(e: Entity): 0 | 1 | 2 | 3 {
  if (e.constructing <= 0 || e.class !== "building") return 3;
  const total = BUILDING_STATS[e.kind as BuildingKind].buildTicks || 1;
  return Math.max(0, Math.min(2, Math.floor((1 - e.constructing / total) * 3))) as 0 | 1 | 2;
}

export function depthOf(e: Entity): number {
  if (e.class === "building") {
    const fp = footprintOf(e.kind as BuildingKind);
    return e.x + fp.w - 1 + (e.y + fp.h - 1);
  }
  return e.x + e.y;
}

export function facingFor(state: SimState, e: Entity, entityById: Map<number, Entity>): Facing {
  let target: { x: number; y: number } | undefined;
  if (e.attackTarget !== undefined) target = entityById.get(e.attackTarget);
  if (!target && e.path.length) target = e.path[0];
  if (target) {
    const next = toFacing(target.x - e.x, target.y - e.y);
    e.facing = next;
    return next;
  }
  return e.facing ?? ((e.owner === 0 ? 0 : 4) as Facing);
}
