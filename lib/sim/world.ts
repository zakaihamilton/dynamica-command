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
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER } from "../types";

export const BUILDING_PLACEMENT_RADIUS = 8;

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

function heightAtClamped(state: SimState, x: number, y: number): number {
  const cx = Math.max(0, Math.min(state.width - 1, Math.floor(x)));
  const cy = Math.max(0, Math.min(state.height - 1, Math.floor(y)));
  return state.heights[cy * state.width + cx] ?? 1;
}

/** Bilinear sample so moving units ride slopes instead of snapping tile to tile. */
export function groundHeight(state: SimState, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const h00 = heightAtClamped(state, x0, y0);
  const h10 = heightAtClamped(state, x0 + 1, y0);
  const h01 = heightAtClamped(state, x0, y0 + 1);
  const h11 = heightAtClamped(state, x0 + 1, y0 + 1);
  return h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;
}

export function occupies(e: Entity, x: number, y: number): boolean {
  if (e.hp <= 0) return false;
  if (e.class !== "building") {
    return Math.round(e.x) === x && Math.round(e.y) === y;
  }
  const fp = footprintOf(e.kind as BuildingKind);
  return x >= e.x && x < e.x + fp.w && y >= e.y && y < e.y + fp.h;
}

export function unitAt(state: SimState, x: number, y: number): Entity | undefined {
  return state.entities.find(
    (e) => e.hp > 0 && e.class === "unit" && Math.round(e.x) === x && Math.round(e.y) === y,
  );
}

export function buildingAt(state: SimState, x: number, y: number): Entity | undefined {
  return state.entities.find((e) => e.class === "building" && occupies(e, x, y));
}

export type TerrainAccess = {
  traversable: boolean;
  buildable: boolean;
  label: "Open ground" | "Water" | "Ore field" | "Hard blocker" | "Outside map";
};

/** The shared terrain contract for movement, construction, tooltips, and picking feedback. */
export function terrainAccess(state: SimState, x: number, y: number): TerrainAccess {
  if (!inBounds(state, x, y)) return { traversable: false, buildable: false, label: "Outside map" };
  const tile = tileAt(state, x, y);
  if (tile === TILE_WATER) return { traversable: false, buildable: false, label: "Water" };
  if (tile === TILE_BLOCKED) return { traversable: false, buildable: false, label: "Hard blocker" };
  if (tile === TILE_RESOURCE) return { traversable: true, buildable: false, label: "Ore field" };
  return { traversable: true, buildable: true, label: "Open ground" };
}

/** Terrain and buildings only — other units are handled at move time. */
export function isStaticWalkable(state: SimState, x: number, y: number): boolean {
  if (!terrainAccess(state, x, y).traversable) return false;
  if (buildingAt(state, x, y)) return false;
  return true;
}

export function isWalkable(state: SimState, x: number, y: number): boolean {
  if (!isStaticWalkable(state, x, y)) return false;
  if (unitAt(state, x, y)) return false;
  return true;
}

export function makeUnitOccupancy(state: SimState, ignoreId?: number): Uint8Array {
  const occupancy = new Uint8Array(state.width * state.height);
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit" || e.id === ignoreId) continue;
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    if (!inBounds(state, x, y)) continue;
    occupancy[y * state.width + x] = 1;
  }
  return occupancy;
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

function buildingNetworkDistance(
  state: SimState,
  owner: Owner,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  let nearest = Infinity;
  for (const building of state.entities) {
    if (building.hp <= 0 || building.class !== "building" || building.owner !== owner) continue;
    const fp = footprintOf(building.kind as BuildingKind);
    const dx = Math.max(building.x - (x + w), x - (building.x + fp.w), 0);
    const dy = Math.max(building.y - (y + h), y - (building.y + fp.h), 0);
    nearest = Math.min(nearest, Math.hypot(dx, dy));
  }
  return nearest;
}

