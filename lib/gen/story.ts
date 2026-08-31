import { labelFor } from "../catalog";
import type { BriefingLine, BuildingKind, Campaign, MissionDef, UnitKind, WinCategory } from "../types";
import { biomeLabel, characterLabel } from "./names";
import { missionTimeLimitLabel } from "./objectives";
import { formatMissionMinutesFromTicks } from "./pacing";

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
  return formatMissionMinutesFromTicks(ticks);
}

function scenarioTimeLimitLabel(win: WinCategory): string {
  return missionTimeLimitLabel({ kind: win.kind, ticks: win.ticks ?? 3600 })!;
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
    case "escort":
      return `escort ${win.targetCount ?? 1} convoy units to extraction within ${scenarioTimeLimitLabel(win)}`;
    case "sabotage":
      return `sabotage ${win.targetCount ?? 1} enemy systems within ${scenarioTimeLimitLabel(win)}`;
    case "rescue":
      return `rescue ${win.targetCount ?? 1} stranded units within ${scenarioTimeLimitLabel(win)}`;
    case "extraction":
      return `extract ${win.targetCount ?? 1} assets within ${scenarioTimeLimitLabel(win)}`;
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
      case "escort":
        return `Escort the convoy through ${place} within ${scenarioTimeLimitLabel(win)}`;
      case "sabotage":
        return `Sabotage ${win.targetCount ?? 1} enemy systems within ${scenarioTimeLimitLabel(win)}`;
      case "rescue":
        return `Rescue ${win.targetCount ?? 1} stranded units within ${scenarioTimeLimitLabel(win)}`;
      case "extraction":
        return `Extract ${win.targetCount ?? 1} assets from ${place} within ${scenarioTimeLimitLabel(win)}`;
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

/**
 * FNV-1a over a short key: picks deterministic dialogue variants so two
 * missions of one campaign rarely open identically without needing an RNG
 * threaded through campaign generation.
 */
function variantIndex(key: string, mod: number): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % mod;
}

const ADVISOR_LEADS = [
  "Recon is in.",
  "Signal intercepts just confirmed it.",
  "Survey teams finished their sweep.",
  "Long-range scans cleared an hour ago.",
  "Here is the tactical picture.",
  "Forward observers checked in early.",
];

const COMMANDER_ACKS = [
  (analyst: string) => `${analyst} has the measure of it.`,
  (analyst: string) => `I share ${analyst}'s read.`,
  (analyst: string) => `${analyst} sees what I see.`,
  (analyst: string) => `Confirmed — and ${analyst} understates it.`,
  (analyst: string) => `${analyst} is right on every count.`,
  (analyst: string) => `That matches ${analyst}'s assessment.`,
];

