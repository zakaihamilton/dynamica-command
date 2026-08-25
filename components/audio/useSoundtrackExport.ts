import { useCallback, useEffect, useRef, useState } from "react";
import { downloadMusicExport, exportMissionSoundtrack, supportsM4aExport } from "@/lib/audio/export";

type Availability = "checking" | "available" | "unsupported";
type ExportState = "idle" | "rendering" | "encoding" | "cancelling" | "complete" | "error";

export function useSoundtrackExport({
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
  const exportTaskId = useRef(0);
  const [draining, setDraining] = useState(false);
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
    exportTaskId.current += 1;
    setDraining(true);
    setExportState("idle");
    setProgress(0);
    setStatus("Export cancelled. You can close this panel while the renderer finishes releasing resources.");
  }, []);

  const exportTrack = async () => {
    if (
      availability !== "available" ||
      exportState === "rendering" ||
      exportState === "encoding" ||
      exportAbortController.current !== null ||
      draining
    ) return;
    const controller = new AbortController();
    const taskId = ++exportTaskId.current;
    exportAbortController.current = controller;
    setExportState("rendering");
    setProgress(0.08);
    setStatus("Rendering mission score…");
    try {
      const result = await exportMissionSoundtrack(seed, missionIndex, ({ phase, progress: nextProgress, phaseProgress }) => {
        if (exportAbortController.current !== controller || exportTaskId.current !== taskId || !mounted.current) return;
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
      if (controller.signal.aborted || exportAbortController.current !== controller || exportTaskId.current !== taskId || !mounted.current) return;
      downloadMusicExport(result);
      setExportState("complete");
      setProgress(1);
      setStatus(`Downloaded ${result.filename}`);
    } catch (error) {
      if (controller.signal.aborted) {
        if (exportAbortController.current === controller && exportTaskId.current === taskId && mounted.current) {
          setExportState("idle");
          setProgress(0);
          setStatus("Export cancelled. You can start it again when ready.");
        }
        return;
      }
      if (exportAbortController.current !== controller || exportTaskId.current !== taskId || !mounted.current) return;
      setExportState("error");
      setProgress(0);
      setStatus(error instanceof Error ? error.message : "Unable to export the mission soundtrack.");
    } finally {
      if (exportAbortController.current === controller) {
        exportAbortController.current = null;
        setDraining(false);
      }
    }
  };

  return {
    availability,
    exportState,
    progress,
    status,
    busy,
    draining,
    cancelExport,
    exportTrack,
  };
}
