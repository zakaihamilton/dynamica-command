import { UNIT_STATS } from "../catalog";
import { isUnitEntity, type Entity, type Facing, type SimState, type UnitEntity } from "../types";
import { tryFindPathDetailed } from "./pathBudget";
import { routePendingFor } from "./pathfinding";
import { prepareFlowFieldRoutes } from "./flowFieldRouting";
import { invalidateUnitAtCache, unitOccupancyFor } from "./world";

type MovementBuffers = {
  occupancy: Uint8Array;
  atTile: Map<number, Entity>;
  reserved: Map<number, number>;
  swapped: Set<number>;
  movers: UnitEntity[];
};

const movementBuffers = new WeakMap<SimState, MovementBuffers>();

function buffersFor(state: SimState): MovementBuffers {
  const size = state.width * state.height;
  let buffers = movementBuffers.get(state);
  if (!buffers || buffers.occupancy.length !== size) {
    buffers = {
      occupancy: new Uint8Array(size),
      atTile: new Map<number, Entity>(),
      reserved: new Map<number, number>(),
      swapped: new Set<number>(),
      movers: [],
    };
    movementBuffers.set(state, buffers);
  } else {
    buffers.atTile.clear();
    buffers.reserved.clear();
    buffers.swapped.clear();
    buffers.movers.length = 0;
  }
  buffers.occupancy = unitOccupancyFor(state);
  return buffers;
}

import {
  advanceAlongPath,
  cellOf,
  exchangePositions,
  giveWay,
  goalDistance,
  holdingDestination,
  tileFree,
  tryCooperativeSwap,
  trySidestep,
} from "./navigation";

export function tickMovement(state: SimState): void {
  const { occupancy, atTile, reserved, swapped, movers } = buffersFor(state);
  prepareFlowFieldRoutes(state, occupancy, reserved);
  for (const e of state.entities) {
    // Convoys are neutral so combat targeting ignores them, but they still
    // need the normal background repath when a bounded search returned only
    // a partial route. Other neutral scenario actors have no movement orders.
    if (e.hp <= 0 || e.class !== "unit" || (e.neutral && e.scenarioRole !== "convoy") || e.flowGoal || e.path.length || !e.orderDestination) continue;
    if (holdingDestination(e)) continue;
    const dest = e.orderDestination;
    const destX = Math.round(dest.x);
    const destY = Math.round(dest.y);
    const destCell = destY * state.width + destX;
    const destOccupied = occupancy[destCell] === 1 && destCell !== cellOf(state, e.x, e.y);
    const cheb = Math.max(
      Math.abs(Math.round(e.x) - destX),
      Math.abs(Math.round(e.y) - destY),
    );
    if (destOccupied) continue;
    if (cheb <= 1) {
      e.path = [{ x: destX, y: destY }];
      e.idle = false;
      e.routePending = undefined;
      continue;
    }
    if (!e.routePending && !e.idle) continue;
    const result = tryFindPathDetailed(state, e, dest);
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
    movers.push(e);
  }
  movers.sort((a, b) => goalDistance(a) - goalDistance(b) || a.id - b.id);

  for (const e of movers) {
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
      const orderDest = e.orderDestination;
      if (
        orderDest &&
        nx === Math.round(orderDest.x) &&
        ny === Math.round(orderDest.y) &&
        blocker &&
        blocker.id !== e.id &&
        holdingDestination(blocker)
      ) {
        e.path = [];
        e.idle = true;
        e.blockedTicks = 0;
        continue;
      }
      if (blocker && blocker.id !== e.id && !swapped.has(blocker.id)) {
        const bNext = blocker.path[0];
        if (bNext && Math.round(bNext.x) === Math.round(e.x) && Math.round(bNext.y) === Math.round(e.y)) {
          exchangePositions(state, occupancy, atTile, swapped, e, blocker);
          e.path.shift();
          blocker.path.shift();
          continue;
        }
      }

      if (trySidestep(state, occupancy, reserved, e, nx, ny)) {
        e.blockedTicks = 0;
      } else if (blocker && blocker.id !== e.id && giveWay(state, occupancy, reserved, blocker)) {
        e.blockedTicks = 0;
        continue;
      } else if (blocker && blocker.id !== e.id && tryCooperativeSwap(state, occupancy, atTile, swapped, e, blocker)) {
        continue;
      } else {
        e.blockedTicks = (e.blockedTicks ?? 0) + 1;
        if (e.blockedTicks === 1 || e.blockedTicks % 6 === 0) {
          const destination = e.path[e.path.length - 1];
          if (destination) {
            const detourResult = tryFindPathDetailed(state, e, destination, {
              avoidUnits: true,
              ignoreId: e.id,
              occupancy,
            });
            if (!detourResult) continue;
            if (detourResult.status === "unreachable") {
              // A group can legitimately seal a unit's final tile after the
              // unit has arrived nearby. Do not keep walking into the same
              // occupied pocket forever; settle at the current cell.
              if (goalDistance(e) <= 2) {
                e.orderDestination = { x: Math.round(e.x), y: Math.round(e.y) };
                e.path = [];
                e.flowGoal = undefined;
                e.routePending = false;
                e.idle = true;
                e.blockedTicks = 0;
              }
              continue;
            }
            const detour = detourResult.path;
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
    advanceAlongPath(state, occupancy, reserved, e, speed);
    const after = cellOf(state, e.x, e.y);
    if (after !== before) {
      occupancy[before] = 0;
      occupancy[after] = 1;
      atTile.delete(before);
      atTile.set(after, e);
      e.blockedTicks = 0;
    }
    if (!e.path.length && stepTarget && reserved.get(stepCell) === e.id) reserved.delete(stepCell);
  }
  // Positions changed during this tick are not reflected in the O(1) unitAt
  // cache used by placement and closest-approach queries.
  invalidateUnitAtCache(state);
}
