"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { cachedLocalStorage, hasSaveForSeed, listSaves, listUnreadableSaves, parseSaveExport, removeSave, type ParsedSaveExport } from "@/lib/persist/save";
import { importSaveAtomically } from "@/lib/persist/saveTransfer";
import { MenuBackdrop } from "@/components/menu/MenuBackdrop";
import { ResumeList } from "@/components/menu/ResumeList";
import { SaveImportDialog } from "@/components/menu/SaveImportDialog";
import { formatSeed } from "@/lib/seed/rng";
import styles from "./CampaignArchiveScreen.module.css";

type Save = ReturnType<typeof listSaves>[number];

export function CampaignArchiveScreen() {
  const router = useRouter();
  const [saves, setSaves] = useState<Save[]>([]);
  const [unreadableSaves, setUnreadableSaves] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    save: ParsedSaveExport;
    collision: boolean;
  } | null>(null);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const refreshSaves = useCallback(() => {
    const storage = cachedLocalStorage();
    setSaves(listSaves(storage));
    setUnreadableSaves(listUnreadableSaves(storage));
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(refreshSaves);
    return () => cancelAnimationFrame(frame);
  }, [refreshSaves]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      router.push("/");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const deleteSave = useCallback((seed: string) => {
    removeSave(cachedLocalStorage(), Number(seed));
    refreshSaves();
  }, [refreshSaves]);

  const resetUnreadableSave = useCallback((seed: string) => {
    removeSave(cachedLocalStorage(), Number(seed));
    refreshSaves();
  }, [refreshSaves]);

  const handleImportFile = useCallback(async (file: File) => {
    setImportError("");
    setImportNotice("");
    try {
      const parsed = parseSaveExport(await file.text());
      const collision = hasSaveForSeed(cachedLocalStorage(), parsed.state.seed);
      setImportPreview({ fileName: file.name, save: parsed, collision });
    } catch (cause) {
      setImportPreview(null);
      setImportError(cause instanceof Error ? cause.message : "Couldn't read that save file.");
    }
  }, []);

  const confirmImport = useCallback(() => {
    if (!importPreview) return;
    const imported = importSaveAtomically(cachedLocalStorage(), importPreview.save);
    if (!imported) {
      setImportError("Couldn't save this campaign on this device.");
      return;
    }
    setImportPreview(null);
    setImportNotice(`Imported campaign ${formatSeed(importPreview.save.state.seed)}. Choose Resume or Operations when ready.`);
    refreshSaves();
  }, [importPreview, refreshSaves]);

  const cancelImport = useCallback(() => {
    setImportPreview(null);
    setImportError("");
  }, []);

  return (
    <main
      className={styles.screen}
      style={{ "--scene-art": `url("${RASTER_ART.menu}")` } as React.CSSProperties}
      data-testid="campaign-archive-screen"
    >
      <MenuBackdrop />
      <div className={styles.vignette} />
      <div className={styles.scanlines} />

      <div className={styles.uiLayer}>
        <header className={styles.topbar} aria-label="Dynamica campaign archive status">
          <div className={styles.topbarBrand}>
            <span className={styles.brandMark}>DC</span>
            <span>DYNAMICA COMMAND</span>
            <span className={styles.topbarDivider}>/</span>
            <span className={styles.topbarMuted}>CAMPAIGN ARCHIVE</span>
          </div>
          <div className={styles.topbarStatus}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>SAVES ON THIS DEVICE</span>
          </div>
        </header>

        <div className={styles.content}>
          <MetalPanel as="section" className={styles.panel} data-testid="campaign-archive" aria-labelledby="load-mission-title">
            <header className={styles.header}>
              <ConsoleLabel>Dynamica command // Campaign archive</ConsoleLabel>
              <h1 id="load-mission-title" className={styles.title}>Load mission</h1>
              <p className={styles.subtitle}>SELECT A SAVED THEATER</p>
              <p className={styles.copy}>Resume a local mission, inspect its operations map, or remove an archive you no longer need.</p>
            </header>

            <div className={styles.summary} aria-label="Campaign archive summary">
              <div>
                <span>Stored theaters</span>
                <strong>{saves.length}</strong>
              </div>
              <div>
                <span>Damaged saves</span>
                <strong className={unreadableSaves.length ? styles.alertValue : undefined}>{unreadableSaves.length}</strong>
              </div>
            </div>

            <div className={styles.archiveHeader}>
              <ConsoleLabel as="h2">Campaign archive</ConsoleLabel>
              <div className={styles.archiveControls}>
                <span className={styles.archiveStatus}>{saves.length ? "READY TO RESUME" : "ARCHIVE EMPTY"}</span>
                <ConsoleButton muted className={styles.importButton} onClick={() => importInputRef.current?.click()} tooltip="Import a Dynamica Command save file">
                  IMPORT SAVE
                </ConsoleButton>
                <input
                  ref={importInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="application/json,.json"
                  aria-label="Choose a Dynamica Command save file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void handleImportFile(file);
                  }}
                />
              </div>
            </div>
            {importError ? <p className={styles.importError} role="alert">{importError}</p> : null}
            {importNotice ? <p className={styles.importNotice} role="status">{importNotice}</p> : null}
            <ResumeList
              saves={saves}
              showHeading={false}
              expanded
              onResume={(seed) => router.push(`/play?seed=${seed}&resume=1`)}
              onCampaignMap={(seed) => router.push(`/campaign?seed=${seed}`)}
              onDelete={deleteSave}
            />

            {unreadableSaves.length ? (
              <div className={styles.recovery} role="alert">
                <span>Damaged save{unreadableSaves.length === 1 ? "" : "s"}: {unreadableSaves.join(", ")}</span>
                {unreadableSaves.map((seed) => (
                  <ConsoleButton key={seed} tooltip={`Remove damaged save ${seed}`} onClick={() => resetUnreadableSave(seed)}>
                    Reset {seed}
                  </ConsoleButton>
                ))}
              </div>
            ) : null}

            <div className={styles.actions}>
              <ConsoleButton muted onClick={() => router.push("/")} tooltip="Return to the main menu" shortcut="Esc">
                Return to menu
              </ConsoleButton>
            </div>
          </MetalPanel>
        </div>

        <footer className={styles.footer}>
          <span>SAVED ON THIS DEVICE</span>
          <span className={styles.footerRule} aria-hidden="true" />
          <span>RESUME / OPERATIONS / DELETE</span>
          <span className={styles.footerVersion}>ESC TO RETURN</span>
        </footer>
      </div>
      {importPreview ? (
        <SaveImportDialog
          fileName={importPreview.fileName}
          save={importPreview.save}
          collision={importPreview.collision}
          error={importError}
          onConfirm={confirmImport}
          onCancel={cancelImport}
        />
      ) : null}
    </main>
  );
}
