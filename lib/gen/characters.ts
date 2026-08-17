import { createRng } from "../seed/rng";
import type { Character } from "../types";
import { generateFace } from "./faces";
import { genAdvisorTitle, genEnemyTitle, genPerson, genRank } from "./names";
import { portraitSheetNumber } from "./portraitCatalog";

export function generateCharacters(seed: number): {
  commander: Character;
  advisor: Character;
  enemyLeader: Character;
} {
  const rng = createRng(seed, "characters");
  const commander = genPerson(rng.fork("cmd"));
  const advisor = genPerson(rng.fork("adv"));
  const enemy = genPerson(rng.fork("foe"));
  const usedIds = new Set<string>();
  const usedSheets = new Set<number>();

  const takeFace = (fork: string, role: Character["role"], feminine: boolean) => {
    const face = generateFace(rng.fork(fork), role, {
      feminine,
      excludeIds: usedIds,
      excludeSheets: usedSheets,
    });
    usedIds.add(face.portraitId);
    usedSheets.add(portraitSheetNumber(face.portraitId));
    return face;
  };

  return {
    commander: {
      role: "commander",
      name: commander.name,
      title: genRank(rng),
      face: takeFace("cmd-face", "commander", commander.feminine),
    },
    advisor: {
      role: "advisor",
      name: advisor.name,
      title: genAdvisorTitle(rng),
      face: takeFace("adv-face", "advisor", advisor.feminine),
    },
    enemyLeader: {
      role: "enemyLeader",
      name: enemy.name,
      title: genEnemyTitle(rng),
      face: takeFace("foe-face", "enemyLeader", enemy.feminine),
    },
  };
}
