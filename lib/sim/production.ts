import type { BuildingKind, SimEvent, SimState, UnitKind } from "../types";
import { powerFor, spawnUnit } from "./world";

function openTileNear(state: SimState, x: number, y: number): { x: number; y: number } {
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
        const blocked = state.entities.some(
          (e) => e.hp > 0 && e.class === "building" && e.x === nx && e.y === ny,
        );
        const water = state.tiles[ny * state.width + nx] === 1;
        if (!blocked && !water) return { x: nx, y: ny };
      }
    }
  }
  return { x, y };
}

export function tickProduction(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const lowPower = [powerFor(state, 0) < 0, powerFor(state, 1) < 0];
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
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
        const spot = openTileNear(state, e.x, e.y);
        spawnUnit(state, e.owner, kind, spot.x, spot.y);
        state.unitsProduced[e.owner] += 1;
        if (e.owner === 0) state.unitsProducedByRole[kind] += 1;
        events.push({ type: "produced", owner: e.owner, kind });
        e.producing = undefined;
      }
    }
  }
  return events;
}
