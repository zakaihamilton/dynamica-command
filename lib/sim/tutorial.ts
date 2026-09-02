import { createMission } from "./api";
import type { SimState } from "../types";

export const TUTORIAL_SEED = 0;

export function createTutorialMission(): SimState {
  const state = createMission({ seed: TUTORIAL_SEED, missionIndex: 0 });
  state.missionName = "Dynamica Training Range";
  state.missionKind = "holdTheLine";
  state.tutorialStage = "select";
  state.win = { kind: "holdTheLine" };
  if (state.runtime) {
    state.runtime.kind = "holdTheLine";
    delete state.runtime.deadline;
    delete state.runtime.director;
    delete state.runtime.convoyStartTick;
  }
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
    default: return "Training complete. Return to the command desk when ready.";
  }
}
