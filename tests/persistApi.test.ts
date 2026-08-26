import { describe, expect, it, vi } from "vitest";
import {
  memoryStorage,
  writeSave,
  readSave,
  removeSave,
  listSaves,
  listUnreadableSaves,
  hasSaveForSeed,
  readPendingSaveTransfer,
  writePendingSaveTransfer,
  createSaveSession,
  saveKey,
  SAVE_TRANSFER_KEY,
} from "../lib/persist/save";
import { freshCampaignProgress } from "../lib/persist/campaign";
import { makeFixture } from "../lib/sim/fixtures";

function makeState(seed: number) {
  return makeFixture({ seed, win: { kind: "annihilate" } });
}

describe("readPendingSaveTransfer", () => {
  it("returns null when no pending transfer exists", () => {
    const storage = memoryStorage();
    expect(readPendingSaveTransfer(storage)).toBeNull();
  });

  it("returns null when pending transfer is malformed", () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_TRANSFER_KEY, "not-valid-json");
    expect(readPendingSaveTransfer(storage)).toBeNull();
  });
});

describe("writePendingSaveTransfer", () => {
  it("returns true on success", () => {
    const storage = memoryStorage();
    const state = makeState(1000);
    const campaign = freshCampaignProgress(1000);
    expect(writePendingSaveTransfer(storage, state, campaign)).toBe(true);
    expect(storage.getItem(SAVE_TRANSFER_KEY)).toBeTruthy();
  });

  it("returns false when storage throws", () => {
    const storage = memoryStorage();
    storage.setItem = () => { throw new Error("quota"); };
    const state = makeState(1000);
    const campaign = freshCampaignProgress(1000);
    expect(writePendingSaveTransfer(storage, state, campaign)).toBe(false);
  });
});

describe("hasSaveForSeed", () => {
  it("returns true when a pending transfer matches the seed", () => {
    const storage = memoryStorage();
    const state = makeState(421);
    writePendingSaveTransfer(storage, state, freshCampaignProgress(421));
    expect(hasSaveForSeed(storage, 421)).toBe(true);
  });

  it("returns true when a local save exists", () => {
    const storage = memoryStorage();
    writeSave(storage, makeState(421));
    expect(hasSaveForSeed(storage, 421)).toBe(true);
  });

  it("returns false when neither exists", () => {
    const storage = memoryStorage();
    expect(hasSaveForSeed(storage, 421)).toBe(false);
  });
});

describe("readSave", () => {
  it("reads from pending transfer first", () => {
    const storage = memoryStorage();
    const state = makeState(421);
    writePendingSaveTransfer(storage, state, freshCampaignProgress(421));
    const loaded = readSave(storage, 421);
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe(421);
  });

  it("returns null on corrupt save data", () => {
    const storage = memoryStorage();
    storage.setItem(saveKey(421), "corrupt-data");
    expect(readSave(storage, 421)).toBeNull();
  });

  it("returns null when seed in payload does not match key", () => {
    const storage = memoryStorage();
    writeSave(storage, makeState(1000));
    expect(readSave(storage, 421)).toBeNull();
  });

  it("returns null when no save exists", () => {
    const storage = memoryStorage();
    expect(readSave(storage, 421)).toBeNull();
  });
});

describe("writeSave", () => {
  it("returns false when the state cannot be serialized", () => {
    const storage = memoryStorage();
    const state = makeState(421);
    (state as unknown as { circular: unknown }).circular = state;

    expect(writeSave(storage, state)).toBe(false);
    expect(storage.getItem(saveKey(421))).toBeNull();
  });
});

