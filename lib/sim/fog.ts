import { BUILDING_STATS, UNIT_STATS, footprintOf } from "../catalog";
import type { BuildingKind, SimState, UnitKind } from "../types";
import { at, inBounds, living } from "./world";

export function tickFog(state: SimState): void {
  for (let i = 0; i < state.fog.length; i++) {
    if (state.fog[i] === 2) state.fog[i] = 1;
  }
  for (const e of living(state)) {
    if (e.owner !== 0) continue;
    const sight =
      e.class === "unit"
        ? UNIT_STATS[e.kind as UnitKind].sight
        : BUILDING_STATS[e.kind as BuildingKind].sight;
    const r = Math.ceil(sight);
    let cx = e.x;
    let cy = e.y;
    if (e.class === "building") {
      const fp = footprintOf(e.kind as BuildingKind);
      cx = e.x + (fp.w - 1) / 2;
      cy = e.y + (fp.h - 1) / 2;
    }
    const ox = Math.round(cx);
    const oy = Math.round(cy);
    for (let y = oy - r; y <= oy + r; y++) {
      for (let x = ox - r; x <= ox + r; x++) {
        if (!inBounds(state, x, y)) continue;
        if (Math.hypot(x - cx, y - cy) <= sight) {
          state.fog[at(state, x, y)] = 2;
        }
      }
    }
  }
}
