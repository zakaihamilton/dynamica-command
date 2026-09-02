import { NEW_MISSION_KINDS, WIN_KIND_ORDER } from "../catalog";
import { createRng } from "../seed/rng";
import type { MissionKind } from "../types";

export function pickMissionKinds(seed: number): MissionKind[] {
  const rng = createRng(seed, "win-order");
  const classic = rng.shuffle(WIN_KIND_ORDER).slice(0, 4);
  return rng.shuffle([...NEW_MISSION_KINDS, ...classic]);
}
