import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { AudioSettingsControls } from "@/components/audio/AudioSettingsControls";
import type { AudioVolumeKey } from "@/lib/audio/mixer";
import type { GameSettings } from "@/lib/persist/settings";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./PauseMenu.module.css";

export function PauseOptions({
  settings,
  onToggleSound,
  onToggleMusic,
  onToggleTacticalRoster,
  onVolumeChange,
  onBack,
  titleId = "pause-title",
  backTooltip = "Return to the pause menu",
}: {
  settings: GameSettings;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onToggleTacticalRoster?: () => void;
  onVolumeChange: (key: AudioVolumeKey, value: number) => void;
  onBack: () => void;
  titleId?: string;
  backTooltip?: string;
}) {
  return (
    <>
      <ConsoleLabel>Options</ConsoleLabel>
      <h2 id={titleId} className={styles.title}>Game options</h2>
      <div className={styles.actions}>
        <ConsoleButton className={styles.action} tooltip="Turn music on or off" shortcut={SHORTCUT.music} onClick={onToggleMusic}>
          Music: {settings.musicEnabled ? "On" : "Off"}
        </ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Turn sound effects on or off" shortcut={SHORTCUT.mute} onClick={onToggleSound}>
          Sound effects: {settings.sfxEnabled ? "On" : "Off"}
        </ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Show a keyboard-friendly unit list beside the battlefield" onClick={onToggleTacticalRoster}>
          Tactical roster: {settings.tacticalRosterEnabled ? "On" : "Off"}
        </ConsoleButton>
        <ConsoleButton muted className={styles.action} tooltip={backTooltip} shortcut={SHORTCUT.back} onClick={onBack}>Back</ConsoleButton>
      </div>
      <AudioSettingsControls settings={settings} onChange={onVolumeChange} />
    </>
  );
}
