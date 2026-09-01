import { describe, expect, it } from "vitest";
import { createTutorialMission, tutorialPrompt } from "../lib/sim/tutorial";

describe("tutorial", () => {
  it("creates a mission with tutorial stage set to select", () => {
    const state = createTutorialMission(1234);
    expect(state.tutorialStage).toBe("select");
    expect(state.missionName).toBe("Dynamica Training Range");
    expect(state.missionKind).toBe("holdTheLine");
    expect(state.win.kind).toBe("holdTheLine");
  });

  it("deletes the director from runtime if present", () => {
    const state = createTutorialMission(1234);
    expect(state.runtime).toBeDefined();
    expect(state.runtime?.director).toBeUndefined();
  });

  it("returns the select prompt for the select stage", () => {
    const state = createTutorialMission(1234);
    expect(tutorialPrompt(state)).toBe("Tap or click your infantry to select it.");
  });

  it("returns the move prompt for the move stage", () => {
    const state = createTutorialMission(1234);
    state.tutorialStage = "move";
    expect(tutorialPrompt(state)).toBe("Move the selected unit to the highlighted ground.");
  });

  it("returns the harvest prompt for the harvest stage", () => {
    const state = createTutorialMission(1234);
    state.tutorialStage = "harvest";
    expect(tutorialPrompt(state)).toBe("Select the harvester, then order it to an ore field.");
  });

  it("returns the build prompt for the build stage", () => {
    const state = createTutorialMission(1234);
    state.tutorialStage = "build";
    expect(tutorialPrompt(state)).toBe("Open Construction and place a power plant.");
  });

  it("returns the produce prompt for the produce stage", () => {
    const state = createTutorialMission(1234);
    state.tutorialStage = "produce";
    expect(tutorialPrompt(state)).toBe("Open Production and queue infantry.");
  });

  it("returns the attack prompt for the attack stage", () => {
    const state = createTutorialMission(1234);
    state.tutorialStage = "attack";
    expect(tutorialPrompt(state)).toBe("Use attack-move or attack an enemy unit.");
  });

  it("returns the repair prompt for the repair stage", () => {
    const state = createTutorialMission(1234);
    state.tutorialStage = "repair";
    expect(tutorialPrompt(state)).toBe("Use the wrench on a damaged structure.");
  });

  it("returns the complete prompt for the complete stage", () => {
    const state = createTutorialMission(1234);
    state.tutorialStage = "complete";
    expect(tutorialPrompt(state)).toBe("Training complete. Deploy to mission 1 when ready.");
  });

  it("returns the complete prompt for undefined stage", () => {
    const state = createTutorialMission(1234);
    state.tutorialStage = undefined;
    expect(tutorialPrompt(state)).toBe("Training complete. Deploy to mission 1 when ready.");
  });
});
