import { describe, expect, it } from "vitest";
import { evaluateObjectives, objectiveProgress } from "../lib/sim/objectives";
import { createTutorialMission, tutorialPrompt } from "../lib/sim/tutorial";

describe("tutorial", () => {
  it("creates a seed 0000 training mission with no time limit", () => {
    const state = createTutorialMission();
    expect(state.seed).toBe(0);
    expect(state.tutorialStage).toBe("select");
    expect(state.missionName).toBe("Dynamica Training Range");
    expect(state.missionKind).toBe("holdTheLine");
    expect(state.win).toEqual({ kind: "holdTheLine" });
    expect(state.win.ticks).toBeUndefined();
    expect(state.runtime?.kind).toBe("holdTheLine");
    expect(state.runtime?.deadline).toBeUndefined();
    expect(state.runtime?.director).toBeUndefined();
    expect(objectiveProgress(state).label).toBe("Training range — no time limit");
  });

  it("does not win from elapsed time", () => {
    const state = createTutorialMission();
    state.tick = 12 * 60 * 60;
    expect(evaluateObjectives(state)).toEqual([]);
    expect(state.result).toBe("playing");
  });

  it("deletes the director from runtime if present", () => {
    const state = createTutorialMission();
    expect(state.runtime).toBeDefined();
    expect(state.runtime?.director).toBeUndefined();
  });

  it("returns the select prompt for the select stage", () => {
    const state = createTutorialMission();
    expect(tutorialPrompt(state)).toBe("Tap or click your Infantry to select it.");
  });

  it("returns the move prompt for the move stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "move";
    expect(tutorialPrompt(state)).toBe("Move the selected unit to the highlighted ground.");
  });

  it("returns the harvest prompt for the harvest stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "harvest";
    expect(tutorialPrompt(state)).toBe("Select the Harvester, then order it to an ore field.");
  });

  it("returns the build prompt for the build stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "build";
    expect(tutorialPrompt(state)).toBe("Open Construction and place a Power Plant.");
  });

  it("returns the produce prompt for the produce stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "produce";
    expect(tutorialPrompt(state)).toBe("Open Production and train Infantry.");
  });

  it("returns the attack prompt for the attack stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "attack";
    expect(tutorialPrompt(state)).toBe("Use attack-move to advance while fighting, or attack an enemy unit.");
  });

  it("returns the repair prompt for the repair stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "repair";
    expect(tutorialPrompt(state)).toBe("Use Repair on a damaged structure.");
  });

  it("returns the complete prompt for the complete stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "complete";
    expect(tutorialPrompt(state)).toBe("Training complete. Return to the command desk when ready.");
  });

  it("returns the complete prompt for undefined stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = undefined;
    expect(tutorialPrompt(state)).toBe("Training complete. Return to the command desk when ready.");
  });
});
