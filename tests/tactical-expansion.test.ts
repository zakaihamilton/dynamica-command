import { describe, expect, it } from "vitest";
import { createMission, issue, tick, inspect } from "../lib/sim/api";
import { createTutorialMission, tutorialPrompt } from "../lib/sim/tutorial";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
import { missionDifficulty } from "../lib/sim/difficulty";
import { BUILDING_STATS, STARTING_CREDITS, UNIT_STATS } from "../lib/catalog";
import { tooltipLines, tileTooltipLines } from "../lib/render/renderer";
import { objectiveProgress } from "../lib/sim/objectives";
import type { MissionKind } from "../lib/types";

function missionOfKind(kind: MissionKind, missionIndex: number) {
  for (let seed = 0; seed < 200; seed++) {
    const state = createMission({ seed, missionIndex });
    if (state.missionKind === kind) return state;
  }
  throw new Error(`No ${kind} mission at index ${missionIndex} in seeds 0–199`);
}

describe("tactical expansion", () => {
  it("starts missions with more credits and half-cost units and buildings", () => {
    const state = createMission({ seed: 421, missionIndex: 0 });

    expect(state.credits).toEqual([STARTING_CREDITS.player, STARTING_CREDITS.enemy]);
    expect(UNIT_STATS.harvester.cost).toBe(450);
    expect(UNIT_STATS.harvester.carryMax).toBe(250);
    expect(UNIT_STATS.infantry.cost).toBe(75);
    expect(UNIT_STATS.antiArmor.cost).toBe(160);
    expect(UNIT_STATS.tank.cost).toBe(425);
    expect(BUILDING_STATS.power.cost).toBe(300);
    expect(BUILDING_STATS.refinery.cost).toBe(500);
    expect(BUILDING_STATS.barracks.cost).toBe(375);
    expect(BUILDING_STATS.factory.cost).toBe(800);
    expect(BUILDING_STATS.turret.cost).toBe(275);
    expect(BUILDING_STATS.power.power).toBe(50);
    expect(UNIT_STATS.harvester.buildTicks).toBe(108);
    expect(UNIT_STATS.infantry.buildTicks).toBe(48);
    expect(UNIT_STATS.antiArmor.buildTicks).toBe(72);
    expect(UNIT_STATS.tank.buildTicks).toBe(120);
    expect(BUILDING_STATS.power.buildTicks).toBe(90);
    expect(BUILDING_STATS.refinery.buildTicks).toBe(120);
    expect(BUILDING_STATS.barracks.buildTicks).toBe(108);
    expect(BUILDING_STATS.factory.buildTicks).toBe(180);
    expect(BUILDING_STATS.turret.buildTicks).toBe(84);
  });

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

  it.each(["escort", "rescue"] as const)("creates %s neutrals without allowing auto-targeting", (kind) => {
    const state = missionOfKind(kind, 1);
    const neutral = state.entities.find((entity) => entity.neutral);
    expect(neutral).toBeDefined();
    if (kind === "escort") {
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

  it("keeps extraction assets stationary until a player unit reaches them", () => {
    const state = makeFixture({ win: { kind: "extraction", targetCount: 1, ticks: 100 } });
    addBuilding(state, 0, "constructionYard", 0, 0);
    const escort = addUnit(state, 0, "infantry", 2, 3);
    const asset = addUnit(state, 0, "infantry", 6, 3);
    asset.neutral = true;
    state.runtime = {
      kind: "extraction",
      phase: "active",
      targetIds: [asset.id],
      zone: { x: 0, y: 0 },
      deadline: 100,
      rescued: 0,
      required: 1,
      secondary: [],
    };

    issue(state, { type: "move", unitIds: [asset.id], x: 9, y: 3 });
    for (let i = 0; i < 10; i++) tick(state);
    expect(asset.neutral).toBe(true);
    expect(asset.x).toBe(6);
    expect(asset.y).toBe(3);

    issue(state, { type: "move", unitIds: [escort.id], x: asset.x, y: asset.y });
    for (let i = 0; i < 100 && asset.neutral; i++) tick(state);
    expect(asset.neutral).toBe(false);

    issue(state, { type: "move", unitIds: [asset.id], x: 9, y: 3 });
    for (let i = 0; i < 100; i++) tick(state);
    expect(asset.x).toBeGreaterThan(6);
  });

  it("counts extraction assets only after they reach the home zone", () => {
    const state = makeFixture({ win: { kind: "extraction", targetCount: 2, ticks: 5000 } });
    addBuilding(state, 0, "constructionYard", 0, 0);
    const escort = addUnit(state, 0, "infantry", 2, 3);
    const first = addUnit(state, 0, "infantry", 8, 3);
    const second = addUnit(state, 0, "infantry", 8, 5);
    first.neutral = true;
    first.marked = true;
    second.neutral = true;
    second.marked = true;
    state.runtime = {
      kind: "extraction",
      phase: "active",
      targetIds: [first.id, second.id],
      zone: { x: 0, y: 0 },
      deadline: 100,
      rescued: 0,
      required: 2,
      secondary: [],
    };

    issue(state, { type: "move", unitIds: [escort.id], x: first.x, y: first.y });
    for (let i = 0; i < 100 && first.neutral; i++) tick(state);
    expect(first.neutral).toBe(false);
    tick(state);
    expect(state.runtime.rescued).toBe(0);
    expect(tooltipLines(state, first, {})).toContain("Return to extraction zone");
    expect(tileTooltipLines(state, 0, 0)).toContain("Extraction zone");

    state.runtime.zone = { x: 9, y: 9 };
    first.x = 1;
    first.y = 1;
    tick(state);
    expect(state.runtime.zone).toEqual({ x: 0, y: 0 });
    expect(state.runtime.rescued).toBe(1);
    expect(first.marked).toBe(false);
    expect(objectiveProgress(state).label).toBe("Extracted 1 / 2");
    expect(tooltipLines(state, first, {})).not.toContain("Return to extraction zone");

    first.x = 8;
    first.y = 3;
    tick(state);
    expect(state.runtime.rescued).toBe(1);

    issue(state, { type: "move", unitIds: [escort.id], x: second.x, y: second.y });
    for (let i = 0; i < 100 && second.neutral; i++) tick(state);
    second.x = 0;
    second.y = 1;
    tick(state);
    expect(state.runtime.rescued).toBe(2);
    expect(objectiveProgress(state).label).toBe("Extracted 2 / 2");
    expect(inspect(state).result).toBe("won");
  });

  it("places extraction drop-off at the player construction yard", () => {
    const state = createMission({ seed: 3209, missionIndex: 0 });
    expect(state.missionKind).toBe("extraction");
    const yard = state.entities.find((entity) => entity.owner === 0 && entity.kind === "constructionYard");
    expect(yard).toBeDefined();
    expect(state.runtime?.zone).toEqual({ x: yard!.x, y: yard!.y });
    expect(state.entities.some((entity) => entity.marked && entity.neutral)).toBe(true);
  });

  it("labels locked rescue and extraction targets as stranded", () => {
    for (const kind of ["rescue", "extraction"] as const) {
      const state = makeFixture({ win: { kind, targetCount: 1, ticks: 100 } });
      const stranded = addUnit(state, 0, "infantry", 6, 3);
      stranded.neutral = true;
      state.runtime = {
        kind,
        phase: "active",
        targetIds: [stranded.id],
        zone: { x: 0, y: 0 },
        deadline: 100,
        rescued: 0,
        required: 1,
        secondary: [],
      };

      expect(tooltipLines(state, stranded, {})).toContain("Stranded");
    }
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

  it("shows suppression on the unit hover tooltip", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const unit = addUnit(state, 0, "infantry", 4, 4);
    expect(tooltipLines(state, unit, {}).some((line) => line.startsWith("Suppressed"))).toBe(false);
    unit.suppression = 42.2;
    expect(tooltipLines(state, unit, {})).toContain("Suppressed 43%");
  });
});
