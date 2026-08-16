import { createRng } from "../seed/rng";
import type { Character } from "../types";
import { generateFace } from "./faces";
import { genAdvisorTitle, genEnemyTitle, genName, genRank } from "./names";

export function generateCharacters(seed: number): {
  commander: Character;
  advisor: Character;
  enemyLeader: Character;
} {
  const rng = createRng(seed, "characters");
  return {
    commander: {
      role: "commander",
      name: genName(rng.fork("cmd")),
      title: genRank(rng),
      face: generateFace(rng.fork("cmd-face")),
    },
    advisor: {
      role: "advisor",
      name: genName(rng.fork("adv")),
      title: genAdvisorTitle(rng),
      face: generateFace(rng.fork("adv-face")),
    },
    enemyLeader: {
      role: "enemyLeader",
      name: genName(rng.fork("foe")),
      title: genEnemyTitle(rng),
      face: generateFace(rng.fork("foe-face")),
    },
  };
}
