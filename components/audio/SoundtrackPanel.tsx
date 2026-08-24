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
  const { availability, exportState, progress, status, busy, cancelExport, exportTrack } = useSoundtrackExport({
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
          Render the complete adaptive command score as a standalone M4A file. The download is generated from this mission seed and does not include battlefield effects.
        </p>
        <div className={styles.readout} aria-live="polite">
          <span>{status}</span>
          {busy ? <progress className={styles.progress} max="1" value={progress} aria-label="Export progress" /> : null}
        </div>
        <div className={styles.actions}>
          <ConsoleButton
            onClick={exportTrack}
            disabled={availability !== "available" || busy}
            tooltip={availability === "unsupported" ? "Native AAC export is not supported here" : "Render and download the mission soundtrack as M4A"}
          >
            {busy
              ? exportState === "rendering" ? "Rendering…" : exportState === "encoding" ? "Encoding…" : "Cancelling…"
              : exportState === "complete" ? "Download again" : "Download M4A"}
          </ConsoleButton>
          {busy ? (
            <ConsoleButton muted onClick={cancelExport} disabled={exportState === "cancelling"} tooltip="Stop rendering or encoding this soundtrack">
              {exportState === "cancelling" ? "Cancelling…" : "Cancel export"}
            </ConsoleButton>
          ) : (
            <ConsoleButton muted onClick={onClose} tooltip="Return to the previous screen">Close</ConsoleButton>
          )}
        </div>
        <p className={styles.format}>AAC-LC · 44.1 kHz · stereo · native browser encoder</p>
      </MetalPanel>
    </div>
  );
}
