import { safeGetItem, safeSetItem, type StorageAdapter } from "./save";

export const SETTINGS_KEY = "genesis-protocol:settings";
export const SETTINGS_VERSION = 2 as const;

export type GameSettings = {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  tacticalRosterEnabled: boolean;
};

export function defaultSettings(): GameSettings {
  return {
    sfxEnabled: true,
    musicEnabled: true,
    masterVolume: 1,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    tacticalRosterEnabled: false,
  };
}

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function normalize(value: unknown): GameSettings {
  const base = defaultSettings();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<GameSettings>;
  return {
    sfxEnabled: raw.sfxEnabled !== false,
    musicEnabled: raw.musicEnabled !== false,
    masterVolume: clampVolume(raw.masterVolume, base.masterVolume),
    musicVolume: clampVolume(raw.musicVolume, base.musicVolume),
    sfxVolume: clampVolume(raw.sfxVolume, base.sfxVolume),
    tacticalRosterEnabled: raw.tacticalRosterEnabled === true,
  };
}

export function readSettings(storage: StorageAdapter): GameSettings {
  const raw = safeGetItem(storage, SETTINGS_KEY);
  if (!raw) return defaultSettings();
  try {
    const parsed = JSON.parse(raw) as { version?: number; settings?: unknown };
    if (parsed.version !== 1 && parsed.version !== SETTINGS_VERSION) return defaultSettings();
    return normalize(parsed.settings);
  } catch {
    return defaultSettings();
  }
}

export function writeSettings(storage: StorageAdapter, settings: GameSettings): boolean {
  return safeSetItem(storage, SETTINGS_KEY, JSON.stringify({
    version: SETTINGS_VERSION,
    savedAt: Date.now(),
    settings: {
      sfxEnabled: settings.sfxEnabled === true,
      musicEnabled: settings.musicEnabled === true,
      masterVolume: clampVolume(settings.masterVolume, defaultSettings().masterVolume),
      musicVolume: clampVolume(settings.musicVolume, defaultSettings().musicVolume),
      sfxVolume: clampVolume(settings.sfxVolume, defaultSettings().sfxVolume),
      tacticalRosterEnabled: settings.tacticalRosterEnabled === true,
    },
  }));
}
