import { formatSeed, parseSeed } from "@/lib/seed/rng";
import { briefingPath, tutorialPath } from "../game/hooks/missionRoutes";

export function rollSeed(): string {
  return formatSeed(Math.floor(Math.random() * 10000));
}

export function menuLaunchPath(code: string, tutorialComplete: boolean): string | null {
  const seed = parseSeed(code);
  if (seed === null || code.length < 4) return null;
  return tutorialComplete ? briefingPath(seed, 0, false, "menu") : tutorialPath(seed, "menu");
}
