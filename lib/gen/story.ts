import { labelFor, TICKS_PER_SECOND } from "../catalog";
import type { Campaign, MissionDef, WinCategory } from "../types";

function objectivePhrase(win: WinCategory): string {
  switch (win.kind) {
    case "harvestQuota":
      return `extract ${win.target} credits from the field`;
    case "forceQuota":
      return win.role
        ? `assemble ${win.target} ${labelFor(win.role)} units`
        : `assemble ${win.target} combat units`;
    case "structureQuota":
      return win.building
        ? `raise ${win.target} ${labelFor(win.building)} structures`
        : `raise ${win.target} structures`;
    case "destroyMarked":
      return `demolish the marked ${win.targetCount ?? 1} high-value structures`;
    case "razeAll":
      return "level every enemy building";
    case "decapitate":
      return "destroy the enemy construction yard";
    case "annihilate":
      return "erase all enemy forces and structures";
    case "holdTheLine":
      return "hold until the window closes";
    default:
      return "complete the assigned objective";
  }
}

export type MissionObjective = {
  id: string;
  text: string;
  primary: boolean;
};

function holdDurationLabel(ticks: number): string {
  const seconds = Math.max(1, Math.round(ticks / TICKS_PER_SECOND));
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function missionObjectives(
  mission: Pick<MissionDef, "win" | "index">,
  campaign: Pick<Campaign, "world" | "factions">,
): MissionObjective[] {
  const win = mission.win;
  const [us, them] = campaign.factions;
  const primary = (() => {
    switch (win.kind) {
      case "harvestQuota":
        return `Extract ${win.target} credits from ${campaign.world.name}`;
      case "forceQuota":
        return win.role
          ? `Assemble ${win.target} ${labelFor(win.role)} units for the ${us.name}`
          : `Assemble ${win.target} combat units for the ${us.name}`;
      case "structureQuota":
        return win.building
          ? `Raise ${win.target} ${labelFor(win.building)} structures`
          : `Raise ${win.target} structures in the ${campaign.world.biome}`;
      case "destroyMarked":
        return `Demolish the ${win.targetCount ?? 1} marked high-value structures`;
      case "razeAll":
        return `Level every ${them.name} building`;
      case "decapitate":
        return `Destroy the ${them.name} construction yard`;
      case "annihilate":
        return `Erase all ${them.name} forces and structures`;
      case "holdTheLine":
        return `Hold the line for ${holdDurationLabel(win.ticks ?? 0)}`;
      default:
        return "Complete the assigned objective";
    }
  })();
  return [
    { id: "primary", text: primary, primary: true },
    { id: "yard", text: "Do not lose the construction yard", primary: false },
    {
      id: "theater",
      text: `Hold ${campaign.world.name} (${campaign.world.biome}) against the ${them.name}`,
      primary: false,
    },
  ];
}

export function generateBriefing(
  campaign: Pick<Campaign, "world" | "factions" | "characters">,
  mission: Pick<MissionDef, "name" | "win" | "index">,
): string {
  const { commander, advisor, enemyLeader } = campaign.characters;
  const [us, them] = campaign.factions;
  const obj = objectivePhrase(mission.win);
  const lines = [
    `${advisor.title} ${advisor.name}: ${commander.title}, the ${campaign.world.name} front has shifted.`,
    `This is ${mission.name}. The ${us.name} must ${obj}.`,
    `${enemyLeader.title} ${enemyLeader.name} of the ${them.name} will contest the ${campaign.world.biome}.`,
    `Tone on-site is ${campaign.world.tone}. The war itself is ${campaign.world.conflict}, ${campaign.world.era}.`,
    `Do not lose the construction yard. The seed of this theater is already written.`,
  ];
  return lines.join(" ");
}

export function generateStory() {
  return { generateBriefing, objectivePhrase, missionObjectives };
}
