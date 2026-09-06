import { writeCampaignProgress } from "../campaign";
import { writeSave } from "./api";
import { saveKey } from "./serialize";
import type { ParsedSlot } from "./slots";
import { safeRemoveItem, safeSetItem, type StorageAdapter } from "./storage";

/** Restore both records before changing the active mission or its URL. */
export function restoreSlot(storage: StorageAdapter, slot: ParsedSlot): string | null {
  const key = saveKey(slot.state.seed);
  let previous: string | null;
  try {
    // A failed read must not be mistaken for an absent autosave during rollback.
    previous = storage.getItem(key);
  } catch {
    return "Couldn't load the slot because browser storage is unavailable. Your current mission is unchanged.";
  }
  if (!writeSave(storage, slot.state)) {
    return "Couldn't load the slot because its autosave could not be written. Your current mission is unchanged.";
  }
  if (writeCampaignProgress(storage, slot.campaign)) return null;
  const rolledBack = previous === null
    ? safeRemoveItem(storage, key)
    : safeSetItem(storage, key, previous);
  return rolledBack
    ? "Couldn't restore campaign progress. The previous autosave was restored; your current mission is unchanged."
    : "Couldn't restore campaign progress or recover the previous autosave. Your current mission is still open; the named slot is intact. Free browser storage and load the slot again.";
}
