import { describe, expect, it } from "vitest";
import { findPath } from "../lib/sim/pathfinding";
import { addBuilding, addUnit, makeFixture, setHeight } from "../lib/sim/fixtures";
import { issue, tick } from "../lib/sim/api";
import { buildingAt, canPlaceBuilding, occupies } from "../lib/sim/world";

describe("pathfinding", () => {
  it("routes around a blocking building", () => {
    const s = makeFixture({ width: 10, height: 8, win: { kind: "annihilate" } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "power", 3, 2);
    const path = findPath(s, { x: 2, y: 2 }, { x: 6, y: 2 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((p) => p.x === 3 && p.y === 2)).toBe(false);
    expect(path.some((p) => p.x === 4 && p.y === 2)).toBe(false);
    const last = path[path.length - 1]!;
    expect(last.x).toBe(6);
    expect(last.y).toBe(2);
  });

  it("moves a unit toward a move order", () => {
    const s = makeFixture({ width: 10, height: 8, win: { kind: "harvestQuota", target: 99999 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const u = addUnit(s, 0, "infantry", 2, 2);
    issue(s, { type: "move", unitIds: [u.id], x: 6, y: 2 });
    for (let i = 0; i < 400; i++) tick(s);
    expect(Math.round(u.x)).toBe(6);
    expect(Math.round(u.y)).toBe(2);
  });

  it("cannot climb a cliff in one step", () => {
    const s = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" } });
    for (let y = 0; y < 8; y++) setHeight(s, 3, y, 3);
    const path = findPath(s, { x: 1, y: 2 }, { x: 5, y: 2 });
    expect(path.length).toBe(0);
  });

  it("uses a hill ramp to reach a mountain", () => {
    const s = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" } });
    setHeight(s, 3, 2, 3);
    setHeight(s, 3, 1, 2);
    const path = findPath(s, { x: 2, y: 2 }, { x: 3, y: 2 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((p) => p.x === 3 && p.y === 1)).toBe(true);
  });
});

describe("building footprints", () => {
  it("occupies every tile in the footprint", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    const b = addBuilding(s, 0, "factory", 4, 4);
    expect(occupies(b, 4, 4)).toBe(true);
    expect(occupies(b, 6, 5)).toBe(true);
    expect(occupies(b, 7, 4)).toBe(false);
    expect(buildingAt(s, 5, 5)?.id).toBe(b.id);
  });

  it("rejects placement that straddles a cliff", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    setHeight(s, 3, 2, 2);
    expect(canPlaceBuilding(s, "power", 2, 2)).toBe(false);
    expect(canPlaceBuilding(s, "power", 5, 5)).toBe(true);
  });
});
