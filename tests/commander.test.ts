import { describe, expect, it } from "vitest";
import { createCampaign } from "../lib/gen/campaign";
import { BUILDING_STATS } from "../lib/catalog";
import { createMission, inspect, tick } from "../lib/sim/api";
import { CompetentCommander } from "../lib/sim/commander";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";

describe("competent commander", () => {
  it("queues a force-quota role and wins through the public command API", () => {
    const state = makeFixture({ width: 24, height: 24, win: { kind: "forceQuota", role: "tank", target: 1 } });
    addBuilding(state, 0, "constructionYard", 2, 2);
    addBuilding(state, 0, "power", 5, 2);
    addBuilding(state, 0, "factory", 2, 5);
    addBuilding(state, 1, "constructionYard", 18, 18);
    const commander = new CompetentCommander();

    for (let i = 0; i < BUILDING_STATS.factory.buildTicks + 30 && state.result === "playing"; i++) {
      tick(state, commander.plan(state));
    }

    expect(state.result).toBe("won");
    expect(state.unitsProducedByRole.tank).toBeGreaterThanOrEqual(1);
    expect(commander.getMetrics().commandsByType.produce).toBeGreaterThan(0);
  });

  it("keeps two identical missions and commander plans deterministic", () => {
    const a = createMission({ seed: 421, missionIndex: 0 });
    const b = createMission({ seed: 421, missionIndex: 0 });
    const commanderA = new CompetentCommander();
    const commanderB = new CompetentCommander();

    for (let i = 0; i < 720 && a.result === "playing"; i++) {
      const ordersA = commanderA.plan(a);
      const ordersB = commanderB.plan(b);
      expect(ordersA).toEqual(ordersB);
      tick(a, ordersA);
      tick(b, ordersB);
    }

    expect(inspect(a)).toEqual(inspect(b));
    expect(commanderA.getMetrics()).toEqual(commanderB.getMetrics());
  });

  it("gives the first offensive mission enough infrastructure to stage an assault", () => {
    const state = createMission({ seed: 0, missionIndex: 0 });
    const player = state.entities.filter((entity) => entity.owner === 0);

    expect(player.some((entity) => entity.class === "building" && entity.kind === "factory")).toBe(true);
    expect(player.some((entity) => entity.class === "building" && entity.kind === "turret")).toBe(true);
    expect(player.some((entity) => entity.class === "unit" && entity.kind === "antiArmor")).toBe(true);
    expect(player.some((entity) => entity.class === "unit" && entity.kind === "tank")).toBe(true);
  });

  it("issues useful macro orders across every generated mission kind", () => {
    const campaign = createCampaign(0);
    for (const mission of campaign.missions) {
      const state = createMission({ seed: 0, missionIndex: mission.index });
      const commander = new CompetentCommander();
      let rejections = 0;
      for (let i = 0; i < 240 && state.result === "playing"; i++) {
        const result = tick(state, commander.plan(state));
        rejections += result.events.filter((event) => event.type === "commandRejected").length;
      }
      expect(commander.getMetrics().commands).toBeGreaterThan(0);
      expect(rejections).toBe(0);
    }
  });

  it("moves a rescue force toward neutral scenario targets", () => {
    const state = makeFixture({ width: 20, height: 20, win: { kind: "rescue", targetCount: 1, ticks: 5000 } });
    state.missionIndex = 2;
    const yard = addBuilding(state, 0, "constructionYard", 2, 2);
    addBuilding(state, 0, "power", 5, 2);
    addBuilding(state, 0, "barracks", 2, 5);
    const infantry = addUnit(state, 0, "infantry", 4, 4);
    const target = addUnit(state, 0, "infantry", 8, 8);
    target.neutral = true;
    target.scenarioRole = "stranded";
    state.runtime = {
      kind: "rescue",
      phase: "active",
      targetIds: [target.id],
      zone: { x: yard.x, y: yard.y },
      rescued: 0,
      required: 1,
      secondary: [],
    };
    const commander = new CompetentCommander();
    const orders = commander.plan(state);

    expect(orders).toContainEqual(expect.objectContaining({ type: "move", unitIds: [infantry.id], x: target.x, y: target.y }));
  });

  it("keeps contacted extraction cargo on its return route", () => {
    const state = makeFixture({ width: 20, height: 20, win: { kind: "extraction", targetCount: 1, ticks: 5000 } });
    state.missionIndex = 2;
    const yard = addBuilding(state, 0, "constructionYard", 2, 2);
    addBuilding(state, 0, "power", 5, 2);
    const escort = addUnit(state, 0, "infantry", 6, 6);
    const cargo = addUnit(state, 0, "infantry", 10, 10);
    cargo.scenarioRole = "cargo";
    const targetId = cargo.id;
    state.runtime = {
      kind: "extraction",
      phase: "extraction",
      targetIds: [targetId],
      zone: { x: yard.x, y: yard.y },
      rescued: 0,
      required: 1,
      secondary: [],
    };

    const orders = new CompetentCommander().plan(state);
    const cargoOrders = orders.filter((order) => "unitIds" in order && order.unitIds.includes(cargo.id));

    expect(cargoOrders).toHaveLength(1);
    expect(cargoOrders[0]).toMatchObject({ type: "move", unitIds: [cargo.id], x: yard.x, y: yard.y });
    expect(orders).toContainEqual(expect.objectContaining({ type: "attackMove", unitIds: [escort.id], x: yard.x, y: yard.y }));
  });

  it("stages a small assault force instead of sending it into a marked base", () => {
    const state = makeFixture({ width: 24, height: 24, win: { kind: "sabotage", targetCount: 1, ticks: 5000 } });
    const yard = addBuilding(state, 0, "constructionYard", 2, 2);
    addBuilding(state, 0, "power", 5, 2);
    addBuilding(state, 0, "barracks", 2, 5);
    addUnit(state, 0, "infantry", 4, 4);
    addBuilding(state, 1, "constructionYard", 18, 18);
    const marked = addBuilding(state, 1, "objective", 14, 14, 0, true);
    state.win.targetIds = [marked.id];
    const commander = new CompetentCommander();

    const orders = commander.plan(state);

    expect(orders).toContainEqual(expect.objectContaining({ type: "move", x: yard.x, y: yard.y }));
    expect(orders.some((order) => order.type === "attack")).toBe(false);
  });

  it("commits a ready offensive force while leaving a home guard", () => {
    const state = makeFixture({ width: 24, height: 24, win: { kind: "sabotage", targetCount: 1, ticks: 5000 } });
    state.missionIndex = 2;
    const yard = addBuilding(state, 0, "constructionYard", 2, 2);
    addBuilding(state, 0, "power", 5, 2);
    const attackers = Array.from({ length: 8 }, (_, index) => addUnit(state, 0, index % 2 ? "antiArmor" : "infantry", 5 + (index % 4), 6 + Math.floor(index / 4)));
    addBuilding(state, 1, "constructionYard", 18, 18);
    const marked = addBuilding(state, 1, "objective", 14, 14, 0, true);
    state.win.targetIds = [marked.id];

    const orders = new CompetentCommander().plan(state);
    const attack = orders.find((order) => order.type === "attack" && order.targetId === marked.id);
    const guarded = orders.find((order) => order.type === "move" && order.x === yard.x && order.y === yard.y);

    expect(attack).toBeDefined();
    expect(attack && "unitIds" in attack ? attack.unitIds.length : 0).toBeGreaterThan(0);
    expect(attack && "unitIds" in attack ? attack.unitIds.length : 0).toBeLessThan(attackers.length);
    expect(guarded).toBeDefined();
  });
});
