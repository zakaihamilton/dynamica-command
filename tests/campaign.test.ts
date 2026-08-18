import { describe, expect, it } from "vitest";
import { buyUpgrade, completeMission, freshCampaignProgress, readCampaignProgress, writeCampaignProgress } from "../lib/persist/campaign";
import { memoryStorage } from "../lib/persist/save";

describe("campaign progress", () => {
  it("persists per-seed progress and unlocks only the next mission", () => {
    const storage = memoryStorage();
    const progress = freshCampaignProgress(42);
    const first = completeMission(progress, 0, 3, 900);
    writeCampaignProgress(storage, first);
    const loaded = readCampaignProgress(storage, 42);
    expect(loaded.unlockedMission).toBe(1);
    expect(loaded.researchPoints).toBe(3);
    expect(readCampaignProgress(storage, 43).completedMissions).toEqual([]);
  });

  it("does not farm research points from replays and enforces branch prerequisites", () => {
    const progress = completeMission(freshCampaignProgress(7), 0, 2, 500);
    expect(completeMission(progress, 0, 3, 700).researchPoints).toBe(2);
    expect(buyUpgrade({ ...progress, researchPoints: 5 }, "arsenal-plating", 2)).toBeNull();
    const purchased = buyUpgrade({ ...progress, researchPoints: 5 }, "arsenal-barrels", 1);
    expect(purchased?.upgrades).toEqual(["arsenal-barrels"]);
    expect(buyUpgrade({ ...(purchased ?? progress), researchPoints: 4 }, "arsenal-plating", 2)?.upgrades).toEqual([
      "arsenal-barrels",
      "arsenal-plating",
    ]);
  });
});
