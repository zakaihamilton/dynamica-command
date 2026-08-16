import { createRng } from "../seed/rng";
import type { WorldSetting } from "../types";
import { genBiome, genConflict, genEra, genPlace, genTone } from "./names";

export function generateWorld(seed: number): WorldSetting {
  const rng = createRng(seed, "world");
  return {
    name: genPlace(rng),
    tone: genTone(rng),
    conflict: genConflict(rng),
    era: genEra(rng),
    biome: genBiome(rng),
  };
}
