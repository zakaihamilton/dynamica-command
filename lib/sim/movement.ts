import { UNIT_STATS } from "../catalog";
import { isUnitEntity, type Entity, type Facing, type SimState } from "../types";
import { tryFindPath, tryFindPathDetailed } from "./pathBudget";
import { PATH_DIRS, diagonalCornerBlocked, routePendingFor, stepAlongPath } from "./pathfinding";
import { canClimb, inBounds, isStaticWalkable, makeUnitOccupancy } from "./world";

function cellOf(state: SimState, x: number, y: number): number {
  return Math.round(y) * state.width + Math.round(x);
}

function tileFree(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  e: Entity,
  x: number,
  y: number,
): boolean {
  if (!inBounds(state, x, y) || !isStaticWalkable(state, x, y)) return false;
  const current = cellOf(state, e.x, e.y);
  const target = y * state.width + x;
  if (target === current) return true;
  if (e.neutral) return true;
  if (occupancy[target]) return false;
  const claim = reserved.get(target);
  return claim === undefined || claim === e.id;
}

function trySidestep(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  e: Entity,
  blockedX: number,
  blockedY: number,
): boolean {
  if (e.path.length <= 1) return false;
  const cx = Math.round(e.x);
  const cy = Math.round(e.y);
  const dest = e.path[1] ?? e.path[e.path.length - 1]!;
  const stayD = Math.hypot(cx - dest.x, cy - dest.y);
  let best: { x: number; y: number; d: number } | undefined;
  for (const d of PATH_DIRS) {
    const nx = cx + d.x;
    const ny = cy + d.y;
    if (nx === blockedX && ny === blockedY) continue;
    if (!tileFree(state, occupancy, reserved, e, nx, ny)) continue;
    if (!canClimb(state, cx, cy, nx, ny)) continue;
    if (diagonalCornerBlocked(state, cx, cy, nx, ny)) continue;
    const dist = Math.hypot(nx - dest.x, ny - dest.y);
    if (dist >= stayD) continue;
    if (!best || dist < best.d) best = { x: nx, y: ny, d: dist };
  }
  if (!best) return false;
  e.path[0] = { x: best.x, y: best.y };
  return true;
}

function nudgeIdle(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  blocker: Entity,
): boolean {
  if (blocker.path.length || blocker.neutral) return false;
  const cx = Math.round(blocker.x);
  const cy = Math.round(blocker.y);
  for (const d of PATH_DIRS) {
    const nx = cx + d.x;
    const ny = cy + d.y;
    if (!tileFree(state, occupancy, reserved, blocker, nx, ny)) continue;
    if (!canClimb(state, cx, cy, nx, ny)) continue;
    if (diagonalCornerBlocked(state, cx, cy, nx, ny)) continue;
    blocker.path = [{ x: nx, y: ny }];
    return true;
  }
  return false;
}

export function tickMovement(state: SimState): void {
  const occupancy = makeUnitOccupancy(state);
  const atTile = new Map<number, Entity>();
  const reserved = new Map<number, number>();
  const swapped = new Set<number>();
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit" || !e.routePending || e.path.length || !e.orderDestination) continue;
    const result = tryFindPathDetailed(state, e, e.orderDestination);
    if (!result) continue;
    e.path = result.path;
    e.routePending = routePendingFor(result.status);
    e.idle = result.status === "unreachable";
  }
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit") continue;
    atTile.set(cellOf(state, e.x, e.y), e);
  }

  for (const e of state.entities) {
    if (e.hp <= 0 || !isUnitEntity(e)) continue;
    if (swapped.has(e.id)) continue;
    const speed = UNIT_STATS[e.kind].speed * (1 - Math.min(0.4, (e.suppression ?? 0) / 250));
    const current = cellOf(state, e.x, e.y);
    const next = e.path[0];
    const nx = next ? Math.round(next.x) : Math.round(e.x);
    const ny = next ? Math.round(next.y) : Math.round(e.y);
    const target = ny * state.width + nx;
    const claim = reserved.get(target);
    const blocked = !!next && target !== current && (occupancy[target] === 1 || (claim !== undefined && claim !== e.id));

    if (blocked) {
      const blocker = atTile.get(target);
      if (blocker && blocker.id !== e.id && !swapped.has(blocker.id)) {
        const bNext = blocker.path[0];
        if (bNext && Math.round(bNext.x) === Math.round(e.x) && Math.round(bNext.y) === Math.round(e.y)) {
          const bCell = cellOf(state, blocker.x, blocker.y);
          const ax = e.x;
          const ay = e.y;
          e.x = blocker.x;
          e.y = blocker.y;
          blocker.x = ax;
          blocker.y = ay;
          e.path.shift();
          blocker.path.shift();
          occupancy[current] = 1;
          occupancy[bCell] = 1;
          atTile.set(current, blocker);
          atTile.set(bCell, e);
          swapped.add(e.id);
          swapped.add(blocker.id);
          e.blockedTicks = 0;
          blocker.blockedTicks = 0;
          continue;
        }
      }

      if (trySidestep(state, occupancy, reserved, e, nx, ny)) {
        e.blockedTicks = 0;
      } else {
        if (blocker && blocker.id !== e.id) nudgeIdle(state, occupancy, reserved, blocker);
        e.blockedTicks = (e.blockedTicks ?? 0) + 1;
        if (e.blockedTicks === 1 || e.blockedTicks % 6 === 0) {
          const destination = e.path[e.path.length - 1];
          if (destination) {
            const detour = tryFindPath(state, e, destination, {
              avoidUnits: true,
              ignoreId: e.id,
              occupancy,
            });
            if (!detour) continue;
            const detourFirst = detour[0];
            if (detourFirst) {
              const dx = Math.round(detourFirst.x);
              const dy = Math.round(detourFirst.y);
              const sameBlocked = dx === nx && dy === ny;
              if (!sameBlocked && tileFree(state, occupancy, reserved, e, dx, dy)) {
                e.path = detour;
              }
            }
          }
        }
        continue;
      }
    }

    const stepTarget = e.path[0];
    const stepX = stepTarget ? Math.round(stepTarget.x) : Math.round(e.x);
    const stepY = stepTarget ? Math.round(stepTarget.y) : Math.round(e.y);
    const stepCell = stepY * state.width + stepX;
    if (stepTarget && stepCell !== current && !tileFree(state, occupancy, reserved, e, stepX, stepY)) {
      e.blockedTicks = (e.blockedTicks ?? 0) + 1;
      continue;
    }
    if (stepTarget && stepCell !== current) reserved.set(stepCell, e.id);
    if (stepTarget) {
      const dx = stepTarget.x - e.x;
      const dy = stepTarget.y - e.y;
      if (Math.hypot(dx, dy) > 0.001) {
        const angle = Math.atan2(dy, dx);
        e.facing = ((Math.round((angle / (Math.PI * 2)) * 8) + 8) % 8) as Facing;
      }
    }
    const before = current;
    stepAlongPath(e, speed, (x, y) => tileFree(state, occupancy, reserved, e, Math.round(x), Math.round(y)));
    const after = cellOf(state, e.x, e.y);
    if (after !== before) {
      occupancy[before] = 0;
      occupancy[after] = 1;
      atTile.delete(before);
      atTile.set(after, e);
    }
    if (!e.path.length && stepTarget && reserved.get(stepCell) === e.id) reserved.delete(stepCell);
  }
}
