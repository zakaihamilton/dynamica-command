import {
  clearPendingSaveTransfer,
  readPendingSaveTransfer,
  type ParsedSaveExport,
  type StorageAdapter,
  writePendingSaveTransfer,
  writeSave,
} from "./save";
import {
  mergeCampaignProgress,
  readCampaignProgress,
  writeCampaignProgress,
} from "./campaign";

function mirrorTransfer(storage: StorageAdapter, imported: ParsedSaveExport): boolean {
  if (!writeCampaignProgress(storage, imported.campaign)) return false;
  return writeSave(storage, imported.state);
}

/**
 * Commit the portable save as one validated storage record first. The two
 * legacy keys are mirrored afterwards; readers prefer the transfer record
 * until both mirrors succeed, so a quota failure cannot expose a half-import.
 */
export function importSaveAtomically(storage: StorageAdapter, imported: ParsedSaveExport): boolean {
  const pending = readPendingSaveTransfer(storage);
  if (pending && !mirrorTransfer(storage, pending)) return false;

  const mergedProgress = mergeCampaignProgress(
    readCampaignProgress(storage, imported.state.seed),
    imported.campaign,
  );

  const committed: ParsedSaveExport = {
    state: imported.state,
    campaign: mergedProgress,
    exportedAt: Date.now(),
  };

  // This single setItem is the commit point. If it fails, neither legacy key
  // has been touched and the caller can safely report an import failure.
  if (!writePendingSaveTransfer(storage, committed.state, committed.campaign)) return false;

  // Best-effort mirroring keeps existing save consumers working. If either
  // write fails, the committed transfer remains authoritative and will be
  // retried on the next import; the app never reads the mismatched mirrors.
  if (mirrorTransfer(storage, committed)) clearPendingSaveTransfer(storage);
  return true;
}
