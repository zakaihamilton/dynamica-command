import type { StorageAdapter } from "./save";

export const SETTINGS_KEY = "genesis-protocol:settings";
export const SETTINGS_VERSION = 1 as const;

export type GameSettings = {
  sfxEnabled: boolean;
  musicEnabled: boolean;
};

export function defaultSettings(): GameSettings {
  return { sfxEnabled: true, musicEnabled: true };
}

function normalize(value: unknown): GameSettings {
  const base = defaultSettings();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<GameSettings>;
  return {
    sfxEnabled: raw.sfxEnabled !== false,
    musicEnabled: raw.musicEnabled !== false,
  };
}

export function readSettings(storage: StorageAdapter): GameSettings {
  const raw = storage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings();
  try {
    const parsed = JSON.parse(raw) as { version?: number; settings?: unknown };
    if (parsed.version !== SETTINGS_VERSION) return defaultSettings();
    return normalize(parsed.settings);
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(storage: StorageAdapter, settings: GameSettings): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify({
    version: SETTINGS_VERSION,
    savedAt: Date.now(),
    settings: {
      sfxEnabled: settings.sfxEnabled === true,
      musicEnabled: settings.musicEnabled === true,
    },
  }));
}
