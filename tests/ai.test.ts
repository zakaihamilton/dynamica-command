import { describe, expect, it } from "vitest";
import { ASSAULT_DURATION, RETREAT_MAX_TICKS, RETREAT_RECOVER_HEALTH, tickAi } from "../lib/sim/ai";
import { createMission, tick } from "../lib/sim/api";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
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

  it("leaves assault between pulse windows and pulls raiders home", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    const yard = addBuilding(s, 1, "constructionYard", 2, 2);
    addBuilding(s, 0, "constructionYard", 18, 18);
    addUnit(s, 1, "infantry", 5, 2);
    const raider = addUnit(s, 1, "tank", 9, 9);
    addUnit(s, 0, "harvester", 16, 16);
    s.tick = 720 + ASSAULT_DURATION;

    tickAi(s);

    expect(s.aiState).not.toBe("assault");
    expect(raider.attackTarget).toBeUndefined();
    const end = raider.path.at(-1);
    if (end) expect(Math.hypot(end.x - yard.x, end.y - yard.y)).toBeLessThan(6);
  });

  it("places a second refinery and harvester once the base is powered", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 12, 12);
    addBuilding(s, 1, "power", 9, 12);
    addBuilding(s, 1, "power", 15, 12);
    addBuilding(s, 1, "barracks", 8, 9);
    addBuilding(s, 1, "factory", 12, 9);
    addBuilding(s, 1, "refinery", 12, 15);
    const barracks = s.entities.find((e) => e.kind === "barracks")!;
    const factory = s.entities.find((e) => e.kind === "factory")!;
    barracks.producing = { kind: "infantry", remaining: 20 };
    factory.producing = { kind: "tank", remaining: 20 };
    s.credits[1] = 5000;
    s.tick = 180;
    expect(powerFor(s, 1)).toBeGreaterThanOrEqual(20);

    tickAi(s);

    expect(s.entities.filter((e) => e.owner === 1 && e.kind === "refinery")).toHaveLength(2);
    expect(s.entities.some((e) => e.owner === 1 && e.kind === "harvester")).toBe(true);
  });

  it("defends a threatened harvester away from the yard", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 2, 2);
    const harvester = addUnit(s, 1, "harvester", 18, 18);
    const guard = addUnit(s, 1, "infantry", 16, 16);
    const foe = addUnit(s, 0, "tank", 17, 18);
    s.credits[1] = 5000;

    tickAi(s);

    expect(s.aiState).toBe("defense");
    expect(guard.attackTarget).toBe(foe.id);
    expect(harvester.attackTarget).toBeUndefined();
  });

  it("queues anti-armor when the player fields more tanks than infantry", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 1, "constructionYard", 12, 12);
    addBuilding(s, 1, "power", 9, 12);
    const barracks = addBuilding(s, 1, "barracks", 8, 9);
    addUnit(s, 0, "tank", 2, 2);
    addUnit(s, 0, "tank", 3, 2);
    addUnit(s, 0, "infantry", 4, 2);
    s.credits[1] = 5000;
    s.tick = 180;

    tickAi(s);

    expect(barracks.producing?.kind).toBe("antiArmor");
  });
});
