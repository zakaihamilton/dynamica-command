import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./MenuMainPanel.module.css";

export function MenuMainPanel({
  onNewGame,
  onLoadMission,
  onOptions,
}: {
  onNewGame: () => void;
  onLoadMission: () => void;
  onOptions: () => void;
}) {
  return (
    <MetalPanel as="nav" className={styles.panel} data-testid="menu-dashboard" aria-label="Main menu" aria-labelledby="main-menu-title">
      <div className={styles.panelHeader}>
        <div className={styles.panelHeading}>
          <div>
            <ConsoleLabel>Genesis command // Main menu</ConsoleLabel>
            <h2 id="main-menu-title" className={styles.title}>Main menu</h2>
          </div>
          <span className={styles.status}>READY</span>
        </div>
        <p className={styles.copy}>Deploy a new theater, load a saved mission, or manage your local command link.</p>
      </div>

      <div className={styles.actions}>
        <ConsoleButton className={styles.primaryAction} tooltip="Open campaign setup" shortcut={SHORTCUT.newGame} onClick={onNewGame}>
          NEW GAME
        </ConsoleButton>
        <ConsoleButton muted className={`${styles.utilityAction} ${styles.loadAction}`} tooltip="Open the campaign archive" shortcut={SHORTCUT.load} onClick={onLoadMission}>
          LOAD MISSION
        </ConsoleButton>
        <ConsoleButton muted className={styles.utilityAction} tooltip="Audio and game options" shortcut={SHORTCUT.options} onClick={onOptions}>
          OPTIONS
        </ConsoleButton>
      </div>
    </MetalPanel>
  );
}
