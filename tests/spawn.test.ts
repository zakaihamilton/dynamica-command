import { describe, expect, it } from "vitest";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
import { tickProduction } from "../lib/sim/production";
import { trySpawnUnit } from "../lib/sim/world";

describe("unit spawning", () => {
  it("returns no unit instead of throwing when the deployment area is full", () => {
    const state = makeFixture({ width: 4, height: 4, win: { kind: "annihilate" } });
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) addUnit(state, 0, "infantry", x, y);
    }

    expect(trySpawnUnit(state, 0, "tank", 1, 1)).toBeUndefined();
  });

  it("keeps a completed production job pending until a tile opens", () => {
    const state = makeFixture({ width: 5, height: 5, win: { kind: "annihilate" } });
    const barracks = addBuilding(state, 0, "barracks", 1, 1);
    addBuilding(state, 0, "constructionYard", 0, 0);
    while (trySpawnUnit(state, 0, "infantry", barracks.x, barracks.y)) {
      // Fill every remaining walkable tile.
    }
    barracks.producing = { kind: "infantry", remaining: 0 };

    expect(() => tickProduction(state)).not.toThrow();
    expect(barracks.producing?.remaining).toBe(1);
    expect(state.unitsProduced[0]).toBe(0);
  });
});