export function canPlaceBuilding(
  state: SimState,
  kind: BuildingKind,
  x: number,
  y: number,
  owner: Owner = 0,
  requireNetwork = true,
): boolean {
  const fp = footprintOf(kind);
  if (requireNetwork && buildingNetworkDistance(state, owner, x, y, fp.w, fp.h) > BUILDING_PLACEMENT_RADIUS) return false;
  for (let oy = 0; oy < fp.h; oy++) {
    for (let ox = 0; ox < fp.w; ox++) {
      const tx = x + ox;
      const ty = y + oy;
      if (!inBounds(state, tx, ty)) return false;
      if (!terrainAccess(state, tx, ty).buildable) return false;
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
  owner: Owner = 0,
  requireNetwork = true,
): Vec2 | undefined {
  const cx = Math.round(nearX);
  const cy = Math.round(nearY);
  if (canPlaceBuilding(state, kind, cx, cy, owner, requireNetwork)) return { x: cx, y: cy };
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (canPlaceBuilding(state, kind, x, y, owner, requireNetwork)) return { x, y };
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

function spawnCandidateOk(state: SimState, x: number, y: number, originH: number): boolean {
  if (!isWalkable(state, x, y)) return false;
  return Math.abs(heightAt(state, x, y) - originH) <= 1;
}

export function frontTileNear(state: SimState, e: Entity): Vec2 {
  const fp = footprintOf(e.kind as BuildingKind);
  const x0 = Math.round(e.x);
  const y0 = Math.round(e.y);
  const originH = heightAt(state, x0, y0);
  const seen = new Set<string>();
  const front: Vec2[] = [];
  const behind: Vec2[] = [];
  const push = (list: Vec2[], x: number, y: number) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ x, y });
  };

  const midX = Math.floor(fp.w / 2);
  const midY = Math.floor(fp.h / 2);
  push(front, x0 + midX, y0 + fp.h);
  for (let ox = 0; ox < fp.w; ox++) push(front, x0 + ox, y0 + fp.h);
  push(front, x0 + fp.w, y0 + fp.h);
  push(front, x0 + fp.w, y0 + midY);
  for (let oy = fp.h - 1; oy >= 0; oy--) push(front, x0 + fp.w, y0 + oy);
  for (let ox = 0; ox < fp.w; ox++) push(behind, x0 + ox, y0 - 1);
  for (let oy = 0; oy < fp.h; oy++) push(behind, x0 - 1, y0 + oy);
  push(behind, x0 - 1, y0 + fp.h);
  push(behind, x0 + fp.w, y0 - 1);
  push(behind, x0 - 1, y0 - 1);

  for (const candidate of front) {
    if (spawnCandidateOk(state, candidate.x, candidate.y, originH)) return candidate;
  }
  for (const candidate of behind) {
    if (spawnCandidateOk(state, candidate.x, candidate.y, originH)) return candidate;
  }
  return openTileNear(state, e.x, e.y, fp.w, fp.h);
}

function unitSite(state: SimState, x: number, y: number, maxR = 12): Vec2 | undefined {
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (isWalkable(state, nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return undefined;
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
    queue: [],
    marked: false,
    idle: true,
    facing: owner === 0 ? 0 : 4,
    stance: "aggressive",
    suppression: 0,
    armor: stats.armor,
    weapon: stats.weapon,
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
    queue: [],
    marked,
    idle: true,
    facing: owner === 0 ? 0 : 4,
    stance: "aggressive",
    suppression: 0,
    armor: stats.armor,
    weapon: stats.weapon,
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

export function powerBreakdown(state: SimState, owner: Owner): { produced: number; used: number; surplus: number } {
  let produced = 0;
  let used = 0;
  for (const e of living(state)) {
    if (e.class !== "building" || e.owner !== owner || e.constructing > 0) continue;
    const watt = BUILDING_STATS[e.kind as BuildingKind].power;
    if (watt >= 0) produced += watt;
    else used -= watt;
  }
  return { produced, used, surplus: produced - used };
}

export function powerFor(state: SimState, owner: Owner): number {
  return powerBreakdown(state, owner).surplus;
}

export function spawnUnit(
  state: SimState,
  owner: Owner,
  kind: UnitKind,
  x: number,
  y: number,
): Entity {
  const e = trySpawnUnit(state, owner, kind, x, y);
  if (!e) throw new Error("No free square available for unit spawn");
  return e;
}

export function trySpawnUnit(
  state: SimState,
  owner: Owner,
  kind: UnitKind,
  x: number,
  y: number,
): Entity | undefined {
  const site = unitSite(state, x, y);
  if (!site) return undefined;
  const e = makeUnit(state, owner, kind, x, y);
  e.x = site.x;
  e.y = site.y;
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
  const spot = findBuildSite(state, kind, x, y, 14, owner, false);
  if (!spot) return undefined;
  return spawnBuilding(state, owner, kind, spot.x, spot.y, constructing, marked);
}

export function emptyRoleCounts(): Record<UnitKind, number> {
  return { harvester: 0, infantry: 0, antiArmor: 0, tank: 0 };
}
