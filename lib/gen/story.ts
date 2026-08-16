import type { Campaign, MissionDef, WinCategory } from "../types";

function objectivePhrase(win: WinCategory): string {
  switch (win.kind) {
    case "harvestQuota":
      return `extract ${win.target} credits from the field`;
    case "forceQuota":
      return win.role
        ? `assemble ${win.target} ${win.role} units`
        : `assemble ${win.target} combat units`;
    case "structureQuota":
      return win.building
        ? `raise ${win.target} ${win.building} structures`
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
  return { generateBriefing, objectivePhrase };
}
