import { BUILDING_KINDS, UNIT_KINDS } from "../catalog";
import type { BuildingKind, EntityClass, Owner, SimEvent, SimState, UnitKind } from "../types";

export type FxKind = "muzzle" | "impact" | "explosion" | "rubble";

export type FxBurst = {
  id: number;
  kind: FxKind;
  x: number;
  y: number;
  elev: number;
  bornMs: number;
  durationMs: number;
  entityKind: string;
  entityClass: EntityClass;
  owner: Owner;
};

export const FX_DURATION: Record<FxKind, number> = {
  muzzle: 120,
  impact: 220,
  explosion: 360,
  rubble: 4000,
};

export function fxAge(burst: FxBurst, nowMs: number): number {
  return nowMs - burst.bornMs;
}

export function fxProgress(burst: FxBurst, nowMs: number): number {
  const duration = Math.max(1, burst.durationMs);
  return Math.max(0, Math.min(1, fxAge(burst, nowMs) / duration));
}

export function fxAlive(burst: FxBurst, nowMs: number): boolean {
  return fxAge(burst, nowMs) < burst.durationMs;
}

export function cullFx(bursts: FxBurst[], nowMs: number): FxBurst[] {
  const live = bursts.filter((burst) => fxAlive(burst, nowMs));
  return live.length > 64 ? live.slice(live.length - 64) : live;
}

export function entityClassOf(kind: string): EntityClass {
  if ((UNIT_KINDS as string[]).includes(kind)) return "unit";
  return "building";
}

export function burstsFromDestroyed(
  events: SimEvent[],
  state: SimState,
  nowMs: number,
  nextId: number,
): { bursts: FxBurst[]; nextId: number } {
  const bursts: FxBurst[] = [];
  let id = nextId;
  for (const event of events) {
    if (event.type !== "destroyed") continue;
    const entity = state.entities.find((item) => item.id === event.id);
    const kind = event.kind;
    const entityClass = entity?.class ?? entityClassOf(kind);
    const x = event.x;
    const y = event.y;
    const tx = Math.round(x);
    const ty = Math.round(y);
    const elev = state.heights[ty * state.width + tx] ?? 1;
    const owner = (entity?.owner ?? 0) as Owner;
    bursts.push({
      id: id++,
      kind: "explosion",
      x,
      y,
      elev,
      bornMs: nowMs,
      durationMs: FX_DURATION.explosion,
      entityKind: kind,
      entityClass,
      owner,
    });
    if (entityClass === "building") {
      bursts.push({
        id: id++,
        kind: "rubble",
        x,
        y,
        elev,
        bornMs: nowMs,
        durationMs: FX_DURATION.rubble,
        entityKind: kind,
        entityClass,
        owner,
      });
    }
  }
  return { bursts, nextId: id };
}

export function isUnitKind(kind: string): kind is UnitKind {
  return (UNIT_KINDS as string[]).includes(kind);
}

export function isBuildingKind(kind: string): kind is BuildingKind {
  return (BUILDING_KINDS as string[]).includes(kind);
}
