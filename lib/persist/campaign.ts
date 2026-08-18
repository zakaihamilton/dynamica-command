import type { CampaignProgress, UpgradeId } from "../types";
import { UPGRADE_PREREQUISITE } from "../catalog";
import type { StorageAdapter } from "./save";
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
    researchPoints: 0,
    upgrades: [],
  };
}

function isUpgrade(value: unknown): value is UpgradeId {
  return typeof value === "string" && /^(logistics|arsenal|engineering)-/.test(value);
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
    researchPoints: Math.max(0, Number.isFinite(raw.researchPoints) ? Number(raw.researchPoints) : 0),
    upgrades: Array.isArray(raw.upgrades) ? raw.upgrades.filter(isUpgrade) : [],
  };
}

export function readCampaignProgress(storage: StorageAdapter, seed: number): CampaignProgress {
  const raw = storage.getItem(campaignKey(seed));
  if (!raw) return freshCampaignProgress(seed);
  try {
    const parsed = JSON.parse(raw) as { version?: number; progress?: unknown };
    if (parsed.version !== CAMPAIGN_PROGRESS_VERSION) return freshCampaignProgress(seed);
    return normalize(parsed.progress, seed);
  } catch {
    return freshCampaignProgress(seed);
  }
}

export function writeCampaignProgress(storage: StorageAdapter, progress: CampaignProgress): void {
  storage.setItem(campaignKey(progress.seed), JSON.stringify({
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
  const next: CampaignProgress = {
    ...progress,
    completedMissions: firstCompletion ? [...progress.completedMissions, missionIndex].sort((a, b) => a - b) : progress.completedMissions,
    unlockedMission: Math.max(progress.unlockedMission, Math.min(7, missionIndex + 1)),
    medals: { ...progress.medals, [key]: Math.max(progress.medals[key] ?? 0, medals) },
    bestScores: { ...progress.bestScores, [key]: Math.max(progress.bestScores[key] ?? 0, score) },
    researchPoints: progress.researchPoints + (firstCompletion ? medals : 0),
  };
  return next;
}

export function buyUpgrade(progress: CampaignProgress, id: UpgradeId, cost: number): CampaignProgress | null {
  const prerequisite = UPGRADE_PREREQUISITE[id];
  if (progress.upgrades.includes(id) || progress.researchPoints < cost || (prerequisite && !progress.upgrades.includes(prerequisite))) return null;
  return {
    ...progress,
    researchPoints: progress.researchPoints - cost,
    upgrades: [...progress.upgrades, id],
  };
}
