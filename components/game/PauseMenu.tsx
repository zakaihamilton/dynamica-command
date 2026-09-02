"use client";

import { SoundtrackPanel } from "@/components/audio/SoundtrackPanel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { useModalFocus } from "@/components/ui/useModalFocus";
import type { AudioVolumeKey } from "@/lib/audio/mixer";
import type { GameSettings } from "@/lib/persist/settings";
import type { PauseView } from "@/lib/ui/shortcuts";
import { PauseControls } from "./PauseControls";
import { PauseMainMenu } from "./PauseMainMenu";
import { PauseOptions } from "./PauseOptions";
import styles from "./PauseMenu.module.css";

export function PauseMenu({
  view,
  notice,
  settings,
  seed,
  missionIndex,
  onResume,
  onSave,
  onExport = () => {},
  onLoad,
  onBriefing,
  onRestart,
      onControls,
  onSoundtrack,
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
  seed: number;
  missionIndex: number;
  onResume: () => void;
  onSave: () => void;
  onExport?: () => void;
  onLoad: () => void;
  onBriefing: () => void;
  onRestart: () => void;
  onControls: () => void;
  onSoundtrack: () => void;
  onOptions: () => void;
  onMenu: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onToggleTacticalRoster?: () => void;
  onVolumeChange: (key: AudioVolumeKey, value: number) => void;
  onBack: () => void;
}) {
  const dialogRef = useModalFocus(view !== "soundtrack", view, "dialog");
  return (
    <div className={styles.overlay} data-testid="pause-menu">
      {view === "soundtrack" ? (
        <SoundtrackPanel seed={seed} missionIndex={missionIndex} onClose={onBack} />
      ) : (
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
              onExport={onExport}
              onLoad={onLoad}
              onBriefing={onBriefing}
              onRestart={onRestart}
              onControls={onControls}
              onSoundtrack={onSoundtrack}
              onOptions={onOptions}
              onMenu={onMenu}
            />
          ) : view === "controls" ? (
            <PauseControls onBack={onBack} />
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
      )}
    </div>
  );
}
