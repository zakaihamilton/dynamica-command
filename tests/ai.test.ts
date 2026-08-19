import { describe, expect, it } from "vitest";
import { tickAi } from "../lib/sim/ai";
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
    s.tick = 720;

    tickAi(s);

    expect(s.aiState).toBe("assault");
    expect(guard.attackTarget).toBeUndefined();
    expect(guard.path).toEqual([]);
    expect([raider.attackTarget, extra.attackTarget]).toEqual([harvester.id, harvester.id]);
    expect(raider.path.length).toBeGreaterThan(0);
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
});
