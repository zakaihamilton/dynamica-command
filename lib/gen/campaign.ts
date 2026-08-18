import { createRng, formatSeed } from "../seed/rng";
import type { Campaign, MissionDef } from "../types";
import { generateCharacters } from "./characters";
import { generateFactions } from "./factions";
import { mapSizeForMission } from "./map";
import { genMissionTitle } from "./names";
import { generateWinCategory, pickMissionKinds } from "./objectives";
import { generateBriefing } from "./story";
import { generateWorld } from "./world";

export function createCampaign(seed: number): Campaign {
  const world = generateWorld(seed);
  const factions = generateFactions(seed);
  const characters = generateCharacters(seed);
  const kinds = pickMissionKinds(seed);
  const missions: MissionDef[] = kinds.map((kind, index) => {
    const win = generateWinCategory(seed, index, kind);
    const draft: MissionDef = {
      index,
      name: genMissionTitle(createRng(seed, `mission-title:${index}`), kind),
      briefing: [],
      win,
      mapSize: mapSizeForMission(index),
      kind: win.kind,
    };
    draft.briefing = generateBriefing({ world, factions, characters }, draft);
    return draft;
  });

  return {
    seed: formatSeed(seed),
    seedNumber: seed,
    world,
    factions,
    characters,
    missions,
  };
}
