import { describe, expect, it } from "vitest";
import { findPath } from "../lib/sim/pathfinding";
import { TILE_BLOCKED, TILE_RESOURCE, TILE_WATER, addBuilding, addUnit, makeFixture, setHeight, setTile } from "../lib/sim/fixtures";
import { issue, tick } from "../lib/sim/api";
import { BUILDING_PLACEMENT_RADIUS, buildingAt, canPlaceBuilding, occupies, powerBreakdown, powerFor, terrainAccess, unitAt } from "../lib/sim/world";
import { tickProduction } from "../lib/sim/production";
import { BUILDING_STATS, MAX_PRODUCTION_QUEUE, UNIT_STATS } from "../lib/catalog";

describe("pathfinding", () => {
  it("shares explicit terrain access rules between movement and construction", () => {
    const s = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" } });
    setTile(s, 2, 2, TILE_WATER);
    setTile(s, 3, 2, TILE_BLOCKED);
    setTile(s, 4, 2, TILE_RESOURCE, 500);
    expect(terrainAccess(s, 2, 2)).toMatchObject({ traversable: false, buildable: false, label: "Water" });
    expect(terrainAccess(s, 3, 2)).toMatchObject({ traversable: false, buildable: false, label: "Hard blocker" });
    expect(terrainAccess(s, 4, 2)).toMatchObject({ traversable: true, buildable: true, label: "Ore field" });
  });

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

  it("reroutes a combat unit when another unit steps into its existing route", () => {
    const s = makeFixture({ width: 10, height: 8, win: { kind: "harvestQuota", target: 99999 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const infantry = addUnit(s, 0, "infantry", 2, 3);
    issue(s, { type: "move", unitIds: [infantry.id], x: 6, y: 3 });
    const blocker = addUnit(s, 0, "infantry", 3, 3);

    tick(s);

    expect(infantry.blockedTicks).toBeGreaterThanOrEqual(1);
    expect(infantry.path[0]).not.toEqual({ x: Math.round(blocker.x), y: Math.round(blocker.y) });
    for (let i = 0; i < 500; i++) tick(s);
    expect(Math.round(infantry.x)).toBe(6);
    expect(Math.round(infantry.y)).toBe(3);
  });

  it("reroutes an enemy combat unit around another enemy unit", () => {
    const s = makeFixture({ width: 10, height: 10, win: { kind: "harvestQuota", target: 99999 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const enemy = addUnit(s, 1, "infantry", 2, 6);
    enemy.stance = "hold";
    enemy.path = [
      { x: 3, y: 6 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ];
    const blocker = addUnit(s, 1, "tank", 3, 6);
    blocker.stance = "hold";

    tick(s);

    expect(enemy.blockedTicks).toBeGreaterThanOrEqual(1);
    expect(enemy.path[0]).not.toEqual({ x: Math.round(blocker.x), y: Math.round(blocker.y) });
    for (let i = 0; i < 500; i++) tick(s);
    expect(Math.round(enemy.x)).toBe(6);
    expect(Math.round(enemy.y)).toBe(6);
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
    addBuilding(s, 0, "constructionYard", 0, 0);
    setHeight(s, 3, 2, 2);
    expect(canPlaceBuilding(s, "power", 2, 2)).toBe(false);
    expect(canPlaceBuilding(s, "power", 5, 5)).toBe(true);
  });

  it("requires every new building, including turrets, to join the owner building network", () => {
    const s = makeFixture({ width: 24, height: 24, win: { kind: "annihilate" } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 1, "constructionYard", 16, 16);

    expect(canPlaceBuilding(s, "power", 3, 0)).toBe(true);
    expect(canPlaceBuilding(s, "turret", 8, 0)).toBe(true);
    expect(canPlaceBuilding(s, "turret", 11, 0)).toBe(false);
    expect(canPlaceBuilding(s, "turret", 16, 16)).toBe(false);
    expect(issue(s, { type: "build", building: "turret", x: 11, y: 0 })).toEqual([
      { type: "commandRejected", reason: "invalid placement" },
    ]);
    expect(BUILDING_PLACEMENT_RADIUS).toBe(8);
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

describe("cancel production and construction", () => {
  it("refunds a queued unit before cancelling the unit in progress", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    s.credits[0] = 50_000;
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "power", 2, 0);
    const barracks = addBuilding(s, 0, "barracks", 6, 4);
    issue(s, { type: "produce", fromId: barracks.id, unit: "infantry" });
    issue(s, { type: "produce", fromId: barracks.id, unit: "infantry" });
    issue(s, { type: "produce", fromId: barracks.id, unit: "antiArmor" });
    const afterQueue = s.credits[0];

    issue(s, { type: "cancelProduce", unit: "infantry" });
    expect(barracks.producing?.kind).toBe("infantry");
    expect(barracks.queue).toEqual(["antiArmor"]);
    expect(s.credits[0]).toBe(afterQueue + UNIT_STATS.infantry.cost);

    issue(s, { type: "cancelProduce", unit: "infantry" });
    expect(barracks.producing?.kind).toBe("antiArmor");
    expect(barracks.producing?.remaining).toBe(UNIT_STATS.antiArmor.buildTicks);
    expect(barracks.queue).toHaveLength(0);
    expect(s.credits[0]).toBe(afterQueue + UNIT_STATS.infantry.cost * 2);
  });

  it("cancels an unfinished building, refunds its cost, and frees the tiles", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    s.credits[0] = 50_000;
    addBuilding(s, 0, "constructionYard", 0, 0);
    issue(s, { type: "build", building: "power", x: 6, y: 4 });
    const power = s.entities.find((e) => e.kind === "power");
    expect(power?.constructing).toBeGreaterThan(0);
    expect(buildingAt(s, 6, 4)?.id).toBe(power?.id);
    const afterBuild = s.credits[0];

    issue(s, { type: "cancelBuild", building: "power" });
    expect(power?.hp).toBe(0);
    expect(power?.constructing).toBe(0);
    expect(buildingAt(s, 6, 4)).toBeUndefined();
    expect(s.credits[0]).toBe(afterBuild + BUILDING_STATS.power.cost);
    expect(canPlaceBuilding(s, "power", 6, 4)).toBe(true);
  });

  it("cancels the most recently placed building of that kind", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    s.credits[0] = 50_000;
    addBuilding(s, 0, "constructionYard", 0, 0);
    issue(s, { type: "build", building: "turret", x: 6, y: 4 });
    issue(s, { type: "build", building: "turret", x: 8, y: 4 });
    const first = s.entities.find((e) => e.kind === "turret" && e.x === 6);
    const second = s.entities.find((e) => e.kind === "turret" && e.x === 8);
    expect(first?.constructing).toBeGreaterThan(0);
    expect(second?.constructing).toBeGreaterThan(0);

    issue(s, { type: "cancelBuild", building: "turret" });
    expect(second?.hp).toBe(0);
    expect(first?.hp).toBeGreaterThan(0);
    expect(first?.constructing).toBeGreaterThan(0);
  });
});

describe("power grid", () => {
  it("splits generated power from drain", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "power", 3, 0);
    addBuilding(s, 0, "barracks", 6, 0);
    const grid = powerBreakdown(s, 0);
    expect(grid.produced).toBe(BUILDING_STATS.constructionYard.power + BUILDING_STATS.power.power);
    expect(grid.used).toBe(-BUILDING_STATS.barracks.power);
    expect(grid.surplus).toBe(grid.produced - grid.used);
    expect(powerFor(s, 0)).toBe(grid.surplus);
  });
});
