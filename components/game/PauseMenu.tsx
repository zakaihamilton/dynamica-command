import { AssetsBrowser } from "@/components/assets/AssetsBrowser";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { Palette } from "@/lib/types";
import styles from "./PauseMenu.module.css";

export function PauseMenu({
  view,
  notice,
  soundEnabled,
  palette,
  onResume,
  onSave,
  onLoad,
  onBriefing,
  onAssets,
  onOptions,
  onMenu,
  onToggleSound,
  onBack,
  onCloseAssets,
}: {
  view: "main" | "options" | "assets";
  notice: string;
  soundEnabled: boolean;
  palette: Palette;
  onResume: () => void;
  onSave: () => void;
  onLoad: () => void;
  onBriefing: () => void;
  onAssets: () => void;
  onOptions: () => void;
  onMenu: () => void;
  onToggleSound: () => void;
  onBack: () => void;
  onCloseAssets: () => void;
}) {
  return (
    <div className={styles.overlay} data-testid="pause-menu">
      {view === "assets" ? (
        <AssetsBrowser palette={palette} onClose={onCloseAssets} />
      ) : (
        <MetalPanel className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="pause-title">
          {view === "main" ? (
            <>
              <ConsoleLabel>Genesis Command</ConsoleLabel>
              <h2 id="pause-title" className={styles.title}>Game paused</h2>
              <div className={styles.actions}>
                <ConsoleButton className={styles.action} tooltip="Return to the battlefield" shortcut={SHORTCUT.resume} onClick={onResume}>Resume Mission</ConsoleButton>
                <ConsoleButton className={styles.action} tooltip="Write the current mission to disk" shortcut={SHORTCUT.save} onClick={onSave}>Save Mission</ConsoleButton>
                <ConsoleButton className={styles.action} tooltip="Restore the last save for this seed" shortcut={SHORTCUT.load} onClick={onLoad}>Load Mission</ConsoleButton>
                <ConsoleButton className={styles.action} tooltip="Open the mission briefing" shortcut={SHORTCUT.briefing} onClick={onBriefing}>Mission Briefing</ConsoleButton>
                <ConsoleButton className={styles.action} tooltip="Inspect generated sprites and animations" shortcut={SHORTCUT.assets} onClick={onAssets}>Assets</ConsoleButton>
                <ConsoleButton className={styles.action} tooltip="Audio and game options" shortcut={SHORTCUT.options} onClick={onOptions}>Options</ConsoleButton>
                <ConsoleButton muted className={styles.action} tooltip="Leave the theater" shortcut={SHORTCUT.menu} onClick={onMenu}>Escape to Menu</ConsoleButton>
              </div>
            </>
          ) : (
            <>
              <ConsoleLabel>Options</ConsoleLabel>
              <h2 id="pause-title" className={styles.title}>Game options</h2>
              <div className={styles.actions}>
                <ConsoleButton className={styles.action} tooltip="Toggle synthesized audio cues" shortcut={SHORTCUT.mute} onClick={onToggleSound}>
                  Audio feedback: {soundEnabled ? "On" : "Off"}
                </ConsoleButton>
                <ConsoleButton muted className={styles.action} tooltip="Return to the pause menu" shortcut={SHORTCUT.back} onClick={onBack}>Back</ConsoleButton>
              </div>
            </>
          )}
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
          <p className={styles.hint}>{view === "main" ? "Escape resumes the mission" : "Escape returns to the pause menu"}</p>
        </MetalPanel>
      )}
    </div>
  );
}
