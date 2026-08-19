import { UNIT_STATS, footprintOf } from "../catalog";
import type { BuildingKind, SimEvent, SimState, UnitKind } from "../types";
import { frontTileNear, openTileNear, powerFor, trySpawnUnit } from "./world";

function isUnitProducer(kind: string): kind is "barracks" | "factory" {
  return kind === "barracks" || kind === "factory";
}

function producerKey(owner: number, kind: string): string {
  return `${owner}:${kind}`;
}

/** Ready barracks/factories share work: one job runs at Nx, two jobs split the extra capacity. */
function productionRates(state: SimState): Map<number, number> {
  const ready = new Map<string, number>();
  const busyIds = new Map<string, number[]>();
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "building" || e.constructing > 0) continue;
    if (!isUnitProducer(e.kind)) continue;
    const key = producerKey(e.owner, e.kind);
    ready.set(key, (ready.get(key) ?? 0) + 1);
    if (e.producing) {
      const ids = busyIds.get(key) ?? [];
      ids.push(e.id);
      busyIds.set(key, ids);
    }
  }
  const rates = new Map<number, number>();
  for (const [key, ids] of busyIds) {
    const count = Math.max(ids.length, ready.get(key) ?? ids.length);
    const base = Math.floor(count / ids.length);
    const extra = count % ids.length;
    ids.forEach((id, i) => rates.set(id, base + (i < extra ? 1 : 0)));
  }
  return rates;
}

export function tickProduction(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const lowPower = [powerFor(state, 0) < 0, powerFor(state, 1) < 0];
  const rates = productionRates(state);
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
      e.producing.remaining -= rates.get(e.id) ?? 1;
      if (e.producing.remaining <= 0) {
        const kind = e.producing.kind as UnitKind;
        const fp = e.class === "building" ? footprintOf(e.kind as BuildingKind) : { w: 1, h: 1 };
        const spot = e.class === "building" && (e.kind === "barracks" || e.kind === "factory")
          ? frontTileNear(state, e)
          : openTileNear(state, e.x, e.y, fp.w, fp.h);
        const spawned = trySpawnUnit(state, e.owner, kind, spot.x, spot.y);
        if (!spawned) {
          // Keep the completed job pending until the producer has somewhere to deploy it.
          e.producing.remaining = 1;
          continue;
        }
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
