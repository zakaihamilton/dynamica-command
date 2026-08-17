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
});
