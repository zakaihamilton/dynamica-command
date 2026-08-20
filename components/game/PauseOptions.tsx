import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./PauseMenu.module.css";

export function PauseOptions({
  sfxEnabled,
  musicEnabled,
  onToggleSound,
  onToggleMusic,
  onBack,
  titleId = "pause-title",
  backTooltip = "Return to the pause menu",
}: {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onBack: () => void;
  titleId?: string;
  backTooltip?: string;
}) {
  return (
    <>
      <ConsoleLabel>Options</ConsoleLabel>
      <h2 id={titleId} className={styles.title}>Game options</h2>
      <div className={styles.actions}>
        <ConsoleButton className={styles.action} tooltip="Toggle generated background music" shortcut={SHORTCUT.music} onClick={onToggleMusic}>
          Music: {musicEnabled ? "On" : "Off"}
        </ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Toggle synthesized audio cues" shortcut={SHORTCUT.mute} onClick={onToggleSound}>
          Sound effects: {sfxEnabled ? "On" : "Off"}
        </ConsoleButton>
        <ConsoleButton muted className={styles.action} tooltip={backTooltip} shortcut={SHORTCUT.back} onClick={onBack}>Back</ConsoleButton>
      </div>
    </>
  );
}
