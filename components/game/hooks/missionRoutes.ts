import { formatSeed } from "@/lib/seed/rng";
import type { SimState } from "@/lib/types";

export function menuPath(): string {
  return "/";
}

export function briefingPath(seed: number, mission: number, returnToGame = false): string {
  const path = `/briefing?seed=${formatSeed(seed)}&mission=${mission}`;
  return returnToGame ? `${path}&return=game` : path;
}

export function campaignCompletePath(seed: number): string {
  return `/campaign-complete?seed=${formatSeed(seed)}`;
}

export function resultPrimaryPath(state: Pick<SimState, "result" | "seed" | "missionIndex">): string {
  if (state.result === "won" && state.missionIndex < 7) return briefingPath(state.seed, state.missionIndex + 1);
  if (state.result === "lost") return briefingPath(state.seed, state.missionIndex);
  return menuPath();
}
