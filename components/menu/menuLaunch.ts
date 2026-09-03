import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { briefingPath } from "../game/hooks/missionRoutes";

export function dailySeed(): string {
  const d = new Date();
  const dayIndex = Math.floor(d.getTime() / 86_400_000);
  let h = dayIndex ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  return formatSeed(h % 10000);
}

export function rollSeed(): string {
  return formatSeed(Math.floor(Math.random() * 10000));
}

export function menuLaunchPath(code: string): string | null {
  const seed = parseSeed(code);
  if (seed === null || code.length < 4) return null;
  return briefingPath(seed, 0, false, "menu");
}
