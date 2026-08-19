import { describe, expect, it } from "vitest";
import { memoryStorage } from "../lib/persist/save";
import {
  defaultSettings,
  readSettings,
  SETTINGS_KEY,
  SETTINGS_VERSION,
  writeSettings,
} from "../lib/persist/settings";

describe("audio settings", () => {
  it("round-trips music and sound toggles through memory storage", () => {
    const storage = memoryStorage();
    writeSettings(storage, { sfxEnabled: false, musicEnabled: true });
    expect(readSettings(storage)).toEqual({ sfxEnabled: false, musicEnabled: true });
    writeSettings(storage, { sfxEnabled: true, musicEnabled: false });
    expect(readSettings(storage)).toEqual({ sfxEnabled: true, musicEnabled: false });
  });

  it("defaults both channels on when nothing is stored", () => {
    expect(readSettings(memoryStorage())).toEqual(defaultSettings());
  });

  it("rejects mismatched versions and malformed envelopes", () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({
      version: SETTINGS_VERSION + 1,
      savedAt: 1,
      settings: { sfxEnabled: false, musicEnabled: false },
    }));
    expect(readSettings(storage)).toEqual(defaultSettings());

    storage.setItem(SETTINGS_KEY, "{not-json");
    expect(readSettings(storage)).toEqual(defaultSettings());
  });

  it("writes a versioned envelope", () => {
    const storage = memoryStorage();
    writeSettings(storage, { sfxEnabled: false, musicEnabled: false });
    const envelope = JSON.parse(storage.getItem(SETTINGS_KEY)!);
    expect(envelope.version).toBe(SETTINGS_VERSION);
    expect(envelope.settings).toEqual({ sfxEnabled: false, musicEnabled: false });
    expect(typeof envelope.savedAt).toBe("number");
  });
});
