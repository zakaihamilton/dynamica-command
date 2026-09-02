import { createMission } from "./api";
import type { SimState } from "../types";

export const TUTORIAL_SEED = 0;
export { tutorialPrompt, tutorialMoveTile, enterTutorialStage } from "./tutorialStage";

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
