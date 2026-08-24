"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { downloadMusicExport, exportMissionSoundtrack, supportsM4aExport } from "@/lib/audio/export";
import { formatSeed } from "@/lib/seed/rng";
import styles from "./SoundtrackPanel.module.css";

type Availability = "checking" | "available" | "unsupported";
type ExportState = "idle" | "rendering" | "encoding" | "cancelling" | "complete" | "error";

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
  const exportAbortController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const busy = exportState === "rendering" || exportState === "encoding" || exportState === "cancelling";

  useEffect(() => () => {
    mounted.current = false;
    exportAbortController.current?.abort();
  }, []);

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
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!busy) onClose();
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [busy, onClose]);

  const cancelExport = useCallback(() => {
    const controller = exportAbortController.current;
    if (!controller) return;
    controller.abort();
    setExportState("cancelling");
    setStatus("Cancelling soundtrack export…");
  }, []);

  const exportTrack = async () => {
    if (availability !== "available" || exportState === "rendering" || exportState === "encoding") return;
    const controller = new AbortController();
    exportAbortController.current = controller;
    setExportState("rendering");
    setProgress(0.08);
    setStatus("Rendering mission score…");
    try {
      const result = await exportMissionSoundtrack(seed, missionIndex, ({ phase, progress: nextProgress, phaseProgress }) => {
        if (exportAbortController.current !== controller || !mounted.current) return;
        setProgress(nextProgress);
        if (phase === "rendering") {
          setExportState("rendering");
          setStatus(`Rendering mission score… ${Math.round(phaseProgress * 100)}%`);
        }
        if (phase === "encoding") {
          setExportState("encoding");
          setStatus(`Encoding AAC and packaging the M4A file… ${Math.round(phaseProgress * 100)}%`);
        }
      }, { signal: controller.signal });
      if (controller.signal.aborted || exportAbortController.current !== controller || !mounted.current) return;
      downloadMusicExport(result);
      setExportState("complete");
      setProgress(1);
      setStatus(`Downloaded ${result.filename}`);
    } catch (error) {
      if (controller.signal.aborted) {
        if (exportAbortController.current === controller && mounted.current) {
          setExportState("idle");
          setProgress(0);
          setStatus("Export cancelled. You can start it again when ready.");
        }
        return;
      }
      if (exportAbortController.current !== controller || !mounted.current) return;
      setExportState("error");
      setProgress(0);
      setStatus(error instanceof Error ? error.message : "Unable to export the mission soundtrack.");
    } finally {
      if (exportAbortController.current === controller) exportAbortController.current = null;
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
