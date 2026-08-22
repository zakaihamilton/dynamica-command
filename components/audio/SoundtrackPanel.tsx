"use client";

import { useEffect, useState } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { downloadMusicExport, exportMissionSoundtrack, supportsM4aExport } from "@/lib/audio/export";
import { formatSeed } from "@/lib/seed/rng";
import styles from "./SoundtrackPanel.module.css";

type Availability = "checking" | "available" | "unsupported";
type ExportState = "idle" | "rendering" | "encoding" | "complete" | "error";

export function SoundtrackPanel({
  seed,
  missionIndex,
  onClose,
}: {
  seed: number;
  missionIndex: number;
  onClose: () => void;
}) {
  const [availability, setAvailability] = useState<Availability>("checking");
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Checking browser audio support…");
  const busy = exportState === "rendering" || exportState === "encoding";

  useEffect(() => {
    let active = true;
    void supportsM4aExport().then((supported) => {
      if (!active) return;
      setAvailability(supported ? "available" : "unsupported");
      setStatus(supported ? "Native AAC export is available." : "This browser cannot encode native AAC M4A files.");
    }).catch(() => {
      if (!active) return;
      setAvailability("unsupported");
      setStatus("M4A export is unavailable in this browser.");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const blockEscapeWhileBusy = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", blockEscapeWhileBusy, true);
    return () => window.removeEventListener("keydown", blockEscapeWhileBusy, true);
  }, [busy]);

  const exportTrack = async () => {
    if (availability !== "available" || exportState === "rendering" || exportState === "encoding") return;
    setExportState("rendering");
    setProgress(0.08);
    setStatus("Rendering the complete 64-bar mission score…");
    try {
      const result = await exportMissionSoundtrack(seed, missionIndex, ({ phase, progress: nextProgress }) => {
        setProgress(nextProgress);
        if (phase === "rendering") setExportState("rendering");
        if (phase === "encoding") {
          setExportState("encoding");
          setStatus("Encoding AAC and packaging the M4A file…");
        }
      });
      downloadMusicExport(result);
      setExportState("complete");
      setProgress(1);
      setStatus(`Downloaded ${result.filename}`);
    } catch (error) {
      setExportState("error");
      setProgress(0);
      setStatus(error instanceof Error ? error.message : "Unable to export the mission soundtrack.");
    }
  };

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
            {busy ? (exportState === "rendering" ? "Rendering…" : "Encoding…") : exportState === "complete" ? "Download again" : "Download M4A"}
          </ConsoleButton>
          <ConsoleButton muted onClick={onClose} disabled={busy} tooltip="Return to the previous screen">Close</ConsoleButton>
        </div>
        <p className={styles.format}>AAC-LC · 44.1 kHz · stereo · native browser encoder</p>
      </MetalPanel>
    </div>
  );
}
