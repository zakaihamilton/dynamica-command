import { describe, expect, it } from "vitest";
import { issue, tick } from "../lib/sim/api";
import { addBuilding, addUnit, makeFixture, setTile, TILE_RESOURCE } from "../lib/sim/fixtures";
import { inspect } from "../lib/sim/objectives";
import { canPlaceBuilding } from "../lib/sim/world";
import type { SimState } from "../lib/types";

const TICK_CAP = 400;

function playUntilWon(state: SimState): void {
  for (let i = 0; i < TICK_CAP && inspect(state).result !== "won"; i++) tick(state);
  expect(inspect(state).result).toBe("won");
}

describe("scripted mission loops", () => {
  it("wins a harvestQuota by issuing harvest and ticking", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "harvestQuota", target: 80 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "refinery", 3, 2);
    const harvester = addUnit(s, 0, "harvester", 7, 4);
    setTile(s, 7, 4, TILE_RESOURCE, 250);

    expect(issue(s, { type: "harvest", unitIds: [harvester.id], x: 7, y: 4 })).toEqual([]);
    playUntilWon(s);
  });

  it("wins a forceQuota by issuing produce and ticking", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "forceQuota", target: 1 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const barracks = addBuilding(s, 0, "barracks", 3, 0);

    expect(issue(s, { type: "produce", fromId: barracks.id, unit: "infantry" })).toEqual([]);
    playUntilWon(s);
  });

  it("wins a structureQuota by issuing a turret build and ticking", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "structureQuota", target: 1 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    expect(canPlaceBuilding(s, "turret", 2, 0)).toBe(true);

    expect(issue(s, { type: "build", building: "turret", x: 2, y: 0 })).toEqual([]);
    playUntilWon(s);
  });
});
