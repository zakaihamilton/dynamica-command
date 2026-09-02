import type { SimState } from "../../types";
import { saveKey } from "./serialize";
import {
  safeGetItem,
  type StorageAdapter,
} from "./storage";
import { writeSave } from "./api";

export type SaveWriteMode = "implicit" | "explicit";
export type SaveWriteStatus = "saved" | "conflict" | "failed";

export type SaveStorageSnapshot = {
  save: string | null;
};

export type SaveSession = {
  write: (state: SimState, mode: SaveWriteMode) => SaveWriteStatus;
  adoptCurrent: () => void;
  markExternalChange: () => void;
};

export function saveStorageSnapshot(storage: StorageAdapter, seed: number): SaveStorageSnapshot {
  return {
    save: safeGetItem(storage, saveKey(seed)),
  };
}

function sameSnapshot(a: SaveStorageSnapshot, b: SaveStorageSnapshot): boolean {
  return a.save === b.save;
}

/**
 * Coordinates runtime saves against changes made by another runtime or tab.
 * localStorage has no compare-and-swap primitive, so the comparison is a
 * best-effort same-thread guard and an early conflict signal for other tabs.
 */
export function createSaveSession(storage: StorageAdapter, seed: number): SaveSession {
  let expected = saveStorageSnapshot(storage, seed);
  let externallyChanged = false;

  return {
    write(state, mode) {
      const current = saveStorageSnapshot(storage, seed);
      if (mode === "implicit" && (externallyChanged || !sameSnapshot(current, expected))) {
        externallyChanged = true;
        return "conflict";
      }
      if (!writeSave(storage, state)) return "failed";
      expected = saveStorageSnapshot(storage, seed);
      externallyChanged = false;
      return "saved";
    },
    adoptCurrent() {
      expected = saveStorageSnapshot(storage, seed);
      externallyChanged = false;
    },
    markExternalChange() {
      externallyChanged = true;
    },
  };
}
