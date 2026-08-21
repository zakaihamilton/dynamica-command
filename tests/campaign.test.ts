import { describe, expect, it } from "vitest";
import { completeMission, freshCampaignProgress, readCampaignProgress, writeCampaignProgress } from "../lib/persist/campaign";
import { memoryStorage } from "../lib/persist/save";

describe("campaign progress", () => {
  it("persists per-seed progress and unlocks only the next mission", () => {
    const storage = memoryStorage();
    const progress = freshCampaignProgress(42);
    const first = completeMission(progress, 0, 3, 900);
    writeCampaignProgress(storage, first);
    const loaded = readCampaignProgress(storage, 42);
    expect(loaded.unlockedMission).toBe(1);
    expect(loaded.completedMissions).toEqual([0]);
    expect(readCampaignProgress(storage, 43).completedMissions).toEqual([]);
  });

  it("does not duplicate completions on replay and keeps the best medal and score", () => {
    const progress = completeMission(freshCampaignProgress(7), 0, 2, 500);
    const replay = completeMission(progress, 0, 3, 700);
    expect(replay.completedMissions).toEqual([0]);
    expect(replay.unlockedMission).toBe(1);
    expect(replay.medals["0"]).toBe(3);
    expect(replay.bestScores["0"]).toBe(700);
  });

  it("returns false when campaign progress cannot be written", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error("quota exceeded");
    };

    expect(writeCampaignProgress(storage, freshCampaignProgress(42))).toBe(false);
  });
});
