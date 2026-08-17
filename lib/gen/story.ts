import { labelFor, TICKS_PER_SECOND } from "../catalog";
import type { BriefingLine, BuildingKind, Campaign, MissionDef, UnitKind, WinCategory } from "../types";
import { biomeLabel, characterLabel } from "./names";

function countedLabel(kind: UnitKind | BuildingKind, count: number): string {
  const label = labelFor(kind).toLowerCase();
  if (count === 1) return label;
  if (kind === "factory") return "war factories";
  if (kind === "barracks") return "barracks";
  if (kind === "infantry") return "infantry";
  if (kind === "antiArmor") return "anti-armor units";
  return `${label}s`;
}

function holdDurationLabel(ticks: number): string {
  const seconds = Math.max(1, Math.round(ticks / TICKS_PER_SECOND));
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function objectivePhrase(win: WinCategory): string {
  switch (win.kind) {
    case "harvestQuota":
      return `extract ${win.target} credits from the field`;
    case "forceQuota":
      return win.role
        ? `train ${win.target} ${countedLabel(win.role, win.target ?? 0)}`
        : `train ${win.target} combat units`;
    case "structureQuota":
      return win.building
        ? `build ${win.target} ${countedLabel(win.building, win.target ?? 0)}`
        : `raise ${win.target} structures`;
    case "destroyMarked":
      return `destroy the ${win.targetCount ?? 1} marked enemy structures`;
    case "razeAll":
      return "level every enemy building";
    case "decapitate":
      return "destroy the enemy construction yard";
    case "annihilate":
      return "wipe out every enemy unit and building";
    case "holdTheLine":
      return `hold this ground for ${holdDurationLabel(win.ticks ?? 0)}`;
    default:
      return "complete the assigned objective";
  }
}

export function objectiveHeadline(win: WinCategory): string {
  const phrase = objectivePhrase(win);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export type MissionObjective = {
  id: string;
  text: string;
};

export function missionObjectives(
  mission: Pick<MissionDef, "win" | "index">,
  campaign: Pick<Campaign, "world" | "factions">,
): MissionObjective[] {
  const win = mission.win;
  const [us, them] = campaign.factions;
  const place = campaign.world.name;
  const winText = (() => {
    switch (win.kind) {
      case "harvestQuota":
        return `Extract ${win.target} credits from ${place}`;
      case "forceQuota":
        return win.role
          ? `Train ${win.target} ${countedLabel(win.role, win.target ?? 0)} for the ${us.name}`
          : `Train ${win.target} combat units for the ${us.name}`;
      case "structureQuota":
        return win.building
          ? `Build ${win.target} ${countedLabel(win.building, win.target ?? 0)}`
          : `Raise ${win.target} structures on ${place}`;
      case "destroyMarked":
        return `Destroy the ${win.targetCount ?? 1} marked enemy structures`;
      case "razeAll":
        return `Level every ${them.name} building`;
      case "decapitate":
        return `Destroy the ${them.name} construction yard`;
      case "annihilate":
        return `Wipe out all ${them.name} forces`;
      case "holdTheLine":
        return `Hold ${place} for ${holdDurationLabel(win.ticks ?? 0)}`;
      default:
        return "Complete the assigned objective";
    }
  })();
  return [
    { id: "win", text: winText },
    { id: "yard", text: "Protect our construction yard" },
    {
      id: "theater",
      text: `Hold ${place} against the ${them.name}`,
    },
  ];
}

export function generateBriefing(
  campaign: Pick<Campaign, "world" | "factions" | "characters">,
  mission: Pick<MissionDef, "name" | "win" | "index">,
): BriefingLine[] {
  const { advisor, commander, enemyLeader } = campaign.characters;
  const [us, them] = campaign.factions;
  const place = campaign.world.name;
  const biome = biomeLabel(campaign.world.biome);
  const analyst = characterLabel(advisor);
  const you = characterLabel(commander);
  const foe = characterLabel(enemyLeader);
  const win = mission.win;

  const report = (() => {
    switch (win.kind) {
      case "harvestQuota":
        return `${you}, ${place} still has ore in the ground. Get ${win.target} credits out before the ${them.name} cuts us off. ${foe} is already in the ${biome}.`;
      case "forceQuota":
        return `${you}, we don't have enough troops at ${place}. Train ${win.target} ${win.role ? countedLabel(win.role, win.target ?? 0) : "combat units"} or we lose this. The ${them.name} is already building up.`;
      case "structureQuota":
        return `${you}, lock down ${place}. We need ${win.target} ${win.building ? countedLabel(win.building, win.target ?? 0) : "structures"} up before the ${them.name} pushes through the ${biome}.`;
      case "destroyMarked":
        return `${you}, we marked ${win.targetCount ?? 1} high-value structures on ${place}. Take them out and the ${them.name} line breaks.`;
      case "razeAll":
        return `${you}, don't occupy. Burn every ${them.name} building on ${place}. ${foe} does not keep the ${biome}.`;
      case "decapitate":
        return `${you}, find the ${them.name} construction yard and destroy it. Without it, ${foe} can't hold ${place}.`;
      case "annihilate":
        return `${you}, wipe the ${them.name} off ${place}. No units. No buildings.`;
      case "holdTheLine":
        return `${you}, hold ${place} for ${holdDurationLabel(win.ticks ?? 0)}. Stay alive. Don't give ${foe} the ${biome}.`;
      default:
        return `${you}, the ${us.name} must ${objectivePhrase(win)}.`;
    }
  })();

  const orders = (() => {
    switch (win.kind) {
      case "harvestQuota":
        return `${analyst} is right. Get the ore out before ${foe} does. If the construction yard goes down, we're done.`;
      case "forceQuota":
        return `${analyst} is right. Train the units. Keep the construction yard up while they come online. ${foe} is already recruiting.`;
      case "structureQuota":
        return `${analyst} is right. Get those buildings up. Protect the construction yard — if it falls, the base is gone. ${foe} won't wait.`;
      case "destroyMarked":
        return `${analyst} marked the targets. Hit them. Don't lose the construction yard to ${foe} while you do it.`;
      case "razeAll":
        return `${analyst} is clear. Flatten ${foe}'s base. Ours stays up — starting with the construction yard.`;
      case "decapitate":
        return `${analyst} found the opening. Hit ${foe}'s yard. Protect ours.`;
      case "annihilate":
        return `${analyst} is right. Wipe ${foe} out. The construction yard does not fall.`;
      case "holdTheLine":
        return `${analyst} has the timer. We hold against ${foe}. Keep the construction yard up until time runs out.`;
      default:
        return `${analyst} is clear. Don't lose the construction yard to ${foe}.`;
    }
  })();

  const taunt = (() => {
    switch (win.kind) {
      case "harvestQuota":
        return `The ore on ${place} belongs to the ${them.name}. ${you} will leave empty-handed.`;
      case "forceQuota":
        return `Train all you want, ${you}. The ${them.name} already owns the ${biome}.`;
      case "structureQuota":
        return `Build your base. The ${them.name} will tear it down. ${you} won't keep ${place}.`;
      case "destroyMarked":
        return `Those structures aren't yours. Come die in the ${biome}, ${you}.`;
      case "razeAll":
        return `Burn what you can, ${you}. The ${them.name} still holds ${place}.`;
      case "decapitate":
        return `You won't reach our construction yard, ${you}. The ${biome} will bury you.`;
      case "annihilate":
        return `You want total war, ${you}? The ${them.name} will finish it. Stay off ${place}.`;
      case "holdTheLine":
        return `Hold as long as you want, ${you}. The ${them.name} can wait. ${place} is already ours.`;
      default:
        return `The ${them.name} already holds the ${biome}. ${you} won't take ${place}.`;
    }
  })();

  return [
    { speaker: "advisor", text: report },
    { speaker: "commander", text: orders },
    { speaker: "enemyLeader", text: taunt },
  ];
}

export function generateStory() {
  return { generateBriefing, objectivePhrase, missionObjectives };
}
