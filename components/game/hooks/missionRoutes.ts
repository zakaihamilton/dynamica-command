import { formatSeed } from "@/lib/seed/rng";
import type { SimState } from "@/lib/types";

export type NavigationOrigin = "menu" | "campaign" | "result";

export function navigationOrigin(value: string | null | undefined): NavigationOrigin {
  return value === "campaign" || value === "result" ? value : "menu";
}

export function menuPath(): string {
  return "/";
}

export function tutorialPath(): string {
  return "/tutorial";
}

export function playResumePath(seed: number, mission: number): string {
  return `/play?seed=${formatSeed(seed)}&mission=${mission}&resume=1`;
}

export function briefingPath(seed: number, mission: number, returnToGame = false, origin?: NavigationOrigin): string {
  const path = `/briefing?seed=${formatSeed(seed)}&mission=${mission}`;
  const params = [returnToGame ? "return=game" : "", origin ? `from=${origin}` : ""].filter(Boolean);
  return params.length ? `${path}&${params.join("&")}` : path;
}

export function briefingBackPath(
  seed: number,
  mission: number,
  returnToGame: boolean,
  origin: NavigationOrigin,
): string {
  if (returnToGame || origin === "result") return playResumePath(seed, mission);
  if (origin === "campaign") return campaignPath(seed);
  return menuPath();
}

export function campaignCompletePath(seed: number): string {
  return `/campaign-complete?seed=${formatSeed(seed)}`;
}

export function campaignPath(seed: number): string {
  return `/campaign?seed=${formatSeed(seed)}`;
}

export function resultPrimaryPath(state: Pick<SimState, "result" | "seed" | "missionIndex">): string {
  if (state.result === "won" && state.missionIndex < 7) return briefingPath(state.seed, state.missionIndex + 1, false, "result");
  if (state.result === "lost") return briefingPath(state.seed, state.missionIndex, false, "result");
  return menuPath();
}
