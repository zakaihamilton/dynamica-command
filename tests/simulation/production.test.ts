import { describe, expect, it } from "vitest";
import { UNIT_STATS } from "../../lib/catalog";
import { addBuilding, makeFixture } from "../../lib/sim/fixtures";
import { issue } from "../../lib/sim/orders";
import { tickProduction } from "../../lib/sim/production";
import { powerFor } from "../../lib/sim/world";

function readyBase(width = 24, height = 16) {
  const s = makeFixture({ width, height, win: { kind: "annihilate" } });
  s.credits[0] = 50_000;
  addBuilding(s, 0, "constructionYard", 0, 0);
  addBuilding(s, 0, "power", 3, 0);
  return s;
}

describe("producer speed", () => {
  it("finishes a unit twice as fast with a second barracks", () => {
    const one = readyBase();
    const barracks = addBuilding(one, 0, "barracks", 6, 4);
    issue(one, { type: "produce", fromId: barracks.id, unit: "infantry" });
    const two = readyBase();
    const first = addBuilding(two, 0, "barracks", 6, 4);
    addBuilding(two, 0, "barracks", 9, 4);
    issue(two, { type: "produce", fromId: first.id, unit: "infantry" });

    const half = UNIT_STATS.infantry.buildTicks / 2;
    for (let i = 0; i < half; i++) {
      tickProduction(one);
      tickProduction(two);
    }

    expect(barracks.producing?.remaining).toBe(half);
    expect(two.entities.some((e) => e.class === "unit" && e.kind === "infantry")).toBe(true);
    expect(first.producing).toBeUndefined();
  });

  it("speeds tanks and harvesters with extra war factories", () => {
    const s = readyBase();
    const factory = addBuilding(s, 0, "factory", 6, 4);
    addBuilding(s, 0, "factory", 10, 4);
    issue(s, { type: "produce", fromId: factory.id, unit: "tank" });
    tickProduction(s);
    expect(factory.producing?.remaining).toBe(UNIT_STATS.tank.buildTicks - 2);
  });

  it("splits extra capacity when several producers are busy", () => {
    const s = readyBase();
    const a = addBuilding(s, 0, "barracks", 6, 4);
    const b = addBuilding(s, 0, "barracks", 9, 4);
    issue(s, { type: "produce", fromId: a.id, unit: "infantry" });
    issue(s, { type: "produce", fromId: b.id, unit: "infantry" });
    tickProduction(s);
    expect(a.producing?.remaining).toBe(UNIT_STATS.infantry.buildTicks - 1);
    expect(b.producing?.remaining).toBe(UNIT_STATS.infantry.buildTicks - 1);
  });

  it("ignores unfinished barracks when counting speed", () => {
    const s = readyBase();
    const barracks = addBuilding(s, 0, "barracks", 6, 4);
    addBuilding(s, 0, "barracks", 9, 4, 40);
    issue(s, { type: "produce", fromId: barracks.id, unit: "infantry" });
    tickProduction(s);
    expect(barracks.producing?.remaining).toBe(UNIT_STATS.infantry.buildTicks - 1);
  });
});

describe("power shortage events", () => {
  it("emits once when player surplus crosses below zero", () => {
    const s = readyBase();
    addBuilding(s, 0, "factory", 6, 4);
    addBuilding(s, 0, "factory", 10, 4);
    addBuilding(s, 0, "barracks", 6, 8);
    addBuilding(s, 0, "refinery", 10, 8);
    addBuilding(s, 0, "turret", 0, 6);
    addBuilding(s, 0, "turret", 0, 8);
    addBuilding(s, 0, "turret", 0, 10);
    expect(powerFor(s, 0)).toBeLessThan(0);

    expect(tickProduction(s)).toContainEqual({ type: "powerShortage", owner: 0 });
    expect(tickProduction(s).filter((event) => event.type === "powerShortage")).toHaveLength(0);
  });
});
