import { BUILDING_STATS, UNIT_STATS, footprintOf } from "../catalog";
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

export function heightAt(state: SimState, x: number, y: number): number {
  if (!inBounds(state, x, y)) return 0;
  return state.heights[at(state, x, y)] ?? 1;
}

export function occupies(e: Entity, x: number, y: number): boolean {
  if (e.hp <= 0) return false;
  if (e.class !== "building") {
    return Math.round(e.x) === x && Math.round(e.y) === y;
  }
  const fp = footprintOf(e.kind as BuildingKind);
  return x >= e.x && x < e.x + fp.w && y >= e.y && y < e.y + fp.h;
}

export function buildingAt(state: SimState, x: number, y: number): Entity | undefined {
  return state.entities.find((e) => e.class === "building" && occupies(e, x, y));
}

export function isWalkable(state: SimState, x: number, y: number): boolean {
  if (!inBounds(state, x, y)) return false;
  if (tileAt(state, x, y) === TILE_WATER) return false;
  if (buildingAt(state, x, y)) return false;
  return true;
}

export function canClimb(state: SimState, x0: number, y0: number, x1: number, y1: number): boolean {
  return Math.abs(heightAt(state, x1, y1) - heightAt(state, x0, y0)) <= 1;
}

export function canStep(state: SimState, x0: number, y0: number, x1: number, y1: number): boolean {
  return isWalkable(state, x1, y1) && canClimb(state, x0, y0, x1, y1);
}

export function footprintFlat(state: SimState, x: number, y: number, w: number, h: number): boolean {
  const h0 = heightAt(state, x, y);
  for (let oy = 0; oy < h; oy++) {
    for (let ox = 0; ox < w; ox++) {
      if (!inBounds(state, x + ox, y + oy)) return false;
      if (heightAt(state, x + ox, y + oy) !== h0) return false;
    }
  }
  return true;
}

export function canPlaceBuilding(state: SimState, kind: BuildingKind, x: number, y: number): boolean {
  const fp = footprintOf(kind);
  for (let oy = 0; oy < fp.h; oy++) {
    for (let ox = 0; ox < fp.w; ox++) {
      const tx = x + ox;
      const ty = y + oy;
      if (!inBounds(state, tx, ty)) return false;
      if (tileAt(state, tx, ty) === TILE_WATER) return false;
      if (buildingAt(state, tx, ty)) return false;
    }
  }
  return footprintFlat(state, x, y, fp.w, fp.h);
}

export function findBuildSite(
  state: SimState,
  kind: BuildingKind,
  nearX: number,
  nearY: number,
  maxR = 12,
): Vec2 | undefined {
  const cx = Math.round(nearX);
  const cy = Math.round(nearY);
  if (canPlaceBuilding(state, kind, cx, cy)) return { x: cx, y: cy };
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (canPlaceBuilding(state, kind, x, y)) return { x, y };
      }
    }
  }
  return undefined;
}

export function openTileNear(
  state: SimState,
  x: number,
  y: number,
  fw = 1,
  fh = 1,
): { x: number; y: number } {
  const originH = heightAt(state, x, y);
  for (let r = 1; r <= 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        const inside = nx >= x && nx < x + fw && ny >= y && ny < y + fh;
        if (inside) continue;
        if (!isWalkable(state, nx, ny)) continue;
        if (Math.abs(heightAt(state, nx, ny) - originH) > 1) continue;
        const unitThere = state.entities.some(
          (e) => e.hp > 0 && e.class === "unit" && Math.round(e.x) === nx && Math.round(e.y) === ny,
        );
        if (unitThere) continue;
        return { x: nx, y: ny };
      }
    }
  }
  return { x, y };
}

export function distToEntity(from: Vec2, e: Entity): number {
  if (e.class !== "building") return Math.hypot(from.x - e.x, from.y - e.y);
  const fp = footprintOf(e.kind as BuildingKind);
  let best = Infinity;
  for (let oy = 0; oy < fp.h; oy++) {
    for (let ox = 0; ox < fp.w; ox++) {
      const d = Math.hypot(from.x - (e.x + ox), from.y - (e.y + oy));
      if (d < best) best = d;
    }
  }
  return best;
}

export function closestApproach(state: SimState, from: Vec2, e: Entity): Vec2 {
  if (e.class !== "building") return { x: e.x, y: e.y };
  const fp = footprintOf(e.kind as BuildingKind);
  let best: Vec2 = { x: e.x, y: e.y };
  let bestD = Infinity;
  for (let oy = 0; oy < fp.h; oy++) {
    for (let ox = 0; ox < fp.w; ox++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = e.x + ox + dx;
          const ny = e.y + oy + dy;
          if (nx >= e.x && nx < e.x + fp.w && ny >= e.y && ny < e.y + fp.h) continue;
          if (!isWalkable(state, nx, ny)) continue;
          if (!canClimb(state, e.x + ox, e.y + oy, nx, ny)) continue;
          const d = Math.hypot(from.x - nx, from.y - ny);
          if (d < bestD) {
            bestD = d;
            best = { x: nx, y: ny };
          }
        }
      }
    }
  }
  return best;
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
    const d = distToEntity(from, e);
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

export function spawnBuildingAt(
  state: SimState,
  owner: Owner,
  kind: BuildingKind,
  x: number,
  y: number,
  constructing = 0,
  marked = false,
): Entity | undefined {
  const spot = findBuildSite(state, kind, x, y, 14);
  if (!spot) return undefined;
  return spawnBuilding(state, owner, kind, spot.x, spot.y, constructing, marked);
}

export function emptyRoleCounts(): Record<UnitKind, number> {
  return { harvester: 0, infantry: 0, antiArmor: 0, tank: 0 };
}
