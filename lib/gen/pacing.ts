import { TICKS_PER_SECOND } from "../catalog";
import type { Rng } from "../seed/rng";

/** Mission 0 ≈ 5.5 min, mission 7 ≈ 19 min, with ±1 min jitter, clamped to 5–20. */
export function missionDurationMinutes(missionIndex: number, rng: Rng): number {
  const base = 5.5 + missionIndex * (13.5 / 7);
  const jitter = (rng.next() - 0.5) * 2;
  return Math.max(5, Math.min(20, base + jitter));
}

export function minutesToTicks(minutes: number): number {
  return Math.round(minutes * 60 * TICKS_PER_SECOND);
}

export const MIN_MISSION_TICKS = 5 * 60 * TICKS_PER_SECOND;
export const MAX_MISSION_TICKS = 20 * 60 * TICKS_PER_SECOND;
