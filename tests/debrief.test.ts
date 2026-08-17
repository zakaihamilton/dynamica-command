import { describe, expect, it } from "vitest";
import { formatMissionDuration, missionDebrief, shouldShowCommandSidebar } from "../lib/sim/debrief";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";

describe("mission debrief", () => {
  it("summarizes a completed primary objective and the battle record", () => {
    const state = makeFixture({ win: { kind: "harvestQuota", target: 900 } });
    state.result = "won";
    state.tick = 150;
    state.creditsEarned[0] = 900;
    state.unitsProduced[0] = 5;
    state.buildingsCompleted[0] = 2;
    state.losses.units = [1, 3];
    state.losses.buildings = [0, 2];
    addUnit(state, 0, "tank", 2, 2);
    addBuilding(state, 0, "power", 4, 4);
    addUnit(state, 1, "infantry", 7, 7);

    expect(missionDebrief(state)).toMatchObject({
      outcome: "Primary objective achieved.",
      objective: { headline: "Extract 900 credits from the field", progress: "Credits 900 / 900" },
      battle: { duration: "00:12", creditsGathered: 900, unitsTrained: 5, structuresCompleted: 2 },
      forces: {
        friendly: { unitsRemaining: 1, buildingsRemaining: 1, unitsLost: 1, buildingsLost: 0 },
        enemy: { unitsRemaining: 1, buildingsRemaining: 0, unitsLost: 3, buildingsLost: 2 },
      },
    });
  });

  it("explains defeat and preserves the incomplete objective progress", () => {
    const state = makeFixture({ win: { kind: "holdTheLine", ticks: 120 } });
    state.result = "lost";
    state.tick = 36;

    expect(missionDebrief(state)).toMatchObject({
      outcome: "Construction yard destroyed.",
      objective: { headline: "Hold this ground for 10 seconds", progress: "Hold 0:07" },
    });
  });

  it("formats elapsed time and hides the sidebar after a result", () => {
    expect(formatMissionDuration(12 * 125 + 7)).toBe("02:05");
    expect(shouldShowCommandSidebar("playing")).toBe(true);
    expect(shouldShowCommandSidebar("won")).toBe(false);
    expect(shouldShowCommandSidebar("lost")).toBe(false);
  });
});
