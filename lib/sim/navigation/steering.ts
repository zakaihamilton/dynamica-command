import type { SimState, UnitEntity } from "../../types";
import { tileFree } from "./avoidance";

export function advanceAlongPath(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  e: UnitEntity,
  speed: number,
): void {
  if (!e.path.length) return;
  const target = e.path[0]!;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= speed || distance < 0.05) {
    if (!tileFree(state, occupancy, reserved, e, target.x, target.y)) return;
    e.x = target.x;
    e.y = target.y;
    e.path.shift();
    return;
  }
  e.x += (dx / distance) * speed;
  e.y += (dy / distance) * speed;
}
