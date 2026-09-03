import { createCampaign } from "@/lib/gen/campaign";
import { CINEMA_SEED } from "./scene";
import { PREVIEW_SHOT_COUNT } from "./shots";

export const PREVIEW_INITIAL_DELAY_MS = 5000;
export const PREVIEW_PLAY_MS = 5000;
export const PREVIEW_IDLE_MS = 3000;
export const PREVIEW_CYCLE_MS = PREVIEW_PLAY_MS + PREVIEW_IDLE_MS;
export const PREVIEW_LOCK_COUNT = 3;
export const PREVIEW_LOCK_IDS = ["a", "b", "c"] as const;

export type PreviewPhase = {
  expanded: boolean;
  lockIndex: number;
  shotIndex: number;
  cycleIndex: number;
  missionIndex: number;
};

export const EXCLUDED_SCENARIO_KINDS = ["rescue", "extraction", "escort", "sabotage"] as const;

export function normalMissionIndices(seed: number): number[] {
  const campaign = createCampaign(seed);
  const normal = campaign.missions
    .filter((m) => !EXCLUDED_SCENARIO_KINDS.includes(m.win.kind as (typeof EXCLUDED_SCENARIO_KINDS)[number]))
    .map((m) => m.index);
  return normal.length ? normal : [0];
}

export function previewSeed(cycleIndex: number): number {
  return (((CINEMA_SEED + Math.max(0, cycleIndex | 0) * 137) % 10000) + 10000) % 10000;
}

export function previewMissionIndex(cycleIndex: number, seed = CINEMA_SEED): number {
  const normal = normalMissionIndices(seed);
  return normal[Math.max(0, cycleIndex | 0) % normal.length]!;
}

export function previewAt(
  elapsedMs: number,
  lockCount = PREVIEW_LOCK_COUNT,
  shotCount = PREVIEW_SHOT_COUNT,
  initialDelayMs = PREVIEW_INITIAL_DELAY_MS,
): PreviewPhase {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed < initialDelayMs) {
    const seed = previewSeed(0);
    return {
      expanded: false,
      lockIndex: 0,
      shotIndex: 0,
      cycleIndex: 0,
      missionIndex: previewMissionIndex(0, seed),
    };
  }
  const cycleElapsed = elapsed - initialDelayMs;
  const cycleIndex = Math.floor(cycleElapsed / PREVIEW_CYCLE_MS);
  const phase = cycleElapsed % PREVIEW_CYCLE_MS;
  const seed = previewSeed(cycleIndex);
  return {
    expanded: phase < PREVIEW_PLAY_MS,
    lockIndex: cycleIndex % Math.max(1, lockCount),
    shotIndex: cycleIndex % Math.max(1, shotCount),
    cycleIndex,
    missionIndex: previewMissionIndex(cycleIndex, seed),
  };
}
