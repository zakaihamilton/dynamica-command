import { BUILDING_STATS, UNIT_STATS } from "../catalog";
import type {
  BuildingKind,
  Entity,
  Owner,
  SimState,
  TileKind,
  UnitKind,
  Vec2,
} from "../types";
import { TILE_WATER } from "../types";

export function at(state: SimState, x: number, y: number): number {
  return y * state.width + x;
}

export function inBounds(state: SimState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function tileAt(state: SimState, x: number, y: number): TileKind {
  if (!inBounds(state, x, y)) return 1;
  return state.tiles[at(state, x, y)] as TileKind;
}

export function buildingAt(state: SimState, x: number, y: number): Entity | undefined {
  return state.entities.find(
    (e) => e.class === "building" && e.hp > 0 && e.x === x && e.y === y,
  );
}

export function isWalkable(state: SimState, x: number, y: number): boolean {
  if (!inBounds(state, x, y)) return false;
  if (tileAt(state, x, y) === TILE_WATER) return false;
  if (buildingAt(state, x, y)) return false;
  return true;
}

export function living(state: SimState): Entity[] {
  return state.entities.filter((e) => e.hp > 0);
}

export function byId(state: SimState, id: number): Entity | undefined {
  return state.entities.find((e) => e.id === id && e.hp > 0);
}

export function nextEntityId(state: SimState): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

export function makeUnit(
  state: SimState,
  owner: Owner,
  kind: UnitKind,
  x: number,
  y: number,
): Entity {
  const stats = UNIT_STATS[kind];
  return {
    id: nextEntityId(state),
    owner,
    class: "unit",
    kind,
    x,
    y,
    hp: stats.hp,
    maxHp: stats.hp,
    cooldown: 0,
    path: [],
    carry: 0,
    constructing: 0,
    marked: false,
    idle: true,
  };
}

export function makeBuilding(
  state: SimState,
  owner: Owner,
  kind: BuildingKind,
  x: number,
  y: number,
  constructing = 0,
  marked = false,
): Entity {
  const stats = BUILDING_STATS[kind];
  return {
    id: nextEntityId(state),
    owner,
    class: "building",
    kind,
    x,
    y,
    hp: stats.hp,
    maxHp: stats.hp,
    cooldown: 0,
    path: [],
    carry: 0,
    constructing,
    marked,
    idle: true,
  };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nearest(
  state: SimState,
  from: Vec2,
  pred: (e: Entity) => boolean,
): Entity | undefined {
  let best: Entity | undefined;
  let bestD = Infinity;
  for (const e of living(state)) {
    if (!pred(e)) continue;
    const d = dist(from, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function powerFor(state: SimState, owner: Owner): number {
  let p = 0;
  for (const e of living(state)) {
    if (e.class !== "building" || e.owner !== owner || e.constructing > 0) continue;
    p += BUILDING_STATS[e.kind as BuildingKind].power;
  }
  return p;
}

export function spawnUnit(
  state: SimState,
  owner: Owner,
  kind: UnitKind,
  x: number,
  y: number,
): Entity {
  const e = makeUnit(state, owner, kind, x, y);
  state.entities.push(e);
  return e;
}

export function spawnBuilding(
  state: SimState,
  owner: Owner,
  kind: BuildingKind,
  x: number,
  y: number,
  constructing = 0,
  marked = false,
): Entity {
  const e = makeBuilding(state, owner, kind, x, y, constructing, marked);
  state.entities.push(e);
  return e;
}

export function emptyRoleCounts(): Record<UnitKind, number> {
  return { harvester: 0, infantry: 0, antiArmor: 0, tank: 0 };
}
