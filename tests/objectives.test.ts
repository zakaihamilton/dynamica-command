import { describe, expect, it } from "vitest";
import { tick } from "../lib/sim/api";
import { addBuilding, addUnit, makeFixture, setTile, TILE_RESOURCE } from "../lib/sim/fixtures";
import { inspect } from "../lib/sim/objectives";
import { createCampaign } from "../lib/gen/campaign";
import { missionObjectives } from "../lib/gen/story";

describe("win categories", () => {
  it("harvestQuota wins after a deposit", () => {
    const s = makeFixture({ win: { kind: "harvestQuota", target: 50 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "refinery", 3, 2);
    const h = addUnit(s, 0, "harvester", 2, 2);
    h.carry = 100;
    setTile(s, 5, 5, TILE_RESOURCE, 200);
    tick(s);
    expect(s.creditsEarned[0]).toBeGreaterThanOrEqual(50);
    expect(inspect(s).result).toBe("won");
  });

  it("forceQuota wins when a unit finishes production", () => {
    const s = makeFixture({ win: { kind: "forceQuota", target: 1 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const b = addBuilding(s, 0, "barracks", 2, 2);
    b.producing = { kind: "infantry", remaining: 1 };
    tick(s);
    expect(s.unitsProduced[0]).toBe(1);
    expect(inspect(s).result).toBe("won");
  });

  it("structureQuota wins when a building completes", () => {
    const s = makeFixture({ win: { kind: "structureQuota", target: 1 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    addBuilding(s, 0, "turret", 2, 2, 1);
    tick(s);
    expect(s.buildingsCompleted[0]).toBe(1);
    expect(inspect(s).result).toBe("won");
  });

  it("destroyMarked wins when tagged buildings die", () => {
    const s = makeFixture({ win: { kind: "destroyMarked", targetIds: [] } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const t = addBuilding(s, 1, "objective", 5, 4, 0, true);
    t.hp = 5;
    s.win.targetIds = [t.id];
    const tank = addUnit(s, 0, "tank", 4, 6);
    tank.attackTarget = t.id;
    tick(s);
    expect(inspect(s).result).toBe("won");
  });

  it("razeAll wins when no enemy buildings remain", () => {
    const s = makeFixture({ win: { kind: "razeAll" } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const b = addBuilding(s, 1, "power", 5, 5);
    b.hp = 5;
    const tank = addUnit(s, 0, "tank", 4, 5);
    tank.attackTarget = b.id;
    tick(s);
    expect(inspect(s).result).toBe("won");
  });

  it("decapitate wins when the enemy yard falls", () => {
    const s = makeFixture({ win: { kind: "decapitate" } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const cy = addBuilding(s, 1, "constructionYard", 6, 6);
    cy.hp = 5;
    const tank = addUnit(s, 0, "tank", 5, 8);
    tank.attackTarget = cy.id;
    tick(s);
    expect(inspect(s).result).toBe("won");
  });

  it("annihilate wins when no enemies remain", () => {
    const s = makeFixture({ win: { kind: "annihilate" } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    const u = addUnit(s, 1, "infantry", 4, 4);
    u.hp = 5;
    const tank = addUnit(s, 0, "tank", 4, 5);
    tank.attackTarget = u.id;
    tick(s);
    expect(inspect(s).result).toBe("won");
  });

  it("holdTheLine wins after the timer", () => {
    const s = makeFixture({ win: { kind: "holdTheLine", ticks: 2 } });
    addBuilding(s, 0, "constructionYard", 0, 0);
    tick(s);
    expect(inspect(s).result).toBe("playing");
    tick(s);
    expect(inspect(s).result).toBe("won");
  });

  it("losing the construction yard fails the mission", () => {
    const s = makeFixture({ win: { kind: "holdTheLine", ticks: 100 } });
    const cy = addBuilding(s, 0, "constructionYard", 1, 1);
    cy.hp = 0;
    tick(s);
    expect(inspect(s).result).toBe("lost");
  });
});

describe("mission briefing objectives", () => {
  it("derives real objectives from the campaign win condition and standing orders", () => {
    const campaign = createCampaign(421);
    for (const mission of campaign.missions) {
      const objectives = missionObjectives(mission, campaign);
      expect(objectives.length).toBeGreaterThanOrEqual(2);
      expect(objectives.some((item) => /construction yard/i.test(item.text))).toBe(true);
      expect(objectives[0]!.text.toLowerCase()).not.toContain("lorem");
      if (mission.win.kind === "harvestQuota") {
        expect(objectives[0]!.text).toContain(String(mission.win.target));
      }
      if (mission.win.kind === "forceQuota" && mission.win.role) {
        expect(objectives[0]!.text.toLowerCase()).toContain(mission.win.role === "antiArmor" ? "anti-armor" : mission.win.role);
      }
    }
  });
});

describe("mission briefing dialogue", () => {
  it("attributes each transmission to a distinct speaker", () => {
    const campaign = createCampaign(421);
    for (const mission of campaign.missions) {
      const speakers = mission.briefing.map((line) => line.speaker);
      expect(new Set(speakers).size).toBe(speakers.length);
      expect(speakers).toContain("advisor");
      expect(speakers).toContain("commander");
      expect(speakers).toContain("enemyLeader");
      for (const line of mission.briefing) {
        expect(line.text.length).toBeGreaterThan(12);
        expect(line.text).not.toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+:/);
      }
      const joined = mission.briefing.map((line) => line.text).join(" ");
      expect(joined).not.toContain(mission.name);
      expect(joined.toLowerCase()).toContain("construction yard");
    }
  });
});
