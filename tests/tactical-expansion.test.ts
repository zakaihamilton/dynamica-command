import { describe, expect, it } from "vitest";
import { createMission, issue, tick } from "../lib/sim/api";
import { createTutorialMission, tutorialPrompt } from "../lib/sim/tutorial";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
import { missionDifficulty } from "../lib/sim/difficulty";

describe("tactical expansion", () => {
  it("ramps enemy pressure across the campaign instead of starting at endgame strength", () => {
    const opening = createMission({ seed: 421, missionIndex: 0 });
    const finale = createMission({ seed: 421, missionIndex: 7 });
    const openingEnemy = opening.entities.filter((entity) => entity.owner === 1 && entity.hp > 0);
    const finaleEnemy = finale.entities.filter((entity) => entity.owner === 1 && entity.hp > 0);

    expect(opening.entities.some((entity) => entity.owner === 0 && entity.kind === "barracks")).toBe(true);
    expect(openingEnemy.some((entity) => entity.kind === "tank" || entity.kind === "turret")).toBe(false);
    expect(finaleEnemy.some((entity) => entity.kind === "tank" || entity.kind === "turret")).toBe(true);
    expect(missionDifficulty(0).enemyProductionStart).toBeGreaterThan(missionDifficulty(7).enemyProductionStart);
    expect(missionDifficulty(0).enemyAssaultEvery).toBeGreaterThan(missionDifficulty(7).enemyAssaultEvery);
  });

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
    } else {
      expect(neutral?.path).toEqual([]);
    }
    const hostile = state.entities.find((entity) => entity.owner === 1 && entity.class === "unit");
    expect(hostile?.attackTarget).not.toBe(neutral?.id);
  });

  it("frees rescue actors when a player unit reaches them", () => {
    const state = makeFixture({ win: { kind: "rescue", targetCount: 1, ticks: 100 } });
    addBuilding(state, 0, "constructionYard", 0, 0);
    const rescuer = addUnit(state, 0, "infantry", 2, 3);
    const stranded = addUnit(state, 0, "infantry", 6, 3);
    stranded.neutral = true;
    state.runtime = {
      kind: "rescue",
      phase: "active",
      targetIds: [stranded.id],
      zone: { x: 0, y: 0 },
      deadline: 100,
      rescued: 0,
      required: 1,
      secondary: [],
    };

    tick(state);
    expect(stranded.neutral).toBe(true);
    issue(state, { type: "move", unitIds: [rescuer.id], x: stranded.x, y: stranded.y });
    for (let i = 0; i < 100; i++) tick(state);

    expect(stranded.neutral).toBe(false);
    expect(state.runtime.rescued).toBe(1);
  });

  it("completes a rescue quota even when the timed secondary objective expired", () => {
    const state = makeFixture({ win: { kind: "rescue", targetCount: 3, ticks: 10 } });
    addBuilding(state, 0, "constructionYard", 0, 0);
    state.tick = 10;
    state.runtime = {
      kind: "rescue",
      phase: "active",
      targetIds: [],
      rescued: 3,
      required: 3,
      secondary: [{ id: "time", kind: "completeBefore", label: "Complete before deadline", target: 10 }],
    };

    tick(state);

    expect(state.result).toBe("won");
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
