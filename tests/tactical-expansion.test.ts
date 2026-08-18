import { describe, expect, it } from "vitest";
import { createMission, tick } from "../lib/sim/api";
import { createTutorialMission, tutorialPrompt } from "../lib/sim/tutorial";

describe("tactical expansion", () => {
  it("gates tutorial orders until the matching stage", () => {
    const state = createTutorialMission(42);
    const unit = state.entities.find((entity) => entity.owner === 0 && entity.class === "unit")!;
    const result = tick(state, [{ type: "move", unitIds: [unit.id], x: unit.x + 2, y: unit.y }]);
    expect(result.events).toContainEqual({ type: "commandRejected", reason: "training step: move" });
    expect(tutorialPrompt(state)).toContain("select");
  });

  it("creates neutral scenario actors without allowing auto-targeting", () => {
    const state = createMission({ seed: 0, missionIndex: 1 });
    if (state.missionKind !== "escort" && state.missionKind !== "rescue") return;
    const neutral = state.entities.find((entity) => entity.neutral);
    expect(neutral).toBeDefined();
    if (state.missionKind === "escort") {
      expect(neutral?.path.at(-1)).toEqual(expect.objectContaining({ x: state.runtime?.zone?.x, y: state.runtime?.zone?.y }));
    }
    const hostile = state.entities.find((entity) => entity.owner === 1 && entity.class === "unit");
    expect(hostile?.attackTarget).not.toBe(neutral?.id);
  });

  it("recovers suppression on non-combat units and seeds classic secondary objectives", () => {
    const state = createMission({ seed: 0, missionIndex: 2 });
    const harvester = state.entities.find((entity) => entity.owner === 0 && entity.kind === "harvester")!;
    harvester.suppression = 10;
    tick(state);
    expect(harvester.suppression).toBe(9);
    expect(state.runtime?.secondary).toHaveLength(2);
    expect(state.runtime?.secondary[1]?.target).toBeDefined();
  });
});
