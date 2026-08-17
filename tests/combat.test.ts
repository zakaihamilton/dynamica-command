import { describe, expect, it } from "vitest";
import { tickCombat } from "../lib/sim/combat";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";

describe("combat targeting", () => {
  it("prefers a combat unit over a closer passive building", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 0, "infantry", 4, 4);
    const power = addBuilding(s, 1, "power", 5, 4);
    const foe = addUnit(s, 1, "infantry", 8, 4);
    tickCombat(s);
    expect(attacker.attackTarget).toBe(foe.id);
    expect(attacker.attackTarget).not.toBe(power.id);
  });

  it("prefers a turret over a closer passive building", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 0, "tank", 4, 4);
    addBuilding(s, 1, "refinery", 5, 4);
    const turret = addBuilding(s, 1, "turret", 9, 4);
    tickCombat(s);
    expect(attacker.attackTarget).toBe(turret.id);
  });

  it("falls back to a passive building when no threats are in reach", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 0, "infantry", 4, 4);
    const power = addBuilding(s, 1, "power", 5, 4);
    tickCombat(s);
    expect(attacker.attackTarget).toBe(power.id);
  });

  it("switches from a passive building to an attacking unit", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 0, "tank", 4, 4);
    const power = addBuilding(s, 1, "power", 5, 4);
    attacker.attackTarget = power.id;
    const foe = addUnit(s, 1, "antiArmor", 7, 4);
    tickCombat(s);
    expect(attacker.attackTarget).toBe(foe.id);
  });

  it("does not treat harvesters as attacking units", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 0, "infantry", 4, 4);
    addUnit(s, 1, "harvester", 5, 4);
    const foe = addUnit(s, 1, "tank", 8, 4);
    tickCombat(s);
    expect(attacker.attackTarget).toBe(foe.id);
  });

  it("stops walking to shoot a unit in weapon range", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 1, "tank", 4, 4);
    const yard = addBuilding(s, 0, "constructionYard", 14, 4);
    attacker.attackTarget = yard.id;
    attacker.path = [
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 7, y: 4 },
    ];
    const foe = addUnit(s, 0, "infantry", 5, 4);
    const hp = foe.hp;
    tickCombat(s);
    expect(attacker.attackTarget).toBe(foe.id);
    expect(attacker.path).toEqual([]);
    expect(foe.hp).toBeLessThan(hp);
  });

  it("records each destroyed unit and structure as one loss for its owner", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const tank = addUnit(s, 0, "tank", 4, 4);
    const unit = addUnit(s, 1, "infantry", 5, 4);
    unit.hp = 1;
    tickCombat(s);
    expect(s.losses.units).toEqual([0, 1]);
    tickCombat(s);
    expect(s.losses.units).toEqual([0, 1]);

    tank.cooldown = 0;
    const structure = addBuilding(s, 1, "power", 5, 4);
    structure.hp = 1;
    tickCombat(s);
    expect(s.losses.buildings).toEqual([0, 1]);
  });
});
