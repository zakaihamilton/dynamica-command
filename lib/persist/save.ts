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

export const SAVE_PREFIX = "genesis-protocol:save:";
export const SAVE_VERSION = 1;

type SaveEnvelope = {
  version: typeof SAVE_VERSION;
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
    if (parsed.version !== SAVE_VERSION || !isNumber(parsed.savedAt)) {
      throw new Error("Unsupported save version");
    }
    value = parsed.state;
    savedAt = parsed.savedAt;
  } else if (isRecord(parsed) && isNumber(parsed.savedAt)) {
    // Legacy saves stored SimState and savedAt at the same level.
    savedAt = parsed.savedAt;
  }
  const state = normalizeState(value);
  if (!isStateShape(state)) throw new Error("Invalid save state");
  return { state, savedAt };
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function saveKey(seed: number): string {
  return `${SAVE_PREFIX}${formatSeed(seed)}`;
}

export type SaveMeta = {
  seed: string;
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
  for (const e of s.entities) {
    if (!e.queue) e.queue = [];
    if (e.facing === undefined) e.facing = e.owner === 0 ? 0 : 4;
    if (e.repairing === undefined) e.repairing = false;
  }
  return s;
}

export function writeSave(storage: StorageAdapter, state: SimState): void {
  const payload: SaveEnvelope = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state,
  };
  storage.setItem(saveKey(state.seed), JSON.stringify(payload));
}

export function readSave(storage: StorageAdapter, seed: number): SimState | null {
  const raw = storage.getItem(saveKey(seed));
  if (!raw) return null;
  try {
    const { state } = decodeSave(raw);
    return state.seed === seed ? state : null;
  } catch {
    return null;
  }
}

export function listSaves(storage: StorageAdapter): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const key of storage.keys()) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const { state: s, savedAt } = decodeSave(raw);
      if (key !== saveKey(s.seed)) continue;
      out.push({
        seed: formatSeed(s.seed),
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
