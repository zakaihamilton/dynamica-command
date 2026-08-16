import { describe, expect, it } from "vitest";
import { findPath } from "../lib/sim/pathfinding";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
import { issue, tick } from "../lib/sim/api";

describe("pathfinding", () => {
  it("routes around a blocking building", () => {
    const s = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "power", 3, 2);
    const path = findPath(s, { x: 2, y: 2 }, { x: 4, y: 2 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((p) => p.x === 3 && p.y === 2)).toBe(false);
    const last = path[path.length - 1]!;
    expect(last.x).toBe(4);
    expect(last.y).toBe(2);
  });

  it("moves a unit toward a move order", () => {
    const s = makeFixture({ width: 8, height: 8, win: { kind: "harvestQuota", target: 99999 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const u = addUnit(s, 0, "infantry", 1, 1);
    issue(s, { type: "move", unitIds: [u.id], x: 4, y: 1 });
    for (let i = 0; i < 160; i++) tick(s);
    expect(Math.round(u.x)).toBe(4);
    expect(Math.round(u.y)).toBe(1);
  });
});
