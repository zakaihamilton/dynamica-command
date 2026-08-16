import { BUILDING_STATS, UNIT_STATS } from "../catalog";
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
    const cx = Math.round(e.x);
    const cy = Math.round(e.y);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!inBounds(state, x, y)) continue;
        if (Math.hypot(x - e.x, y - e.y) <= sight) {
          state.fog[at(state, x, y)] = 2;
        }
      }
    }
  }
}
