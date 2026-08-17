import { createRng } from "../seed/rng";
import type { Character } from "../types";
import { generateFace } from "./faces";
import { genAdvisorTitle, genEnemyTitle, genPerson, genRank } from "./names";

export function generateCharacters(seed: number): {
  commander: Character;
  advisor: Character;
  enemyLeader: Character;
} {
  const rng = createRng(seed, "characters");
  const commander = genPerson(rng.fork("cmd"));
  const advisor = genPerson(rng.fork("adv"));
  const enemy = genPerson(rng.fork("foe"));
  return {
    commander: {
      role: "commander",
      name: commander.name,
      title: genRank(rng),
      face: generateFace(rng.fork("cmd-face"), "commander", { feminine: commander.feminine }),
    },
    advisor: {
      role: "advisor",
      name: advisor.name,
      title: genAdvisorTitle(rng),
      face: generateFace(rng.fork("adv-face"), "advisor", { feminine: advisor.feminine }),
    },
    enemyLeader: {
      role: "enemyLeader",
      name: enemy.name,
      title: genEnemyTitle(rng),
      face: generateFace(rng.fork("foe-face"), "enemyLeader", { feminine: enemy.feminine }),
    },
  };
}
