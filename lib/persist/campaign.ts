import type { CampaignProgress } from "../types";
import { safeSetItem, type StorageAdapter } from "./save";
import { formatSeed } from "../seed/rng";
import { isRecord, readPersistedEnvelope } from "./utils";

export const CAMPAIGN_PROGRESS_VERSION = 1 as const;
export const CAMPAIGN_PREFIX = "dynamica-command:campaign:";

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

export function normalizeCampaignProgress(value: unknown, seed: number): CampaignProgress {
  const base = freshCampaignProgress(seed);
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<CampaignProgress>;
  const unlockedMission = Math.max(0, Math.min(7, Number.isInteger(raw.unlockedMission) ? raw.unlockedMission! : 0));
  const completedMissions = Array.isArray(raw.completedMissions)
    ? [...new Set(raw.completedMissions.filter((n): n is number => (
      Number.isInteger(n) && n >= 0 && n < 8 && n <= unlockedMission
    )))].sort((a, b) => a - b)
    : [];
  const normalizeStats = (stats: unknown): Record<string, number> => {
    if (!isRecord(stats) || Array.isArray(stats)) return {};
    const normalized: Record<string, number> = {};
    for (const [key, score] of Object.entries(stats)) {
      if (/^[0-7]$/.test(key) && typeof score === "number" && Number.isFinite(score) && score >= 0) {
        normalized[key] = score;
      }
    }
    return normalized;
  };
  return {
    ...base,
    seed,
    tutorialComplete: raw.tutorialComplete === true,
    unlockedMission,
    completedMissions,
    medals: normalizeStats(raw.medals),
    bestScores: normalizeStats(raw.bestScores),
  };
}

export function readCampaignProgress(storage: StorageAdapter, seed: number): CampaignProgress {
  return readPersistedEnvelope(
    storage,
    campaignKey(seed),
    (parsed) => {
      if (!isRecord(parsed) || parsed.version !== CAMPAIGN_PROGRESS_VERSION) return null;
      return normalizeCampaignProgress(parsed.progress, seed);
    },
    freshCampaignProgress(seed),
  );
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
