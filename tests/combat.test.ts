import { describe, expect, it } from "vitest";
import { issue } from "../lib/sim/api";
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

  it("does not let a turret fire until construction finishes", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const turret = addBuilding(s, 0, "turret", 4, 4, 12);
    const foe = addUnit(s, 1, "infantry", 6, 4);
    const hp = foe.hp;
    tickCombat(s);
    expect(foe.hp).toBe(hp);
    expect(turret.attackTarget).toBeUndefined();

    turret.constructing = 0;
    tickCombat(s);
    expect(foe.hp).toBeLessThan(hp);
    expect(turret.attackTarget).toBe(foe.id);
  });

  it("does not target a unit destroyed earlier in the same combat tick", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    addUnit(s, 0, "infantry", 4, 4);
    addUnit(s, 0, "infantry", 4, 5);
    const foe = addUnit(s, 1, "infantry", 5, 4);
    foe.hp = 1;

    const events = tickCombat(s);

    expect(events.filter((event) => event.type === "destroyed")).toHaveLength(1);
    expect(s.losses.units).toEqual([0, 1]);
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

  it("keeps a move order instead of chasing a spotted enemy", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 0, "infantry", 4, 4);
    addUnit(s, 1, "infantry", 8, 4);
    issue(s, { type: "move", unitIds: [attacker.id], x: 14, y: 4 });
    const dest = attacker.path[attacker.path.length - 1];
    tickCombat(s);
    expect(attacker.path.length).toBeGreaterThan(0);
    expect(attacker.path[attacker.path.length - 1]).toEqual(dest);
    expect(attacker.attackTarget).toBeUndefined();
    expect(attacker.idle).toBe(false);
  });

  it("keeps walking through a unit already in weapon range", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 0, "tank", 4, 4);
    const foe = addUnit(s, 1, "infantry", 5, 4);
    const hp = foe.hp;
    issue(s, { type: "move", unitIds: [attacker.id], x: 14, y: 4 });
    const dest = attacker.path[attacker.path.length - 1];
    tickCombat(s);
    expect(attacker.path[attacker.path.length - 1]).toEqual(dest);
    expect(foe.hp).toBeLessThan(hp);
  });

  it("keeps an attack order on the commanded target instead of switching", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const attacker = addUnit(s, 0, "tank", 4, 4);
    const power = addBuilding(s, 1, "power", 12, 4);
    addUnit(s, 1, "infantry", 5, 4);
    issue(s, { type: "attack", unitIds: [attacker.id], targetId: power.id });
    tickCombat(s);
    expect(attacker.attackTarget).toBe(power.id);
    expect(attacker.path.length).toBeGreaterThan(0);
    expect(attacker.idle).toBe(false);
  });

  it("lets an enemy raid stop to shoot a turret on the way to the yard", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const raider = addUnit(s, 1, "tank", 4, 4);
    const yard = addBuilding(s, 0, "constructionYard", 14, 4);
    const turret = addBuilding(s, 0, "turret", 6, 4);
    raider.attackTarget = yard.id;
    raider.idle = false;
    raider.path = [
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 7, y: 4 },
    ];
    const hp = turret.hp;
    tickCombat(s);
    expect(raider.attackTarget).toBe(turret.id);
    expect(raider.path).toEqual([]);
    expect(turret.hp).toBeLessThan(hp);
  });

  it("lets an enemy raid stop to shoot a combat unit on the way to a harvester", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const raider = addUnit(s, 1, "tank", 4, 4);
    const harvester = addUnit(s, 0, "harvester", 14, 4);
    const guard = addUnit(s, 0, "infantry", 5, 4);
    raider.attackTarget = harvester.id;
    raider.idle = false;
    raider.path = [
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 7, y: 4 },
    ];
    const hp = guard.hp;
    tickCombat(s);
    expect(raider.attackTarget).toBe(guard.id);
    expect(raider.path).toEqual([]);
    expect(guard.hp).toBeLessThan(hp);
  });

  it("lets a defending unit fire in range without chasing", () => {
    const close = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const defender = addUnit(close, 0, "infantry", 4, 4);
    defender.stance = "defensive";
    const near = addUnit(close, 1, "infantry", 5, 4);
    const hp = near.hp;
    tickCombat(close);
    expect(defender.attackTarget).toBe(near.id);
    expect(near.hp).toBeLessThan(hp);
    expect(defender.path).toEqual([]);

    const hunt = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const sentry = addUnit(hunt, 0, "infantry", 4, 4);
    sentry.stance = "defensive";
    const far = addUnit(hunt, 1, "tank", 10, 4);
    tickCombat(hunt);
    expect(sentry.attackTarget).toBeUndefined();
    expect(sentry.path).toEqual([]);
    expect(far.hp).toBe(far.maxHp);
  });

  it("does not auto-acquire when holding ground", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    const holder = addUnit(s, 0, "infantry", 4, 4);
    holder.stance = "hold";
    const foe = addUnit(s, 1, "infantry", 5, 4);
    const hp = foe.hp;
    tickCombat(s);
    expect(holder.attackTarget).toBeUndefined();
    expect(holder.path).toEqual([]);
    expect(foe.hp).toBe(hp);
  });
});

describe("combat alerts", () => {
  it("emits a contact alert when an enemy strikes a player harvester", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    addUnit(s, 0, "harvester", 5, 4);
    addUnit(s, 1, "infantry", 4, 4);

    expect(tickCombat(s)).toContainEqual({ type: "alert", kind: "contact", text: "Harvester under attack" });
  });

  it("emits a warning when an enemy strikes the player construction yard", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    addBuilding(s, 0, "constructionYard", 5, 4);
    addUnit(s, 1, "infantry", 4, 4);

    expect(tickCombat(s)).toContainEqual({
      type: "alert",
      kind: "warning",
      text: "Construction yard under attack",
    });
  });

  it("mutes a second harvester strike inside the mute window", () => {
    const s = makeFixture({ width: 16, height: 12, win: { kind: "annihilate" } });
    addUnit(s, 0, "harvester", 5, 4);
    const attacker = addUnit(s, 1, "infantry", 4, 4);

    expect(tickCombat(s).filter((event) => event.type === "alert")).toHaveLength(1);
    attacker.cooldown = 0;
    expect(tickCombat(s).filter((event) => event.type === "alert")).toHaveLength(0);
  });
});
