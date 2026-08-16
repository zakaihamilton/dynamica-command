import { describe, expect, it } from "vitest";
import { createCampaign } from "../lib/gen/campaign";
import { WIN_KIND_ORDER } from "../lib/catalog";
import { MAX_MISSION_TICKS, MIN_MISSION_TICKS } from "../lib/gen/pacing";
import { createMission, inspect, tick } from "../lib/sim/api";

describe("determinism", () => {
  it("seed 0000 yields the same campaign twice", () => {
    const a = createCampaign(0);
    const b = createCampaign(0);
    expect(a).toEqual(b);
    expect(a.seed).toBe("0000");
    expect(a.missions).toHaveLength(8);
    const kinds = a.missions.map((m) => m.win.kind).sort();
    expect(kinds).toEqual([...WIN_KIND_ORDER].sort());
  });

  it("mission objectives are paced for 5–20 minute runs", () => {
    for (const seed of [0, 42, 421, 9999]) {
      const campaign = createCampaign(seed);
      for (const mission of campaign.missions) {
        if (mission.win.kind === "holdTheLine") {
          expect(mission.win.ticks).toBeGreaterThanOrEqual(MIN_MISSION_TICKS);
          expect(mission.win.ticks).toBeLessThanOrEqual(MAX_MISSION_TICKS);
        }
        if (mission.win.kind === "harvestQuota") {
          expect(mission.win.target).toBeGreaterThanOrEqual(4000);
        }
        if (mission.win.kind === "forceQuota") {
          expect(mission.win.target).toBeGreaterThanOrEqual(6);
        }
        if (mission.win.kind === "structureQuota") {
          expect(mission.win.target).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it("same seed and ticks produce identical inspect reports", () => {
    const a = createMission({ seed: 0, missionIndex: 0 });
    const b = createMission({ seed: 0, missionIndex: 0 });
    for (let i = 0; i < 24; i++) {
      tick(a);
      tick(b);
    }
    expect(inspect(a)).toEqual(inspect(b));
  });

  it("different seeds diverge", () => {
    const a = createCampaign(1);
    const b = createCampaign(2);
    expect(a.world.name + a.factions[0].name).not.toEqual(b.world.name + b.factions[0].name);
  });
});
