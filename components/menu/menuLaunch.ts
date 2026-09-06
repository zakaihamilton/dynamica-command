import { formatSeed, hash32, parseSeed } from "@/lib/seed/rng";
import { briefingPath } from "../game/hooks/missionRoutes";

const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 86_400_000 * 7;

/** Returns the 0-indexed week number since epoch (starts Thursday 1970 UTC; offset to Monday). */
export function weeklyIndex(now = Date.now()): number {
  // Epoch was a Thursday. Shift by 3 days (259_200_000 ms) to align weeks with Monday 00:00:00 UTC.
  const EPOCH_MONDAY_OFFSET = 259_200_000;
  return Math.floor((now + EPOCH_MONDAY_OFFSET) / MS_PER_WEEK);
}

export function weeklySeed(now = Date.now()): string {
  const week = weeklyIndex(now);
  return formatSeed(hash32(`weekly:${week}`) % 10000);
}

export function dailySeed(now = Date.now()): string {
  const dayIndex = Math.floor(now / MS_PER_DAY);
  return formatSeed(hash32(`daily:${dayIndex}`) % 10000);
}

export function rollSeed(): string {
  return formatSeed(Math.floor(Math.random() * 10000));
}

export function menuLaunchPath(code: string): string | null {
  const seed = parseSeed(code);
  if (seed === null || code.length < 4) return null;
  return briefingPath(seed, 0, false, "menu");
}