export function generateBriefing(
  campaign: Pick<Campaign, "world" | "factions" | "characters">,
  mission: Pick<MissionDef, "name" | "win" | "index" | "biome">,
): BriefingLine[] {
  const { advisor, commander, enemyLeader } = campaign.characters;
  const [us, them] = campaign.factions;
  const place = campaign.world.name;
  const biome = biomeLabel(mission.biome);
  const analyst = characterLabel(advisor);
  const you = characterLabel(commander);
  const foe = characterLabel(enemyLeader);
  const win = mission.win;
  const pick = (mod: number) => variantIndex(`${mission.index}:${win.kind}:${place}`, mod);
  const lead = ADVISOR_LEADS[pick(ADVISOR_LEADS.length)]!;
  const ack = COMMANDER_ACKS[pick(COMMANDER_ACKS.length)]!(analyst);

  const report = (() => {
    switch (win.kind) {
      case "harvestQuota":
        return `Our geologists count ${win.target} credits still in the ground under ${place}. ${foe} has scouts working the ${biome}, and the ${them.name} intends to starve this field before we load a single harvester.`;
      case "forceQuota":
        return `Headcounts put us light against the ${them.name} buildup in the ${biome}. We need ${win.target} ${win.role ? countedLabel(win.role, win.target ?? 0) : "combat units"} in the field soon — ${foe} recruits faster than we do.`;
      case "structureQuota":
        return `${place} is open ground right now, but not for long. Survey calls for ${win.target} ${win.building ? countedLabel(win.building, win.target ?? 0) : "structures"}, sited before the ${them.name} arrives in strength through the ${biome}. Every foundation gets more expensive once ${foe} commits.`;
      case "destroyMarked":
        return `We painted ${win.targetCount ?? 1} high-value structures inside the enemy perimeter at ${place}. Kill them and the ${them.name} line folds. ${foe} knows we know — expect layered defenses.`;
      case "razeAll":
        return `No occupation this time. The ${them.name} built hard across ${place}; command wants every structure gone. Leave ${foe} nothing worth garrisoning in the ${biome}.`;
      case "decapitate":
        return `Every ${them.name} operation routes through a single construction yard under ${foe}'s banner in the ${biome}. Find it and cut it out of ${place} — without it they cannot rebuild.`;
      case "annihilate":
        return `This ends at ${place}. Every ${them.name} unit, every structure — gone from the ${biome}. ${foe} does not get a second base or a third chance.`;
      case "holdTheLine":
        return `${foe} is massing for a full push on ${place}. If we stand for ${holdDurationLabel(win.ticks ?? 0)}, their advance dies in the ${biome}. Expect everything they have left.`;
      case "escort":
        return `A supply convoy crosses ${place} — ${win.targetCount ?? 1} slow movers through ambush country. ${foe} hunts soft targets first, and the ${biome} offers endless killing lanes.`;
      case "sabotage":
        return `${foe} runs ${win.targetCount ?? 1} hardened systems beneath ${place}: comms, power, munitions. Drop all of them before the deadline and the ${them.name} goes blind in the ${biome}.`;
      case "rescue":
        return `Survivors are broadcasting from the ${biome} — ${win.targetCount ?? 1} of ours at ${place}, scattered but alive. ${foe}'s sweeps close by the hour.`;
      case "extraction":
        return `Our assets at ${place} are packed and ready — ${win.targetCount ?? 1} crates that cannot reach ${them.name} hands. Pull them out before ${foe} seals the corridor.`;
      default:
        return `The ${them.name} holds the ${biome}, and ${foe} means to keep it. ${us.name} command requires that we ${objectivePhrase(win)} before they finish digging in.`;
    }
  })();

  const orders = (() => {
    switch (win.kind) {
      case "harvestQuota":
        return `Then the ore comes out first. Get your harvesters rolling, screen the refineries, and keep the construction yard protected — no ore, no war.`;
      case "forceQuota":
        return `Then we out-produce them. Train those units fast, cover the construction yard while they come online, and make ${foe} pay for every probe against your lines.`;
      case "structureQuota":
        return `Break ground now. I want those structures up before the ${them.name} crests the ridge, turrets covering the approaches, and the construction yard defended around the clock.`;
      case "destroyMarked":
        return `Strike the marked targets hard and fast — in, out, done. Keep the construction yard standing while you do it. Losing it loses ${place}.`;
      case "razeAll":
        return `Total demolition, then. Nothing of theirs stays upright across ${place}. Ours stays up — starting with the construction yard.`;
      case "decapitate":
        return `One target matters. Their construction yard falls today — cut the head off and the rest is cleanup at ${place}. Guard ours until then.`;
      case "annihilate":
        return `Understood. Nothing walks away and nothing stands. Shield the construction yard while you finish the ${them.name} off.`;
      case "holdTheLine":
        return `Then we plant our boots. The line holds for ${holdDurationLabel(win.ticks ?? 0)} — not a second less — and the construction yard holds with it.`;
      case "escort":
        return `The convoy reaches extraction. Screen the route, keep escorts tight, and cover the construction yard until the last wheel clears ${place}.`;
      case "sabotage":
        return `Quiet work, loud exit. All of those systems go dark before the deadline — and if the construction yard is threatened, the yard wins.`;
      case "rescue":
        return `We bring our people home. Fast in, faster out — and the construction yard stays untouchable until they are aboard.`;
      case "extraction":
        return `Load everything. Nothing of ours stays on ${place} for ${foe} to catalogue. The construction yard stands until the last lift clears.`;
      default:
        return `Proceed as briefed. Protect the construction yard, complete the objective, and give ${foe} no openings. Good hunting.`;
    }
  })();

  const taunt = (() => {
    switch (win.kind) {
      case "harvestQuota":
        return `Ore flows to the strong, ${you}. The ${them.name} claims this field — roll your harvesters out and watch them burn.`;
      case "forceQuota":
        return `Count your new recruits twice, ${you}. The ${biome} has swallowed better armies than the one you are assembling.`;
      case "structureQuota":
        return `Raise your little fortress, ${you}. Fixed defenses only give ${foe} something to aim at.`;
      case "destroyMarked":
        return `Come for the painted structures by all means, ${you}. The ${biome} is generous with graves.`;
      case "razeAll":
        return `Burn whatever you can reach, ${you}. The ${them.name} buries arsonists where they stand.`;
      case "decapitate":
        return `Our construction yard sits behind three lines of steel, ${you}. Bring a map. You will want it for the retreat.`;
      case "annihilate":
        return `You want everything dead, ${you}? Bold words from someone so exposed. The ${them.name} digs graves in pairs.`;
      case "holdTheLine":
        return `Dig in all you like, ${you}. Time fights for the ${them.name}. When the clock runs down, the ${biome} belongs to ${foe}.`;
      case "escort":
        return `Your convoy rolls into a shooting gallery, ${you}. ${foe} collects its tolls in wrecks.`;
      case "sabotage":
        return `Sneak, crawl, cut wires — it changes nothing, ${you}. ${foe}'s systems bite back, and my crews are waiting.`;
      case "rescue":
        return `Faint signals in the dark, ${you}. Your people stopped answering hours ago, and ${foe} sweeps closer every hour you delay.`;
      case "extraction":
        return `Run with your cargo, ${you}. The corridor out of ${place} closes soon — and it closes on whatever is still inside.`;
      default:
        return `The ${biome} already flies ${them.name} colors, ${you}. Pray your retreat outruns your advance.`;
    }
  })();

  return [
    { speaker: "advisor", text: `${lead} ${report}` },
    { speaker: "commander", text: `${ack} ${orders}` },
    { speaker: "enemyLeader", text: taunt },
  ];
}

export function generateStory() {
  return { generateBriefing, objectivePhrase, missionObjectives };
}
