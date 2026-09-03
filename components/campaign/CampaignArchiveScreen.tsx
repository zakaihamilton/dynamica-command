"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import {
  cachedLocalStorage,
  listArchiveEntries,
  listUnreadableSaves,
  listUnreadableSlots,
  removeSave,
  removeSlot,
  type ArchiveEntry,
} from "@/lib/persist/save";
import { MenuBackdrop } from "@/components/menu/MenuBackdrop";
import { SaveSlotList } from "@/components/menu/SaveSlotList";
import styles from "./CampaignArchiveScreen.module.css";

export function CampaignArchiveScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [unreadableSaves, setUnreadableSaves] = useState<string[]>([]);
  const [unreadableSlots, setUnreadableSlots] = useState<string[]>([]);

  const refreshSaves = useCallback(() => {
    const storage = cachedLocalStorage();
    setEntries(listArchiveEntries(storage));
    setUnreadableSaves(listUnreadableSaves(storage));
    setUnreadableSlots(listUnreadableSlots(storage));
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

  const deleteEntry = useCallback((entry: ArchiveEntry) => {
    const storage = cachedLocalStorage();
    if (entry.kind === "slot") removeSlot(storage, entry.id);
    else removeSave(storage, Number(entry.seed));
    refreshSaves();
  }, [refreshSaves]);

  const resetUnreadableSave = useCallback((seed: string) => {
    removeSave(cachedLocalStorage(), Number(seed));
    refreshSaves();
  }, [refreshSaves]);

  const resetUnreadableSlot = useCallback((id: string) => {
    removeSlot(cachedLocalStorage(), id);
    refreshSaves();
  }, [refreshSaves]);

  const resumeEntry = useCallback((entry: ArchiveEntry) => {
    if (entry.kind === "slot") {
      router.push(`/play?seed=${entry.seed}&mission=${entry.missionIndex}&slot=${entry.id}`);
      return;
    }
    router.push(`/play?seed=${entry.seed}&resume=1&mission=${entry.missionIndex}`);
  }, [router]);

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
            <span className={styles.topbarMuted}>SAVE SLOTS</span>
          </div>
          <div className={styles.topbarStatus}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>LOCAL SAVE INDEX</span>
          </div>
        </header>

        <div className={styles.content}>
          <MetalPanel as="section" className={styles.panel} data-testid="campaign-archive" aria-labelledby="load-mission-title">
            <header className={styles.header}>
              <ConsoleLabel>Dynamica command // Save slots</ConsoleLabel>
              <h1 id="load-mission-title" className={styles.title}>Load mission</h1>
              <p className={styles.subtitle}>SELECT A SAVE SLOT</p>
              <p className={styles.copy}>Resume a named save or an autosave, inspect its operations map, or remove a slot you no longer need.</p>
            </header>

            <div className={styles.archiveHeader}>
              <ConsoleLabel as="h2">Save slots</ConsoleLabel>
              <div className={styles.archiveControls}>
                <span className={styles.archiveStatus}>{entries.length ? "READY TO RESUME" : "ARCHIVE EMPTY"}</span>
              </div>
            </div>
            <SaveSlotList
              entries={entries}
              emptyLabel="No save slots."
              expanded
              showActions
              onResume={resumeEntry}
              onCampaignMap={(seed) => router.push(`/campaign?seed=${seed}`)}
              onDelete={deleteEntry}
            />

            {unreadableSaves.length || unreadableSlots.length ? (
              <div className={styles.recovery} role="alert">
                {unreadableSaves.length ? (
                  <span>Damaged save{unreadableSaves.length === 1 ? "" : "s"}: {unreadableSaves.join(", ")}</span>
                ) : null}
                {unreadableSlots.length ? (
                  <span>Damaged slot{unreadableSlots.length === 1 ? "" : "s"}: {unreadableSlots.join(", ")}</span>
                ) : null}
                {unreadableSaves.map((seed) => (
                  <ConsoleButton key={seed} tooltip={`Remove damaged save ${seed}`} onClick={() => resetUnreadableSave(seed)}>
                    Reset {seed}
                  </ConsoleButton>
                ))}
                {unreadableSlots.map((id) => (
                  <ConsoleButton key={id} tooltip={`Remove damaged save slot ${id}`} onClick={() => resetUnreadableSlot(id)}>
                    Reset {id.slice(0, 8)}
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
          <span>LOCAL SAVE SLOTS</span>
          <span className={styles.footerRule} aria-hidden="true" />
          <span>RESUME / OPERATIONS / DELETE</span>
          <span className={styles.footerVersion}>ESC TO RETURN</span>
        </footer>
      </div>
    </main>
  );
}
