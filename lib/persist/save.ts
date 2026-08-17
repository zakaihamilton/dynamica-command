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
  const s = JSON.parse(raw) as SimState;
  if (!s.heights || s.heights.length !== s.width * s.height) {
    s.heights = new Array(s.width * s.height).fill(1);
  }
  if (!s.surfaces || s.surfaces.length !== s.width * s.height) {
    s.surfaces = new Array(s.width * s.height).fill(SURFACE_NONE);
  }
  if (!s.biome) s.biome = generateWorld(s.seed).biome;
  if (!Array.isArray(s.fog)) s.fog = [];
  s.fog = expandFog(s.fog, s.width, s.height);
  if (!Array.isArray(s.entities)) s.entities = [];
  for (const e of s.entities) {
    if (!e.queue) e.queue = [];
    if (e.facing === undefined) e.facing = e.owner === 0 ? 0 : 4;
    if (e.repairing === undefined) e.repairing = false;
  }
  return s;
}

export function writeSave(storage: StorageAdapter, state: SimState): void {
  storage.setItem(saveKey(state.seed), JSON.stringify({ ...state, savedAt: Date.now() }));
}

export function readSave(storage: StorageAdapter, seed: number): SimState | null {
  const raw = storage.getItem(saveKey(seed));
  if (!raw) return null;
  return deserializeState(raw);
}

export function listSaves(storage: StorageAdapter): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const key of storage.keys()) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { savedAt?: unknown };
      const s = deserializeState(raw);
      out.push({
        seed: formatSeed(s.seed),
        missionIndex: s.missionIndex,
        tick: s.tick,
        result: s.result,
        missionName: s.missionName,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
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
