import { formatSeed } from "../seed/rng";
import { generateWorld } from "../gen/world";
import { expandFog } from "../sim/fog";
import type { SimState } from "../types";
import { SURFACE_NONE } from "../types";

export type StorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  keys: () => string[];
};

/** Storage can fail in browsers with disabled privacy storage or an exhausted quota. */
export function safeGetItem(storage: StorageAdapter, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(storage: StorageAdapter, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(storage: StorageAdapter, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeKeys(storage: StorageAdapter): string[] {
  try {
    return storage.keys();
  } catch {
    return [];
  }
}

export const SAVE_PREFIX = "genesis-protocol:save:";
export const SAVE_VERSION = 2;
/** Bump when deterministic generation or simulation semantics change incompatibly. */
export const SAVE_CONTENT_VERSION = 1;
const LEGACY_SAVE_VERSION = 1;
const LEGACY_SAVE_CONTENT_VERSION = 1;

type SaveEnvelope = {
  version: typeof SAVE_VERSION;
  contentVersion: typeof SAVE_CONTENT_VERSION;
  savedAt: number;
  state: unknown;
};

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function isStateShape(value: unknown): value is SimState {
  if (!isRecord(value)) return false;
  const width = value.width;
  const height = value.height;
  if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) return false;
  if (typeof height !== "number" || !Number.isInteger(height) || height <= 0) return false;
  return (
    Number.isInteger(value.seed) &&
    Number.isInteger(value.missionIndex) &&
    Number.isInteger(value.tick) &&
    Array.isArray(value.tiles) && value.tiles.length === width * height &&
    Array.isArray(value.resourceAmount) && value.resourceAmount.length === width * height &&
    Array.isArray(value.entities) &&
    Number.isInteger(value.nextId) &&
    isNumberPair(value.credits) &&
    isNumberPair(value.creditsEarned) &&
    isNumberPair(value.unitsProduced) &&
    isNumberPair(value.buildingsCompleted) &&
    (value.result === "playing" || value.result === "won" || value.result === "lost") &&
    isRecord(value.win) &&
    Array.isArray(value.factions) && value.factions.length === 2 &&
    typeof value.missionName === "string"
  );
}

function decodeSave(raw: string): { state: SimState; savedAt: number } {
  const parsed: unknown = JSON.parse(raw);
  let value = parsed;
  let savedAt = 0;
  if (isRecord(parsed) && "state" in parsed) {
    if ((parsed.version !== SAVE_VERSION && parsed.version !== LEGACY_SAVE_VERSION) || !isNumber(parsed.savedAt)) {
      throw new Error("Unsupported save version");
    }
    const contentVersion = parsed.contentVersion ?? LEGACY_SAVE_CONTENT_VERSION;
    assertSupportedContentVersion(contentVersion);
    value = parsed.state;
    savedAt = parsed.savedAt;
  } else if (isRecord(parsed) && isNumber(parsed.savedAt)) {
    // Legacy saves stored SimState and savedAt at the same level.
    assertSupportedContentVersion(LEGACY_SAVE_CONTENT_VERSION);
    savedAt = parsed.savedAt;
  }
  const state = normalizeState(value);
  if (!isStateShape(state)) throw new Error("Invalid save state");
  return { state, savedAt };
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertSupportedContentVersion(contentVersion: unknown): void {
  if (contentVersion !== SAVE_CONTENT_VERSION) throw new Error("Unsupported save content version");
}

export function saveKey(seed: number): string {
  return `${SAVE_PREFIX}${formatSeed(seed)}`;
}

export type SaveMeta = {
  seed: string;
  campaignName: string;
  missionIndex: number;
  tick: number;
  result: SimState["result"];
  missionName: string;
  savedAt: number;
};

export function serializeState(state: SimState): string {
  return JSON.stringify(state);
}

export function deserializeState(raw: string): SimState {
  return decodeSave(raw).state;
}

function normalizeState(value: unknown): SimState {
  if (!isRecord(value)) throw new Error("Invalid save state");
  if (
    typeof value.width !== "number" || !Number.isInteger(value.width) || value.width <= 0 ||
    typeof value.height !== "number" || !Number.isInteger(value.height) || value.height <= 0
  ) {
    throw new Error("Invalid save state");
  }
  const s = value as unknown as SimState;
  if (!s.heights || s.heights.length !== s.width * s.height) {
    s.heights = new Array(s.width * s.height).fill(1);
  }
  if (!s.surfaces || s.surfaces.length !== s.width * s.height) {
    s.surfaces = new Array(s.width * s.height).fill(SURFACE_NONE);
  }
  if (!s.biome) s.biome = generateWorld(s.seed).biome;
  if (!Array.isArray(s.fog)) s.fog = [];
  s.fog = expandFog(s.fog, s.width, s.height);
  if (!s.losses || !Array.isArray(s.losses.units) || !Array.isArray(s.losses.buildings)) {
    s.losses = { units: [0, 0], buildings: [0, 0] };
  }
  if (!s.unitsProducedByRole || typeof s.unitsProducedByRole !== "object") {
    s.unitsProducedByRole = { harvester: 0, infantry: 0, antiArmor: 0, tank: 0 };
  }
  if (!s.buildingsCompletedByKind || typeof s.buildingsCompletedByKind !== "object") {
    s.buildingsCompletedByKind = {};
  }
  if (!Array.isArray(s.entities)) s.entities = [];
  const scenarioRole =
    s.runtime?.kind === "escort" ? "convoy" :
    s.runtime?.kind === "rescue" ? "stranded" :
    s.runtime?.kind === "extraction" ? "cargo" :
    undefined;
  const scenarioTargetIds = new Set(s.runtime?.targetIds ?? []);
  for (const e of s.entities) {
    if (!e.queue) e.queue = [];
    if (e.facing === undefined) e.facing = e.owner === 0 ? 0 : 4;
    if (e.repairing === undefined) e.repairing = false;
    if (e.stance === undefined) e.stance = "aggressive";
    if (e.suppression === undefined) e.suppression = 0;
    if (e.scenarioRole === undefined && e.class === "unit" && scenarioRole && scenarioTargetIds.has(e.id)) {
      e.scenarioRole = scenarioRole;
    }
  }
  if (!s.aiState) s.aiState = "economy";
  if (typeof s.aiRetreatTick !== "number" || !Number.isInteger(s.aiRetreatTick)) {
    delete s.aiRetreatTick;
  }
  if (s.aiRetreatLocked !== true) delete s.aiRetreatLocked;
  delete (s as { appliedUpgrades?: unknown }).appliedUpgrades;
  return s;
}

export function writeSave(storage: StorageAdapter, state: SimState): boolean {
  const payload: SaveEnvelope = {
    version: SAVE_VERSION,
    contentVersion: SAVE_CONTENT_VERSION,
    savedAt: Date.now(),
    state,
  };
  return safeSetItem(storage, saveKey(state.seed), JSON.stringify(payload));
}

export function readSave(storage: StorageAdapter, seed: number): SimState | null {
  const raw = safeGetItem(storage, saveKey(seed));
  if (!raw) return null;
  try {
    const { state } = decodeSave(raw);
    return state.seed === seed ? state : null;
  } catch {
    return null;
  }
}

export function removeSave(storage: StorageAdapter, seed: number): void {
  safeRemoveItem(storage, saveKey(seed));
}

/** Save keys whose payload cannot be migrated into a playable state. */
export function listUnreadableSaves(storage: StorageAdapter): string[] {
  const unreadable: string[] = [];
  for (const key of safeKeys(storage)) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    const seed = key.slice(SAVE_PREFIX.length);
    if (!/^\d{4}$/.test(seed)) continue;
    try {
      const { state } = decodeSave(safeGetItem(storage, key) ?? "");
      if (state.seed !== Number(seed)) unreadable.push(seed);
    } catch {
      unreadable.push(seed);
    }
  }
  return unreadable.sort();
}

export function listSaves(storage: StorageAdapter): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const key of safeKeys(storage)) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    const raw = safeGetItem(storage, key);
    if (!raw) continue;
    try {
      const { state: s, savedAt } = decodeSave(raw);
      if (key !== saveKey(s.seed)) continue;
      out.push({
        seed: formatSeed(s.seed),
        campaignName: generateWorld(s.seed).name,
        missionIndex: s.missionIndex,
        tick: s.tick,
        result: s.result,
        missionName: s.missionName,
        savedAt,
      });
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt || a.seed.localeCompare(b.seed));
}

export function memoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()],
  };
}

export function localStorageAdapter(): StorageAdapter {
  return {
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
    removeItem: (k) => window.localStorage.removeItem(k),
    keys: () => Object.keys(window.localStorage),
  };
}
