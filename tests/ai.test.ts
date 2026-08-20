import { describe, expect, it } from "vitest";
import { RETREAT_MAX_TICKS, RETREAT_RECOVER_HEALTH, tickAi } from "../lib/sim/ai";
import { createMission, tick } from "../lib/sim/api";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
import { missionDifficulty } from "../lib/sim/difficulty";
import { powerFor } from "../lib/sim/world";

describe("enemy AI", () => {
  it("builds a power plant before a factory when the grid is in deficit", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 12, 12);
    addBuilding(s, 1, "barracks", 8, 12);
    addBuilding(s, 1, "refinery", 12, 15);
    addBuilding(s, 1, "turret", 7, 12);
    s.credits[1] = 5000;
    s.tick = 96;
    expect(powerFor(s, 1)).toBeLessThan(0);

    tickAi(s);

    expect(s.entities.some((e) => e.owner === 1 && e.kind === "power" && e.constructing > 0)).toBe(true);
    expect(s.entities.some((e) => e.kind === "factory")).toBe(false);
  });

  it("assigns idle combat units to a player threat near the yard", () => {
    const s = makeFixture({ width: 20, height: 20, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 8, 8);
    const guard = addUnit(s, 1, "infantry", 10, 8);
    const harvester = addUnit(s, 1, "harvester", 11, 9);
    const foe = addUnit(s, 0, "tank", 9, 10);

    tickAi(s);

    expect(guard.attackTarget).toBe(foe.id);
    expect(guard.path.length).toBeGreaterThan(0);
    expect(harvester.attackTarget).toBeUndefined();
  });

  it("sends assault raiders at a player harvester and leaves a home guard", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 2, 2);
    addBuilding(s, 0, "constructionYard", 18, 18);
    const guard = addUnit(s, 1, "infantry", 5, 2);
    const raider = addUnit(s, 1, "infantry", 8, 8);
    const extra = addUnit(s, 1, "tank", 9, 9);
    const harvester = addUnit(s, 0, "harvester", 16, 16);
    const playerYard = s.entities.find((e) => e.owner === 0 && e.kind === "constructionYard")!;
    s.tick = 720;

    tickAi(s);

    expect(s.aiState).toBe("assault");
    expect(guard.attackTarget).toBeUndefined();
    expect(guard.path).toEqual([]);
    expect([raider.attackTarget, extra.attackTarget]).toEqual([harvester.id, playerYard.id]);
    expect(raider.path.length).toBeGreaterThan(0);
  });

  it("splits two assault raiders between a harvester and the player yard", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 2, 2);
    const playerYard = addBuilding(s, 0, "constructionYard", 18, 18);
    addUnit(s, 1, "infantry", 5, 2);
    const even = addUnit(s, 1, "infantry", 8, 8);
    const odd = addUnit(s, 1, "infantry", 9, 9);
    const harvester = addUnit(s, 0, "harvester", 16, 16);
    s.tick = 720;

    tickAi(s);

    expect(s.aiState).toBe("assault");
    expect(even.attackTarget).toBe(harvester.id);
    expect(odd.attackTarget).toBe(playerYard.id);
  });

  it("prioritizes a live convoy over the default harassment targets", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "escort", targetCount: 1, ticks: 5000 } });
    addBuilding(s, 1, "constructionYard", 2, 2);
    addBuilding(s, 0, "constructionYard", 18, 18);
    addUnit(s, 1, "infantry", 5, 2);
    const raider = addUnit(s, 1, "tank", 8, 8);
    const convoy = addUnit(s, 0, "tank", 15, 15);
    convoy.neutral = true;
    convoy.scenarioRole = "convoy";
    addUnit(s, 0, "harvester", 16, 16);
    s.runtime = {
      kind: "escort",
      phase: "active",
      targetIds: [convoy.id],
      zone: { x: 20, y: 20 },
      deadline: 5000,
      rescued: 0,
      required: 1,
      secondary: [],
    };
    s.tick = 720;

    tickAi(s);

    expect(raider.attackTarget).toBe(convoy.id);
  });

  it("stations a guard near marked sabotage targets", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "sabotage", targetCount: 1, ticks: 5000 } });
    addBuilding(s, 1, "constructionYard", 2, 2);
    const target = addBuilding(s, 1, "objective", 10, 10, 0, true);
    const guard = addUnit(s, 1, "infantry", 8, 8);
    s.runtime = {
      kind: "sabotage",
      phase: "active",
      targetIds: [target.id],
      rescued: 0,
      required: 1,
      secondary: [],
    };

    tickAi(s);

    expect(guard.orderMode).toBe("move");
    expect(guard.path.at(-1)).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  it("places a turret when a threat is at the yard", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 12, 12);
    addUnit(s, 0, "tank", 14, 12);
    s.credits[1] = 5000;

    tickAi(s);

    expect(s.aiState).toBe("defense");
    expect(s.entities.some((e) => e.owner === 1 && e.kind === "turret" && e.constructing > 0)).toBe(true);
  });

  it("retreats battered combat units to the enemy yard", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    const yard = addBuilding(s, 1, "constructionYard", 2, 2);
    addBuilding(s, 0, "constructionYard", 18, 18);
    const wounded = addUnit(s, 1, "infantry", 16, 16);
    const ally = addUnit(s, 1, "tank", 15, 16);
    wounded.hp = 10;
    ally.hp = 10;
    wounded.attackTarget = 99;
    ally.attackTarget = 99;

    tickAi(s);

    expect(s.aiState).toBe("retreat");
    expect(wounded.attackTarget).toBeUndefined();
    expect(ally.attackTarget).toBeUndefined();
    expect(wounded.path.at(-1)).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }));
    const end = wounded.path.at(-1)!;
    expect(Math.hypot(end.x - yard.x, end.y - yard.y)).toBeLessThan(4);
  });

  it("assigns an idle raider between assault waves", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 2, 2);
    addBuilding(s, 0, "constructionYard", 18, 18);
    const guard = addUnit(s, 1, "infantry", 5, 2);
    const raider = addUnit(s, 1, "infantry", 8, 8);
    const harvester = addUnit(s, 0, "harvester", 16, 16);
    s.tick = 721;

    tickAi(s);

    expect(s.aiState).toBe("assault");
    expect(guard.attackTarget).toBeUndefined();
    expect(raider.attackTarget).toBe(harvester.id);
    expect(raider.path.length).toBeGreaterThan(0);
  });

  it("leaves retreat after HP recovers and recommits raiders", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 2, 2);
    addBuilding(s, 0, "constructionYard", 18, 18);
    const guard = addUnit(s, 1, "infantry", 5, 2);
    const raider = addUnit(s, 1, "tank", 9, 9);
    const harvester = addUnit(s, 0, "harvester", 16, 16);
    s.tick = 720;
    raider.hp = 10;
    guard.hp = 10;

    tickAi(s);
    expect(s.aiState).toBe("retreat");

    guard.hp = guard.maxHp;
    raider.hp = raider.maxHp;
    expect(raider.hp / raider.maxHp).toBeGreaterThanOrEqual(RETREAT_RECOVER_HEALTH);
    s.tick = 721;
    tickAi(s);

    expect(s.aiState).toBe("assault");
    expect(s.aiRetreatLocked).toBeUndefined();
    expect(guard.attackTarget).toBeUndefined();
    expect(raider.attackTarget).toBe(harvester.id);
  });

  it("times out a long retreat and hunts even while still wounded", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 2, 2);
    addBuilding(s, 0, "constructionYard", 18, 18);
    const guard = addUnit(s, 1, "infantry", 5, 2);
    const raider = addUnit(s, 1, "tank", 9, 9);
    const harvester = addUnit(s, 0, "harvester", 16, 16);
    raider.hp = 10;
    guard.hp = 10;
    s.tick = 720;
    tickAi(s);
    expect(s.aiState).toBe("retreat");

    s.tick = 720 + RETREAT_MAX_TICKS;
    tickAi(s);

    expect(s.aiState).toBe("assault");
    expect(s.aiRetreatLocked).toBe(true);
    expect(raider.attackTarget).toBe(harvester.id);
  });

  it("produces and assigns an attack during a short headless mission", () => {
    const state = createMission({ seed: 421, missionIndex: 0 });
    for (let i = 0; i < 800 && state.result === "playing"; i++) {
      tick(state);
    }
    expect(state.unitsProduced[1]).toBeGreaterThan(0);
    const raider = state.entities.find(
      (entity) => entity.owner === 1 && entity.class === "unit" && entity.kind !== "harvester" && entity.hp > 0 && entity.attackTarget !== undefined,
    );
    expect(raider).toBeDefined();
  });

  it("queues anti-armor when the player fields more tanks than infantry", () => {
    const s = makeFixture({ width: 28, height: 28, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 12, 12);
    addBuilding(s, 1, "power", 16, 12);
    addBuilding(s, 1, "barracks", 8, 12);
    addBuilding(s, 1, "refinery", 12, 16);
    addUnit(s, 1, "harvester", 18, 16);
    addUnit(s, 0, "tank", 2, 2);
    addUnit(s, 0, "tank", 3, 2);
    s.credits[1] = 5000;
    s.tick = 180;

    tickAi(s);

    const barracks = s.entities.find((e) => e.owner === 1 && e.kind === "barracks");
    expect(barracks?.producing?.kind).toBe("antiArmor");
  });

  it("does not place turrets past the mission cap", () => {
    const s = makeFixture({ width: 28, height: 28, win: { kind: "annihilate" } });
    s.missionIndex = 4;
    addBuilding(s, 1, "constructionYard", 12, 12);
    addBuilding(s, 1, "turret", 10, 12);
    addBuilding(s, 1, "turret", 14, 12);
    addBuilding(s, 1, "turret", 12, 10);
    addUnit(s, 0, "tank", 14, 14);
    s.credits[1] = 5000;

    tickAi(s);

    expect(s.aiState).toBe("defense");
    expect(s.entities.filter((e) => e.owner === 1 && e.kind === "turret")).toHaveLength(3);
    expect(s.entities.some((e) => e.kind === "turret" && e.constructing > 0)).toBe(false);
  });

  it("spawns a hold-the-line wave on the assault interval", () => {
    const s = makeFixture({ width: 28, height: 28, win: { kind: "holdTheLine", ticks: 10_000 } });
    addBuilding(s, 1, "constructionYard", 12, 12);
    const before = s.entities.filter((e) => e.owner === 1 && e.class === "unit").length;
    s.tick = missionDifficulty(0).enemyAssaultEvery;

    tickAi(s);

    const spawned = s.entities.filter((e) => e.owner === 1 && e.class === "unit" && (e.kind === "tank" || e.kind === "infantry"));
    expect(spawned.length).toBe(before + 1);
  });

  it("rebuilds a harvester when the last one is gone", () => {
    const s = makeFixture({ width: 28, height: 28, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 12, 12);
    addBuilding(s, 1, "power", 16, 12);
    addBuilding(s, 1, "factory", 12, 8);
    addBuilding(s, 1, "refinery", 8, 16);
    s.credits[1] = 5000;
    s.tick = 180;

    tickAi(s);

    const factory = s.entities.find((e) => e.owner === 1 && e.kind === "factory");
    expect(factory?.producing?.kind).toBe("harvester");
  });

  it("rebuilds a refinery when none remain", () => {
    const s = makeFixture({ width: 28, height: 28, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 12, 12);
    addBuilding(s, 1, "power", 16, 12);
    s.credits[1] = 5000;
    s.tick = 180;

    tickAi(s);

    expect(s.entities.some((e) => e.owner === 1 && e.kind === "refinery" && e.constructing > 0)).toBe(true);
  });
});
