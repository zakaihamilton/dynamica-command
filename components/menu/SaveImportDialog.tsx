"use client";

import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { useModalFocus } from "@/components/ui/useModalFocus";
import { formatSeed } from "@/lib/seed/rng";
import type { ParsedSaveExport } from "@/lib/persist/save";
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
  const dialogRef = useModalFocus(true, fileName, "dialog");
  return (
    <div className={styles.backdrop} role="presentation">
      <MetalPanel
        ref={dialogRef}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-import-title"
      >
        <p className={styles.eyebrow}>Save transfer</p>
        <h2 id="save-import-title">Import save?</h2>
        <p className={styles.fileName}>{fileName}</p>
        <dl className={styles.details}>
          <div><dt>Seed</dt><dd>{formatSeed(save.state.seed)}</dd></div>
          <div><dt>Mission</dt><dd>{save.state.missionIndex + 1} · {save.state.missionName}</dd></div>
          <div><dt>State</dt><dd>{save.state.result} · tick {save.state.tick}</dd></div>
          <div><dt>Campaign</dt><dd>Mission {save.campaign.unlockedMission + 1} unlocked · {save.campaign.completedMissions.length} complete</dd></div>
        </dl>
        {collision ? <p className={styles.warning} role="alert">A local save exists for this seed. Confirming replaces its mission state and merges campaign progress.</p> : null}
        {error ? <p className={styles.warning} role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <ConsoleButton onClick={onConfirm}>{collision ? "Replace and Import" : "Import Save"}</ConsoleButton>
          <ConsoleButton muted onClick={onCancel}>Cancel</ConsoleButton>
        </div>
      </MetalPanel>
    </div>
  );
}
