import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { formatSeed } from "@/lib/seed/rng";
import type { ParsedSaveExport } from "@/lib/persist/save";
import { formatMissionDuration } from "@/lib/sim/debrief";
import { saveResultLabel } from "@/lib/ui/copy";
import styles from "./SaveImportDialog.module.css";

export function SaveImportDialog({
  fileName,
  save,
  collision,
  error,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  save: ParsedSaveExport;
  collision: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.backdrop} role="presentation">
      <MetalPanel className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="save-import-title">
        <p className={styles.eyebrow}>Save transfer</p>
        <h2 id="save-import-title">Import save?</h2>
        <p className={styles.fileName}>{fileName}</p>
        <dl className={styles.details}>
          <div><dt>Seed</dt><dd>{formatSeed(save.state.seed)}</dd></div>
          <div><dt>Mission</dt><dd>{save.state.missionIndex + 1} · {save.state.missionName}</dd></div>
          <div><dt>Status</dt><dd>{saveResultLabel(save.state.result)} · {formatMissionDuration(save.state.tick)}</dd></div>
          <div><dt>Campaign</dt><dd>Mission {save.campaign.unlockedMission + 1} unlocked · {save.campaign.completedMissions.length} complete</dd></div>
        </dl>
        {collision ? <p className={styles.warning} role="alert">A save already exists for this campaign. Confirming replaces the current mission and keeps the best campaign progress.</p> : null}
        {error ? <p className={styles.warning} role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <ConsoleButton onClick={onConfirm}>{collision ? "Replace and Import" : "Import Save"}</ConsoleButton>
          <ConsoleButton muted onClick={onCancel}>Cancel</ConsoleButton>
        </div>
      </MetalPanel>
    </div>
  );
}
