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

export function missionMedalDisplay(medals: number) {
  return `${"★".repeat(medals)}${"☆".repeat(Math.max(0, 3 - medals))}`;
}
