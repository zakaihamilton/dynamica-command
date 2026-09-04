"use client";

import { MetalPanel } from "@/components/ui/MetalPanel";
import { useModalFocus } from "@/components/ui/useModalFocus";
import type { AudioVolumeKey } from "@/lib/audio/mixer";
import type { ArchiveEntry, SlotMeta } from "@/lib/persist/save";
import type { GameSettings } from "@/lib/persist/settings";
import type { PauseView } from "@/lib/ui/shortcuts";
import { PauseControls } from "./PauseControls";
import { PauseLoadSlots } from "./PauseLoadSlots";
import { PauseMainMenu } from "./PauseMainMenu";
import { PauseOptions } from "./PauseOptions";
import { PauseSaveSlots } from "./PauseSaveSlots";
import styles from "./PauseMenu.module.css";

export function PauseMenu({
  view,
  notice,
  settings,
  saveSlots,
  loadEntries,
  defaultSlotName,
  onResume,
  onSave,
  onLoad,
  onCommitSave,
  onLoadEntry,
  onDeleteEntry,
  onBriefing,
  onRestart,
  onControls,
  onOptions,
  onMenu,
  onToggleSound,
  onToggleMusic,
  onToggleTacticalRoster,
  onVolumeChange,
  onBack,
}: {
  view: PauseView;
  notice: string;
  settings: GameSettings;
  saveSlots: SlotMeta[];
  loadEntries: ArchiveEntry[];
  defaultSlotName: string;
  onResume: () => void;
  onSave: () => void;
  onLoad: () => void;
  onCommitSave: (name: string, overwriteId: string | null) => boolean;
  onLoadEntry: (entry: ArchiveEntry) => void;
  onDeleteEntry?: (entry: ArchiveEntry) => void;
  onBriefing: () => void;
  onRestart: () => void;
  onControls: () => void;
  onOptions: () => void;
  onMenu: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onToggleTacticalRoster?: () => void;
  onVolumeChange: (key: AudioVolumeKey, value: number) => void;
  onBack: () => void;
}) {
  const dialogRef = useModalFocus(true, view, "dialog");
  return (
    <div className={styles.overlay} data-testid="pause-menu">
      <MetalPanel
        ref={dialogRef}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
      >
        {view === "main" ? (
          <PauseMainMenu
            onResume={onResume}
            onSave={onSave}
            onLoad={onLoad}
            onBriefing={onBriefing}
            onRestart={onRestart}
            onControls={onControls}
            onOptions={onOptions}
            onMenu={onMenu}
          />
        ) : view === "controls" ? (
          <PauseControls onBack={onBack} />
        ) : view === "save" ? (
          <PauseSaveSlots
            defaultName={defaultSlotName}
            slots={saveSlots}
            onCommit={onCommitSave}
            onDelete={onDeleteEntry}
            onBack={onBack}
          />
        ) : view === "load" ? (
          <PauseLoadSlots
            entries={loadEntries}
            onLoad={onLoadEntry}
            onDelete={onDeleteEntry}
            onBack={onBack}
          />
        ) : (
          <PauseOptions
            settings={settings}
            onToggleSound={onToggleSound}
            onToggleMusic={onToggleMusic}
            onToggleTacticalRoster={onToggleTacticalRoster}
            onVolumeChange={onVolumeChange}
            onBack={onBack}
          />
        )}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        <p className={styles.hint}>{view === "main" ? "Escape resumes the mission" : "Escape returns to the pause menu"}</p>
      </MetalPanel>
    </div>
  );
}
