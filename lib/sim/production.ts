import { footprintOf, UNIT_STATS } from "../catalog";
import type { BuildingKind, SimEvent, SimState, UnitKind } from "../types";
import { frontTileNear, openTileNear, powerFor, spawnUnit } from "./world";

export function tickProduction(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const lowPower = [powerFor(state, 0) < 0, powerFor(state, 1) < 0];
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    if (!e.queue) e.queue = [];
    if (e.constructing > 0) {
      if (lowPower[e.owner] && e.kind !== "power") continue;
      e.constructing -= 1;
      if (e.constructing <= 0) {
        e.constructing = 0;
        state.buildingsCompleted[e.owner] += 1;
        if (e.owner === 0) {
          const k = String(e.kind);
          state.buildingsCompletedByKind[k] = (state.buildingsCompletedByKind[k] ?? 0) + 1;
        }
        events.push({ type: "built", owner: e.owner, kind: e.kind as BuildingKind });
      }
      continue;
    }
    if (e.producing) {
      if (lowPower[e.owner]) continue;
      e.producing.remaining -= 1;
      if (e.producing.remaining <= 0) {
        const kind = e.producing.kind as UnitKind;
        const fp = e.class === "building" ? footprintOf(e.kind as BuildingKind) : { w: 1, h: 1 };
        const spot = e.class === "building" && (e.kind === "barracks" || e.kind === "factory")
          ? frontTileNear(state, e)
          : openTileNear(state, e.x, e.y, fp.w, fp.h);
        spawnUnit(state, e.owner, kind, spot.x, spot.y);
        state.unitsProduced[e.owner] += 1;
        if (e.owner === 0) state.unitsProducedByRole[kind] += 1;
        events.push({ type: "produced", owner: e.owner, kind });
        const next = e.queue.shift();
        e.producing = next
          ? { kind: next, remaining: UNIT_STATS[next].buildTicks }
          : undefined;
      }
    }
  }
  return events;
}
