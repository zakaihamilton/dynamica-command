import { describe, expect, it } from "vitest";
import { evaluateObjectives, objectiveProgress } from "../lib/sim/objectives";
import { createTutorialMission, enterTutorialStage, tutorialMoveTile, tutorialPrompt } from "../lib/sim/tutorial";
import { addBuilding, makeFixture } from "../lib/sim/fixtures";
import { isWalkable } from "../lib/sim/world";

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
    expect(tutorialPrompt(state)).toBe("Move the selected unit to the highlighted ground (right click).");
  });

  it("returns the harvest prompt for the harvest stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "harvest";
    expect(tutorialPrompt(state)).toBe("Select the Harvester, then order it to an ore field.");
  });

  it("returns the build prompt for the build stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "build";
    expect(tutorialPrompt(state)).toBe("Open Construction (Q) and place a Power Plant.");
  });

  it("returns the produce prompt for the produce stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "produce";
    expect(tutorialPrompt(state)).toBe("Open Production (E) and train Infantry.");
  });

  it("returns the attack prompt for the attack stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "attack";
    expect(tutorialPrompt(state)).toBe("Use attack-move (Ctrl + right click) to advance while fighting, or attack an enemy unit.");
  });

  it("returns the repair prompt for the repair stage", () => {
    const state = createTutorialMission();
    state.tutorialStage = "repair";
    expect(tutorialPrompt(state)).toBe("Use Repair (R) on a damaged structure.");
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

  it("highlights a nearby walkable tile during the move stage", () => {
    const state = createTutorialMission();
    expect(tutorialMoveTile(state)).toBeNull();
    enterTutorialStage(state, "move");
    const tile = tutorialMoveTile(state);
    const infantry = state.entities.find((entity) => entity.owner === 0 && entity.kind === "infantry" && entity.hp > 0);
    expect(tile).not.toBeNull();
    expect(infantry).toBeDefined();
    expect(tile).not.toEqual({ x: Math.round(infantry!.x), y: Math.round(infantry!.y) });
    expect(isWalkable(state, tile!.x, tile!.y)).toBe(true);
  });

  it("damages a finished friendly building when the repair stage begins", () => {
    const state = createTutorialMission();
    const building = state.entities.find((entity) => entity.owner === 0 && entity.class === "building" && entity.constructing === 0 && entity.hp === entity.maxHp);
    expect(building).toBeDefined();
    const full = building!.hp;
    enterTutorialStage(state, "repair");
    expect(state.tutorialStage).toBe("repair");
    expect(building!.hp).toBe(Math.max(1, Math.floor(full / 2)));
    enterTutorialStage(state, "repair");
    expect(building!.hp).toBe(Math.max(1, Math.floor(full / 2)));
  });

  it("does not damage another building if one is already damaged", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const yard = addBuilding(state, 0, "constructionYard", 2, 2);
    const power = addBuilding(state, 0, "power", 6, 2);
    power.hp = power.maxHp - 4;
    enterTutorialStage(state, "repair");
    expect(yard.hp).toBe(yard.maxHp);
    expect(power.hp).toBe(power.maxHp - 4);
  });

  it("does not halve a second full building on re-entry", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const yard = addBuilding(state, 0, "constructionYard", 2, 2);
    const power = addBuilding(state, 0, "power", 6, 2);
    enterTutorialStage(state, "repair");
    expect([yard, power].filter((building) => building.hp < building.maxHp)).toHaveLength(1);
    enterTutorialStage(state, "repair");
    expect([yard, power].filter((building) => building.hp < building.maxHp)).toHaveLength(1);
  });
});
