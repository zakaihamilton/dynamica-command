import type { Vec2 } from "../../../types";
import type { GeneratedMap } from "./types";

// Keep targets on the enemy-side quadrant while placing them away from both
// bases. This gives the operation a real approach without auto-contacting the
// first target from the player's starting formation.
const RESCUE_FLANK_X_RATIO = 0.52;
const RESCUE_FLANK_Y_RATIO = 0.52;

/**
 * Returns the center of the flank that mirrors the enemy base vertically while
 * staying on the same horizontal side of the map.
 */
export function rescueFlankCenter(
  map: Pick<GeneratedMap, "width" | "height" | "enemyStart">,
): Vec2 {
  const enemyOnRight = map.enemyStart.x >= map.width / 2;
  const enemyOnTop = map.enemyStart.y < map.height / 2;
  return {
    x: Math.round(map.width * (enemyOnRight ? RESCUE_FLANK_X_RATIO : 1 - RESCUE_FLANK_X_RATIO)),
    y: Math.round(map.height * (enemyOnTop ? RESCUE_FLANK_Y_RATIO : 1 - RESCUE_FLANK_Y_RATIO)),
  };
}

/** Whether a map cell belongs to the enemy base's vertically mirrored flank. */
export function inRescueFlank(
  map: Pick<GeneratedMap, "width" | "height" | "enemyStart">,
  x: number,
  y: number,
): boolean {
  const enemyOnRight = map.enemyStart.x >= map.width / 2;
  const enemyOnTop = map.enemyStart.y < map.height / 2;
  const onEnemyHorizontalSide = enemyOnRight ? x >= map.width / 2 : x < map.width / 2;
  const onMirroredVerticalSide = enemyOnTop ? y >= map.height / 2 : y < map.height / 2;
  return onEnemyHorizontalSide && onMirroredVerticalSide;
}
