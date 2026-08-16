import { describe, expect, it } from "vitest";
import { findPath } from "../lib/sim/pathfinding";
import { TILE_BLOCKED, addBuilding, addUnit, makeFixture, setHeight, setTile } from "../lib/sim/fixtures";
import { issue, tick } from "../lib/sim/api";
import { buildingAt, canPlaceBuilding, occupies, unitAt } from "../lib/sim/world";
import { tickProduction } from "../lib/sim/production";
import { MAX_PRODUCTION_QUEUE, UNIT_STATS } from "../lib/catalog";

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

  it("keeps two units from entering the same square", () => {
    const s = makeFixture({ width: 10, height: 8, win: { kind: "harvestQuota", target: 99999 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const a = addUnit(s, 0, "infantry", 2, 2);
    const b = addUnit(s, 0, "infantry", 4, 2);
    issue(s, { type: "move", unitIds: [a.id], x: 3, y: 2 });
    issue(s, { type: "move", unitIds: [b.id], x: 3, y: 2 });
    for (let i = 0; i < 400; i++) tick(s);
    expect(unitAt(s, 3, 2)?.id).toBe(a.id);
    expect(Math.round(b.x) === 3 && Math.round(b.y) === 2).toBe(false);
  });

  it("relocates a spawned unit when its requested square is occupied", () => {
    const s = makeFixture({ width: 10, height: 8, win: { kind: "annihilate" } });
    const first = addUnit(s, 0, "infantry", 2, 2);
    const second = addUnit(s, 0, "tank", 2, 2);
    expect(unitAt(s, 2, 2)?.id).toBe(first.id);
    expect(Math.round(second.x) === 2 && Math.round(second.y) === 2).toBe(false);
  });

  it("spawns barracks units from the front edge first", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    addBuilding(s, 0, "power", 0, 0);
    const barracks = addBuilding(s, 0, "barracks", 4, 4);
    barracks.producing = { kind: "infantry", remaining: 1 };
    tickProduction(s);
    const unit = s.entities.find((e) => e.class === "unit");
    expect(unit && Math.round(unit.x)).toBe(5);
    expect(unit && Math.round(unit.y)).toBe(6);
  });

  it("spawns factory units from the camera-facing edge", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    addBuilding(s, 0, "power", 0, 0);
    const factory = addBuilding(s, 0, "factory", 4, 4);
    factory.producing = { kind: "tank", remaining: 1 };
    tickProduction(s);
    const unit = s.entities.find((e) => e.class === "unit");
    expect(unit && Math.round(unit.x)).toBe(5);
    expect(unit && Math.round(unit.y)).toBe(6);
  });

  it("falls back behind a barracks when the front is blocked", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    addBuilding(s, 0, "power", 0, 0);
    const barracks = addBuilding(s, 0, "barracks", 4, 4);
    for (let x = 3; x <= 7; x++) {
      setTile(s, x, 6, TILE_BLOCKED);
      setTile(s, 6, x - 2, TILE_BLOCKED);
    }
    barracks.producing = { kind: "infantry", remaining: 1 };
    tickProduction(s);
    const unit = s.entities.find((e) => e.class === "unit");
    expect(unit).toBeTruthy();
    expect(Math.round(unit!.y)).toBeLessThan(4);
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

  it("routes around blocked terrain and rejects construction on it", () => {
    const s = makeFixture({ width: 10, height: 8, win: { kind: "annihilate" } });
    for (let y = 1; y < 7; y++) setTile(s, 4, y, TILE_BLOCKED);
    const path = findPath(s, { x: 2, y: 3 }, { x: 7, y: 3 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((p) => p.x === 4 && p.y >= 1 && p.y < 7)).toBe(false);
    expect(canPlaceBuilding(s, "power", 4, 2)).toBe(false);
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

describe("production queue", () => {
  it("queues up to 10 units and rejects the 11th", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    s.credits[0] = 50_000;
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "power", 2, 0);
    const barracks = addBuilding(s, 0, "barracks", 6, 4);
    for (let i = 0; i < MAX_PRODUCTION_QUEUE; i++) {
      const events = issue(s, { type: "produce", fromId: barracks.id, unit: "infantry" });
      expect(events).toEqual([]);
    }
    expect(barracks.producing?.kind).toBe("infantry");
    expect(barracks.queue).toHaveLength(MAX_PRODUCTION_QUEUE - 1);
    const creditsAfterTen = s.credits[0];
    issue(s, { type: "produce", fromId: barracks.id, unit: "infantry" });
    expect(barracks.queue).toHaveLength(MAX_PRODUCTION_QUEUE - 1);
    expect(s.credits[0]).toBe(creditsAfterTen);
  });

  it("starts the next queued unit after the current one finishes", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    s.credits[0] = 50_000;
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "power", 2, 0);
    const barracks = addBuilding(s, 0, "barracks", 6, 4);
    issue(s, { type: "produce", fromId: barracks.id, unit: "infantry" });
    issue(s, { type: "produce", fromId: barracks.id, unit: "antiArmor" });
    barracks.producing = { kind: "infantry", remaining: 1 };
    tickProduction(s);
    expect(s.entities.some((e) => e.class === "unit" && e.kind === "infantry")).toBe(true);
    expect(barracks.producing?.kind).toBe("antiArmor");
    expect(barracks.producing?.remaining).toBe(UNIT_STATS.antiArmor.buildTicks);
    expect(barracks.queue).toHaveLength(0);
  });
});
