import { PREVIEW_SHOT_COUNT } from "./shots";

export const PREVIEW_PLAY_MS = 5000;
export const PREVIEW_IDLE_MS = 3000;
export const PREVIEW_CYCLE_MS = PREVIEW_PLAY_MS + PREVIEW_IDLE_MS;
export const PREVIEW_LOCK_COUNT = 3;
export const PREVIEW_LOCK_IDS = ["a", "b", "c"] as const;

export type PreviewPhase = {
  expanded: boolean;
  lockIndex: number;
  shotIndex: number;
};

export function previewAt(
  elapsedMs: number,
  lockCount = PREVIEW_LOCK_COUNT,
  shotCount = PREVIEW_SHOT_COUNT,
): PreviewPhase {
  const elapsed = Math.max(0, elapsedMs);
  const cycleIndex = Math.floor(elapsed / PREVIEW_CYCLE_MS);
  const phase = elapsed % PREVIEW_CYCLE_MS;
  return {
    expanded: phase < PREVIEW_PLAY_MS,
    lockIndex: cycleIndex % Math.max(1, lockCount),
    shotIndex: cycleIndex % Math.max(1, shotCount),
  };
}

