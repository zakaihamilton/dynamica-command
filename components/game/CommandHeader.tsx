import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./CommandSidebar.module.css";

export function CommandHeader({ factionName, onPause }: { factionName: string; onPause: () => void }) {
  return (
    <button
      type="button"
      className={styles.header}
      data-tooltip="Open pause menu"
      data-shortcut={SHORTCUT.pause}
      onClick={onPause}
      aria-label="Open Genesis Command pause menu"
      aria-keyshortcuts="Escape"
    >
      <p className={styles.title}>GENESIS COMMAND</p>
      <p className={styles.faction}>{factionName}</p>
    </button>
  );
}
