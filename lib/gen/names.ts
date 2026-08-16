import type { BiomeName } from "../types";
import type { Rng } from "../seed/rng";

const PREFIX = [
  "Ash", "Iron", "Void", "Solar", "Dust", "Nova", "Keth", "Ryn", "Tal", "Vor",
  "Hel", "Mir", "Zha", "Orr", "Kael", "Syr", "Nox", "Lum", "Grav", "Pyre",
];
const MID = ["a", "e", "i", "o", "u", "ae", "ia", "or", "ul", "en"];
const SUFFIX = [
  "gard", "ron", "vex", "thal", "mir", "dax", "wyn", "sol", "kar", "neth",
  "ion", "ara", "osk", "ium", "eon", "ash", "or", "um", "is", "el",
];
const FACTION_END = [
  "Protocol", "Directorate", "Concord", "Legion", "Syndicate", "Mandate",
  "Pact", "Circle", "Host", "Union", "Order", "Front",
];
const PLACE = [
  "Rift", "Expanse", "Wastes", "Basin", "Reach", "Marches", "Spire", "Hollow",
  "Delta", "Grid", "Shelf", "Trench",
];
const TONE = [
  "grim industrial", "coldly optimistic", "war-weary", "fanatic", "pragmatic",
  "doctrinal", "desperate", "calculated",
];
const CONFLICT = [
  "a resource monopoly", "a broken ceasefire", "a succession crisis",
  "an orbital blockade", "a terraforming collapse", "a rogue AI compact",
  "a border annexation", "a relic excavation",
];
const ERA = [
  "late reconstruction", "second expansion", "post-collapse", "high mandate",
  "silent years", "open war decade",
];
export const BIOMES: BiomeName[] = [
  "ash plains", "crystal flats", "rust canyons", "salt marshes", "glass desert",
  "tundra grid", "jungle wreckage", "volcanic shelf",
];
const RANK = ["Commander", "Marshal", "Director", "Captain", "Overseer", "Warden"];
const ADVISOR = ["Strategist", "Attaché", "Quartermaster", "Analyst", "Herald"];
const ENEMY_TITLE = ["Warlord", "Prefect", "Autarch", "General", "Executor"];

export function genName(rng: Rng): string {
  return `${rng.pick(PREFIX)}${rng.pick(MID)}${rng.pick(SUFFIX)}`;
}

export function genFactionName(rng: Rng): string {
  return `${rng.pick(PREFIX)}${rng.pick(SUFFIX)} ${rng.pick(FACTION_END)}`;
}

export function genPlace(rng: Rng): string {
  return `${rng.pick(PREFIX)} ${rng.pick(PLACE)}`;
}

export function genTone(rng: Rng): string {
  return rng.pick(TONE);
}

export function genConflict(rng: Rng): string {
  return rng.pick(CONFLICT);
}

export function genEra(rng: Rng): string {
  return rng.pick(ERA);
}

export function genBiome(rng: Rng): BiomeName {
  return rng.pick(BIOMES);
}

export function genRank(rng: Rng): string {
  return rng.pick(RANK);
}

export function genAdvisorTitle(rng: Rng): string {
  return rng.pick(ADVISOR);
}

export function genEnemyTitle(rng: Rng): string {
  return rng.pick(ENEMY_TITLE);
}

export function genMissionTitle(rng: Rng, index: number): string {
  const ops = ["Operation", "Directive", "Strike", "Hold", "Harvest", "Siege"];
  return `${rng.pick(ops)} ${genName(rng)} ${index + 1}`;
}
