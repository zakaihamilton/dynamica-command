import { describe, expect, it } from "vitest";
import { restoreSlot } from "../../lib/persist/save/restore";
import { memoryStorage, readSave, saveKey, writeSave, type ParsedSlot } from "../../lib/persist/save";
import { campaignKey, freshCampaignProgress, readCampaignProgress, writeCampaignProgress } from "../../lib/persist/campaign";
import { makeFixture } from "../../lib/sim/fixtures";

function fixture() {
  const storage = memoryStorage();
  const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
  writeSave(storage, state);
  const campaign = freshCampaignProgress(421);
  writeCampaignProgress(storage, campaign);
  const slot: ParsedSlot = {
    id: "12345678", name: "Earlier", savedAt: 0,
    state: { ...state, tick: 99 },
    campaign: { ...campaign, unlockedMission: 2 },
  };
  return { storage, slot };
}

describe("slot restore writes", () => {
  it("commits mission and campaign together on success", () => {
    const { storage, slot } = fixture();
    expect(restoreSlot(storage, slot)).toBeNull();
    expect(readSave(storage, 421)?.tick).toBe(99);
    expect(readCampaignProgress(storage, 421).unlockedMission).toBe(2);
  });

  it("does not change campaign progress if the autosave fails", () => {
    const { storage, slot } = fixture();
    const broken = { ...storage, setItem: () => { throw new Error("quota"); } };
    expect(restoreSlot(broken, slot)).toContain("autosave could not be written");
    expect(readSave(storage, 421)?.tick).toBe(0);
    expect(readCampaignProgress(storage, 421).unlockedMission).toBe(0);
  });

  it.each([true, false])("rolls back the autosave when campaign writing fails (existing=%s)", (existing) => {
    const { storage, slot } = fixture();
    if (!existing) storage.removeItem(saveKey(421));
    const before = storage.getItem(saveKey(421));
    const broken = { ...storage, setItem: (key: string, raw: string) => {
      if (key === campaignKey(421)) throw new Error("quota");
      storage.setItem(key, raw);
    } };
    expect(restoreSlot(broken, slot)).toContain("previous autosave was restored");
    expect(storage.getItem(saveKey(421))).toBe(before);
    expect(readCampaignProgress(storage, 421).unlockedMission).toBe(0);
  });

  it("reports failed rollback without claiming a successful load", () => {
    const { storage, slot } = fixture();
    let writes = 0;
    const broken = { ...storage, setItem: (key: string, raw: string) => {
      if (++writes > 1) throw new Error("storage disabled");
      storage.setItem(key, raw);
    } };
    expect(restoreSlot(broken, slot)).toContain("recover the previous autosave");
  });

  it("does not write when the original autosave cannot be read", () => {
    const { storage, slot } = fixture();
    const broken = { ...storage, getItem: () => { throw new Error("storage disabled"); } };
    expect(restoreSlot(broken, slot)).toContain("storage is unavailable");
    expect(readSave(storage, 421)?.tick).toBe(0);
  });
});
