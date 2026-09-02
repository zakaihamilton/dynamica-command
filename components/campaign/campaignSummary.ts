import type { Campaign, CampaignProgress } from "@/lib/types";

export function campaignSummary(campaign: Campaign, progress: CampaignProgress) {
  const completed = progress.completedMissions.length;
  const totalMedals = campaign.missions.reduce((sum, mission) => sum + (progress.medals[String(mission.index)] ?? 0), 0);
  const possibleMedals = campaign.missions.length * 3;
  return {
    completed,
    totalMedals,
    possibleMedals,
    isComplete: completed >= campaign.missions.length,
  };
}

export function campaignScaleLabel(campaign: Campaign): string {
  const sizes = [...new Set(campaign.missions.map((mission) => mission.mapSize))];
  return `${campaign.missions.length} operations · maps ${sizes.join(" → ")} · opposition escalates`;
}

export function theaterArchiveLabel(campaign: Campaign, progress: CampaignProgress): string {
  const summary = campaignSummary(campaign, progress);
  const total = campaign.missions.length;
  if (summary.isComplete) return `Campaign complete · ${summary.completed}/${total} operations`;
  if (summary.completed > 0) {
    return `${summary.completed}/${total} operations complete · Launch opens operation 1`;
  }
  return "Unrecorded on this device";
}

export function missionMedalDisplay(medals: number) {
  return `${"★".repeat(medals)}${"☆".repeat(Math.max(0, 3 - medals))}`;
}

export function missionUnlocks(missionIndex: number, missionCount: number): string[] {
  const unlocks: string[] = [];
  if (missionIndex < missionCount - 1) unlocks.push(`Mission ${missionIndex + 2} access`);
  if (unlocks.length === 0) unlocks.push("Campaign victory record");
  return unlocks;
}
