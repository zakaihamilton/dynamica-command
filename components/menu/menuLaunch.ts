import { formatSeed, hash32, parseSeed } from "@/lib/seed/rng";
import { briefingPath } from "../game/hooks/missionRoutes";

const MS_PER_DAY = 86_400_000;

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
