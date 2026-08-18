import { createMission } from "./api";
import type { SimState } from "../types";

export function createTutorialMission(seed: number): SimState {
  const state = createMission({ seed, missionIndex: 0 });
  state.missionName = "Genesis Training Range";
  state.missionKind = "holdTheLine";
  state.tutorialStage = "select";
  state.win = { kind: "holdTheLine", ticks: 12 * 60 * 60 };
  state.appliedUpgrades = [];
  return state;
}

export function tutorialPrompt(state: SimState): string {
  switch (state.tutorialStage) {
    case "select": return "Tap or click your infantry to select it.";
    case "move": return "Move the selected unit to the highlighted ground.";
    case "harvest": return "Select the harvester, then order it to an ore field.";
    case "build": return "Open Construction and place a power plant.";
    case "produce": return "Open Production and queue infantry.";
    case "attack": return "Use attack-move or attack an enemy unit.";
    case "repair": return "Use the wrench on a damaged structure.";
    default: return "Training complete. Deploy to mission 1 when ready.";
  }
}
