import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./PauseMenu.module.css";

export function PauseMainMenu({
  onResume,
  onSave,
  onLoad,
  onBriefing,
  onRestart,
  onAssets,
  onOptions,
  onMenu,
}: {
  onResume: () => void;
  onSave: () => void;
  onLoad: () => void;
  onBriefing: () => void;
  onRestart: () => void;
  onAssets: () => void;
  onOptions: () => void;
  onMenu: () => void;
}) {
  return (
    <>
      <ConsoleLabel>Genesis Command</ConsoleLabel>
      <h2 id="pause-title" className={styles.title}>Game paused</h2>
      <div className={styles.actions}>
        <ConsoleButton className={styles.action} tooltip="Return to the battlefield" shortcut={SHORTCUT.resume} onClick={onResume}>Resume Mission</ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Write the current mission to disk" shortcut={SHORTCUT.save} onClick={onSave}>Save Mission</ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Restore the last save for this seed" shortcut={SHORTCUT.load} onClick={onLoad}>Load Mission</ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Open the mission briefing" shortcut={SHORTCUT.briefing} onClick={onBriefing}>Mission Briefing</ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Start this mission over from the beginning" shortcut={SHORTCUT.restart} onClick={onRestart}>Restart Mission</ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Inspect generated sprites and animations" shortcut={SHORTCUT.assets} onClick={onAssets}>Assets</ConsoleButton>
        <ConsoleButton className={styles.action} tooltip="Audio and game options" shortcut={SHORTCUT.options} onClick={onOptions}>Options</ConsoleButton>
        <ConsoleButton muted className={styles.action} tooltip="Leave the theater" shortcut={SHORTCUT.menu} onClick={onMenu}>Escape to Menu</ConsoleButton>
      </div>
    </>
  );
}
