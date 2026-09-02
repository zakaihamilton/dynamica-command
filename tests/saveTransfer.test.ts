import { describe, expect, it } from "vitest";
import { completeMission, freshCampaignProgress, mergeCampaignProgress, readCampaignProgress, writeCampaignProgress } from "../lib/persist/campaign";
import {
  memoryStorage,
  parseSaveExport,
  SAVE_EXPORT_FORMAT,
  SAVE_TRANSFER_KEY,
  hasSaveForSeed,
  readSave,
  serializeSaveExport,
  writeSave,
} from "../lib/persist/save";
import { importSaveAtomically } from "../lib/persist/saveTransfer";
import { makeFixture } from "../lib/sim/fixtures";

describe("portable save transfer", () => {
  it("serializes and validates a versioned state plus campaign envelope", () => {
    const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    const campaign = completeMission(freshCampaignProgress(421), 0, 2, 900);
    const parsed = parseSaveExport(serializeSaveExport(state, campaign, 123));

    expect(parsed.state.seed).toBe(421);
    expect(parsed.campaign.completedMissions).toEqual([0]);
    expect(JSON.parse(serializeSaveExport(state, campaign, 123))).toMatchObject({
      format: SAVE_EXPORT_FORMAT,
      version: 1,
      contentVersion: 1,
      exportedAt: 123,
    });
  });

  it("rejects malformed and seed-mismatched files before storage writes", () => {
    const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    const campaign = freshCampaignProgress(422);
    expect(() => parseSaveExport(serializeSaveExport(state, campaign))).toThrow("seeds");
    expect(() => parseSaveExport(JSON.stringify({ format: SAVE_EXPORT_FORMAT, version: 99 }))).toThrow("This save file isn't compatible.");

    const malformed = JSON.parse(serializeSaveExport(state, freshCampaignProgress(421))) as { state: { entities: unknown[] } };
    malformed.state.entities = [{ hp: 1 }];
    expect(() => parseSaveExport(JSON.stringify(malformed))).toThrow("This save could not be read.");
  });

  it("merges campaign progress by the higher unlock, medals, scores, and union of completions", () => {
    const local = completeMission(completeMission(freshCampaignProgress(421), 0, 1, 100), 1, 2, 400);
    const imported = completeMission(completeMission(freshCampaignProgress(421), 0, 3, 250), 3, 1, 900);
    const merged = mergeCampaignProgress(local, imported);

    expect(merged.unlockedMission).toBe(4);
    expect(merged.completedMissions).toEqual([0, 1, 3]);
    expect(merged.medals).toEqual({ "0": 3, "1": 2, "3": 1 });
    expect(merged.bestScores).toEqual({ "0": 250, "1": 400, "3": 900 });
  });

  it("treats unreadable local save keys as collisions", () => {
    const storage = memoryStorage({ "dynamica-command:save:0421": "not-json" });
    expect(hasSaveForSeed(storage, 421)).toBe(true);
  });

  it("keeps the committed transfer authoritative when a legacy mirror fails", () => {
    const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    const oldState = makeFixture({ seed: 421, win: { kind: "harvestQuota", target: 10 } });
    const storage = memoryStorage();
    writeSave(storage, oldState);
    writeCampaignProgress(storage, freshCampaignProgress(421));
    const previousMission = storage.getItem("dynamica-command:save:0421");
    const previousCampaign = storage.getItem("dynamica-command:campaign:0421");
    const originalSet = storage.setItem;
    let writes = 0;
    storage.setItem = (key, value) => {
      writes += 1;
      if (writes === 2) throw new Error("quota exceeded");
      originalSet.call(storage, key, value);
    };
    const importedCampaign = completeMission(freshCampaignProgress(421), 0, 3, 900);
    const imported = parseSaveExport(serializeSaveExport(state, importedCampaign));

    expect(importSaveAtomically(storage, imported)).toBe(true);
    expect(storage.getItem("dynamica-command:save:0421")).toBe(previousMission);
    expect(storage.getItem("dynamica-command:campaign:0421")).toBe(previousCampaign);
    expect(storage.getItem(SAVE_TRANSFER_KEY)).not.toBeNull();
    expect(readSave(storage, 421)?.missionName).toBe(state.missionName);
    expect(readCampaignProgress(storage, 421).completedMissions).toEqual([0]);
  });
});