describe("SaveSession", () => {
  it("does not overwrite a save changed after the session started", () => {
    const storage = memoryStorage();
    const session = createSaveSession(storage, 421);
    const initial = makeState(421);
    expect(session.write(initial, "implicit")).toBe("saved");

    const external = makeState(421);
    external.tick = 99;
    expect(writeSave(storage, external)).toBe(true);

    const local = makeState(421);
    local.tick = 12;
    expect(session.write(local, "implicit")).toBe("conflict");
    expect(readSave(storage, 421)?.tick).toBe(99);
  });

  it("allows an explicit save to replace the current record", () => {
    const storage = memoryStorage();
    const session = createSaveSession(storage, 421);
    const external = makeState(421);
    external.tick = 99;
    expect(writeSave(storage, external)).toBe(true);

    const local = makeState(421);
    local.tick = 12;
    expect(session.write(local, "explicit")).toBe("saved");
    expect(readSave(storage, 421)?.tick).toBe(12);
  });

  it("treats pending transfers as conflicts for implicit writes", () => {
    const storage = memoryStorage();
    const session = createSaveSession(storage, 421);
    expect(session.write(makeState(421), "implicit")).toBe("saved");
    expect(writePendingSaveTransfer(storage, makeState(421), freshCampaignProgress(421))).toBe(true);

    const local = makeState(421);
    local.tick = 12;
    expect(session.write(local, "implicit")).toBe("conflict");
    expect(readPendingSaveTransfer(storage)?.state.tick).toBe(0);
  });

  it("can adopt an externally selected save before continuing implicit writes", () => {
    const storage = memoryStorage();
    const session = createSaveSession(storage, 421);
    const external = makeState(421);
    external.tick = 99;
    expect(writeSave(storage, external)).toBe(true);
    session.adoptCurrent();

    const local = makeState(421);
    local.tick = 12;
    expect(session.write(local, "implicit")).toBe("saved");
    expect(readSave(storage, 421)?.tick).toBe(12);
  });

  it("honors an explicit storage-change notification", () => {
    const storage = memoryStorage();
    const session = createSaveSession(storage, 421);
    expect(session.write(makeState(421), "implicit")).toBe("saved");
    session.markExternalChange();
    expect(session.write(makeState(421), "implicit")).toBe("conflict");
  });

  it("reports failed when the underlying storage rejects a write", () => {
    const storage = memoryStorage();
    storage.setItem = () => { throw new Error("quota"); };
    const session = createSaveSession(storage, 421);

    expect(session.write(makeState(421), "implicit")).toBe("failed");
  });
});

describe("removeSave", () => {
  it("removes the local save", () => {
    const storage = memoryStorage();
    writeSave(storage, makeState(421));
    removeSave(storage, 421);
    expect(readSave(storage, 421)).toBeNull();
  });

  it("also removes matching pending transfer", () => {
    const storage = memoryStorage();
    writePendingSaveTransfer(storage, makeState(421), freshCampaignProgress(421));
    removeSave(storage, 421);
    expect(readPendingSaveTransfer(storage)).toBeNull();
  });
});

describe("listSaves", () => {
  it("includes pending transfer as first entry", () => {
    const storage = memoryStorage();
    const state = makeState(421);
    state.missionIndex = 3;
    state.tick = 500;
    writePendingSaveTransfer(storage, state, freshCampaignProgress(421));
    const saves = listSaves(storage);
    expect(saves).toHaveLength(1);
    expect(saves[0]!.seed).toBe("0421");
    expect(saves[0]!.missionIndex).toBe(3);
  });

  it("skips pending seed in local saves loop", () => {
    const storage = memoryStorage();
    writePendingSaveTransfer(storage, makeState(421), freshCampaignProgress(421));
    writeSave(storage, makeState(421));
    const saves = listSaves(storage);
    expect(saves).toHaveLength(1);
  });

  it("skips unreadable saves gracefully", () => {
    const storage = memoryStorage();
    storage.setItem(saveKey(421), "not-json");
    const saves = listSaves(storage);
    expect(saves).toHaveLength(0);
  });

  it("sorts by savedAt descending", () => {
    const storage = memoryStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    writeSave(storage, makeState(1));
    vi.setSystemTime(new Date(2000));
    writeSave(storage, makeState(2));
    vi.useRealTimers();
    const saves = listSaves(storage);
    expect(saves.length).toBe(2);
    expect(saves[0]!.seed).toBe("0002");
    expect(saves[1]!.seed).toBe("0001");
  });
});

describe("listUnreadableSaves", () => {
  it("skips keys without the save prefix", () => {
    const storage = memoryStorage();
    storage.setItem("other:key", "value");
    expect(listUnreadableSaves(storage)).toEqual([]);
  });

  it("skips non-4-digit seed keys", () => {
    const storage = memoryStorage();
    storage.setItem("genesis-protocol:save:abc", "value");
    expect(listUnreadableSaves(storage)).toEqual([]);
  });

  it("skips pending transfer seeds", () => {
    const storage = memoryStorage();
    writePendingSaveTransfer(storage, makeState(421), freshCampaignProgress(421));
    storage.setItem(saveKey(421), "corrupt");
    expect(listUnreadableSaves(storage)).toEqual([]);
  });

  it("reports seed mismatches", () => {
    const storage = memoryStorage();
    const state = makeState(9999);
    writeSave(storage, state);
    storage.setItem(saveKey(421), storage.getItem(saveKey(9999))!);
    expect(listUnreadableSaves(storage)).toContain("0421");
  });
});
