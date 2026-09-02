import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./PauseMenu.module.css";

export function PauseMainMenu({
  onResume,
  onSave,
  onExport,
  onLoad,
  onBriefing,
  onRestart,
  onControls,
  onSoundtrack,
  onOptions,
  onMenu,
}: {
  onResume: () => void;
  onSave: () => void;
  onExport: () => void;
  onLoad: () => void;
  onBriefing: () => void;
  onRestart: () => void;
  onControls: () => void;
  onSoundtrack: () => void;
  onOptions: () => void;
  onMenu: () => void;
}) {
  return (
    <>
      <ConsoleLabel>Dynamica Command</ConsoleLabel>
      <h2 id="pause-title" className={styles.title}>Game paused</h2>
      <div className={styles.actions}>
        <ConsoleButton className={styles.action} tooltip="Return to the battlefield" shortcut={SHORTCUT.resume} onClick={onResume}>Resume Mission</ConsoleButton>
        <div className={styles.group}>
          <ConsoleLabel className={styles.groupLabel}>Mission</ConsoleLabel>
          <ConsoleButton className={styles.action} tooltip="Write the current mission to disk" shortcut={SHORTCUT.save} onClick={onSave}>Save Mission</ConsoleButton>
          <ConsoleButton className={styles.action} tooltip="Download a portable JSON save file" onClick={onExport}>Export Save</ConsoleButton>
          <ConsoleButton className={styles.action} tooltip="Restore the last save for this seed" shortcut={SHORTCUT.load} onClick={onLoad}>Load Mission</ConsoleButton>
        </div>
        <div className={styles.group}>
          <ConsoleLabel className={styles.groupLabel}>Operation</ConsoleLabel>
          <ConsoleButton className={styles.action} tooltip="Open the mission briefing" shortcut={SHORTCUT.briefing} onClick={onBriefing}>Mission Briefing</ConsoleButton>
          <ConsoleButton className={styles.action} tooltip="Start this mission over from the beginning" shortcut={SHORTCUT.restart} onClick={onRestart}>Restart Mission</ConsoleButton>
          <ConsoleButton className={styles.action} tooltip="Keyboard and pointer reference" shortcut={SHORTCUT.controls} onClick={onControls}>Controls</ConsoleButton>
        </div>
        <div className={styles.group}>
          <ConsoleLabel className={styles.groupLabel}>Theater</ConsoleLabel>
          <ConsoleButton className={styles.action} tooltip="Render and download the mission soundtrack as an M4A" onClick={onSoundtrack}>Soundtrack</ConsoleButton>
          <ConsoleButton className={styles.action} tooltip="Audio and game options" shortcut={SHORTCUT.options} onClick={onOptions}>Options</ConsoleButton>
          <ConsoleButton muted className={styles.action} tooltip="Leave the theater" shortcut={SHORTCUT.menu} onClick={onMenu}>Main Menu</ConsoleButton>
        </div>
      </div>
    </>
  );
}
