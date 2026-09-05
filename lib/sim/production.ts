import { UNIT_STATS, footprintOf } from "../catalog";
import { isBuildingEntity, type SimEvent, type SimState } from "../types";
import { frontTileNear, invalidatePowerCache, openTileNear, powerFor, trySpawnUnit } from "./world";

const playerPowerOk = new WeakMap<SimState, boolean>();

function isUnitProducer(kind: string): kind is "barracks" | "factory" {
  return kind === "barracks" || kind === "factory";
}

function producerKey(owner: number, kind: string): string {
  return `${owner}:${kind}`;
}

/** Ready barracks/factories share work: one job runs at Nx, two jobs split the extra capacity. */
type ProductionBuffers = {
  ready: Map<string, number>;
  busyIds: Map<string, number[]>;
  rates: Map<number, number>;
};

const productionBuffers = new WeakMap<SimState, ProductionBuffers>();

function productionRates(state: SimState): Map<number, number> {
  const buffers = productionBuffers.get(state) ?? {
    ready: new Map<string, number>(),
    busyIds: new Map<string, number[]>(),
    rates: new Map<number, number>(),
  };
  buffers.ready.clear();
  buffers.busyIds.clear();
  buffers.rates.clear();
  productionBuffers.set(state, buffers);
  const { ready, busyIds, rates } = buffers;
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
  for (const [key, ids] of busyIds) {
    const count = Math.max(ids.length, ready.get(key) ?? ids.length);
    const base = Math.floor(count / ids.length);
    const extra = count % ids.length;
    ids.forEach((id, i) => rates.set(id, base + (i < extra ? 1 : 0)));
  }
  return rates;
}

const EMPTY_EVENTS: SimEvent[] = [];

export function tickProduction(state: SimState, eventSink?: SimEvent[], collectEvents = true): SimEvent[] {
  const events = eventSink ?? (collectEvents ? [] : undefined);
  const lowPower = [powerFor(state, 0) < 0, powerFor(state, 1) < 0];
  const rates = productionRates(state);
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    if (!e.queue) e.queue = [];
    if (e.constructing > 0) {
      if (lowPower[e.owner] && e.kind !== "power") continue;
      invalidatePowerCache(state);
      e.constructing -= 1;
      if (e.constructing <= 0) {
        e.constructing = 0;
        state.buildingsCompleted[e.owner] += 1;
        if (e.owner === 0) {
          const k = String(e.kind);
          state.buildingsCompletedByKind[k] = (state.buildingsCompletedByKind[k] ?? 0) + 1;
        }
        events?.push({
          type: "built",
          owner: e.owner,
          kind: isBuildingEntity(e) ? e.kind : "objective",
          id: e.id,
          x: e.x,
          y: e.y,
        });
      }
      continue;
    }
    if (e.producing) {
      if (lowPower[e.owner]) continue;
      e.producing.remaining -= rates.get(e.id) ?? 1;
      if (e.producing.remaining <= 0) {
        const kind = e.producing.kind;
        const fp = isBuildingEntity(e) ? footprintOf(e.kind) : { w: 1, h: 1 };
        const spot = isBuildingEntity(e) && isUnitProducer(e.kind)
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
        events?.push({
          type: "produced",
          owner: e.owner,
          kind,
          id: spawned.id,
          x: spawned.x,
          y: spawned.y,
          sourceId: e.id,
        });
        const next = e.queue.shift();
        e.producing = next
          ? { kind: next, remaining: UNIT_STATS[next].buildTicks }
          : undefined;
      }
    }
  }
  notePlayerPowerShortage(state, events);
  return events ?? EMPTY_EVENTS;
}

function notePlayerPowerShortage(state: SimState, events?: SimEvent[]): void {
  const ok = powerFor(state, 0) >= 0;
  const wasOk = playerPowerOk.get(state) ?? true;
  if (wasOk && !ok) events?.push({ type: "powerShortage", owner: 0 });
  playerPowerOk.set(state, ok);
}
