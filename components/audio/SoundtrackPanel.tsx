"use client";

import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { formatSeed } from "@/lib/seed/rng";
import { useSoundtrackExport } from "./useSoundtrackExport";
import styles from "./SoundtrackPanel.module.css";

export function SoundtrackPanel({
  seed,
  missionIndex,
  onClose,
}: {
  seed: number;
  missionIndex: number;
  onClose: () => void;
}) {
  const { availability, exportState, progress, status, busy, draining, cancelExport, exportTrack } = useSoundtrackExport({
    seed,
    missionIndex,
    onClose,
  });

  return (
    <div className={styles.overlay}>
      <MetalPanel className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="soundtrack-title">
        <ConsoleLabel>Audio archive</ConsoleLabel>
        <h2 id="soundtrack-title" className={styles.title}>Mission soundtrack</h2>
        <p className={styles.meta}>Seed {formatSeed(seed)} {"//"} Mission {missionIndex + 1}</p>
        <p className={styles.description}>
          {"Download this mission's music as a standalone file (~4 minutes). It doesn't include battlefield sound effects. Preparing it can take a while."}
        </p>
        <div className={styles.readout} aria-live="polite">
          <span className={styles.status}>{status}</span>
          <span className={styles.progressSlot} aria-hidden={!busy}>
            <progress className={styles.progress} max="1" value={busy ? progress : 0} aria-label="Download progress" />
          </span>
        </div>
        <div className={styles.actions}>
          <ConsoleButton
            className={styles.action}
            onClick={exportTrack}
            disabled={availability !== "available" || busy || draining}
            tooltip={availability === "unsupported" ? "This browser can't save the soundtrack" : "Download this mission's music"}
          >
            {busy
              ? exportState === "rendering" ? "Preparing…" : exportState === "encoding" ? "Saving…" : "Cancelling…"
              : exportState === "complete" ? "Download again" : "Download music"}
          </ConsoleButton>
          {busy ? (
            <ConsoleButton className={styles.action} muted onClick={cancelExport} disabled={exportState === "cancelling"} tooltip="Stop preparing this soundtrack">
              {exportState === "cancelling" ? "Cancelling…" : "Cancel download"}
            </ConsoleButton>
          ) : (
            <ConsoleButton className={styles.action} muted onClick={onClose} tooltip="Return to the previous screen">Close</ConsoleButton>
          )}
        </div>
        <p className={styles.format}>Stereo music file · saved on this device</p>
      </MetalPanel>
    </div>
  );
}
