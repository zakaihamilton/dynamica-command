import type { SimState } from "../types";
import { emptyRoleCounts } from "./world";

export function createBaseState(
  overrides: Pick<SimState, "seed" | "missionIndex" | "width" | "height" | "tiles" | "heights" | "surfaces" | "biome" | "resourceAmount" | "fog" | "credits" | "win" | "rngState" | "factions" | "missionName">,
): SimState {
  return {
    tick: 0,
    entities: [],
    nextId: 1,
    creditsEarned: [0, 0],
    unitsProduced: [0, 0],
    unitsProducedByRole: emptyRoleCounts(),
    buildingsCompleted: [0, 0],
    buildingsCompletedByKind: {},
    losses: { units: [0, 0], buildings: [0, 0] },
    result: "playing",
    ...overrides,
  };
}
