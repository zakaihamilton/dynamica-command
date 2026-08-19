import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./PauseMenu.module.css";

export function PauseOptions({
  soundEnabled,
  onToggleSound,
  onBack,
}: {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onBack: () => void;
}) {
  return (
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
  );
}
