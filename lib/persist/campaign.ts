import type { CampaignProgress } from "../types";
import { safeGetItem, safeSetItem, type StorageAdapter } from "./save";
import { formatSeed } from "../seed/rng";

export const CAMPAIGN_PROGRESS_VERSION = 1 as const;
export const CAMPAIGN_PREFIX = "genesis-protocol:campaign:";

export function campaignKey(seed: number): string {
  return `${CAMPAIGN_PREFIX}${formatSeed(seed)}`;
}

export function freshCampaignProgress(seed: number): CampaignProgress {
  return {
    version: CAMPAIGN_PROGRESS_VERSION,
    seed,
    tutorialComplete: false,
    unlockedMission: 0,
    completedMissions: [],
    medals: {},
    bestScores: {},
  };
}

function normalize(value: unknown, seed: number): CampaignProgress {
  const base = freshCampaignProgress(seed);
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<CampaignProgress>;
  return {
    ...base,
    seed,
    tutorialComplete: raw.tutorialComplete === true,
    unlockedMission: Math.max(0, Math.min(7, Number.isInteger(raw.unlockedMission) ? raw.unlockedMission! : 0)),
    completedMissions: Array.isArray(raw.completedMissions)
      ? raw.completedMissions.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 8)
      : [],
    medals: raw.medals && typeof raw.medals === "object" ? { ...raw.medals } : {},
    bestScores: raw.bestScores && typeof raw.bestScores === "object" ? { ...raw.bestScores } : {},
  };
}

export function readCampaignProgress(storage: StorageAdapter, seed: number): CampaignProgress {
  const raw = safeGetItem(storage, campaignKey(seed));
  if (!raw) return freshCampaignProgress(seed);
  try {
    const parsed = JSON.parse(raw) as { version?: number; progress?: unknown };
    if (parsed.version !== CAMPAIGN_PROGRESS_VERSION) return freshCampaignProgress(seed);
    return normalize(parsed.progress, seed);
  } catch {
    return freshCampaignProgress(seed);
  }
}

export function writeCampaignProgress(storage: StorageAdapter, progress: CampaignProgress): boolean {
  return safeSetItem(storage, campaignKey(progress.seed), JSON.stringify({
    version: CAMPAIGN_PROGRESS_VERSION,
    savedAt: Date.now(),
    progress,
  }));
}

export function completeMission(
  progress: CampaignProgress,
  missionIndex: number,
  medals: number,
  score: number,
): CampaignProgress {
  const key = String(missionIndex);
  const firstCompletion = !progress.completedMissions.includes(missionIndex);
  return {
    ...progress,
    completedMissions: firstCompletion ? [...progress.completedMissions, missionIndex].sort((a, b) => a - b) : progress.completedMissions,
    unlockedMission: Math.max(progress.unlockedMission, Math.min(7, missionIndex + 1)),
    medals: { ...progress.medals, [key]: Math.max(progress.medals[key] ?? 0, medals) },
    bestScores: { ...progress.bestScores, [key]: Math.max(progress.bestScores[key] ?? 0, score) },
  };
}
