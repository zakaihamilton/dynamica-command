import { ConsoleButton } from "@/components/ui/ConsoleButton";
import type { MobileCommand } from "./mobileCommandTypes";
import styles from "./CommandSidebar.module.css";

const COMMANDS: { id: MobileCommand; label: string }[] = [
  { id: "move", label: "Move" },
  { id: "attack", label: "Attack" },
  { id: "attackMove", label: "A-Move" },
  { id: "harvest", label: "Harvest" },
];

export function mobileCommandLabel(command: MobileCommand | null) {
  return COMMANDS.find((item) => item.id === command)?.label ?? "Ready";
}

export function MobileTouchControls({
  selectedCount,
  hasUnitSelection,
  selectionMode,
  activeCommand,
  onCommand,
  onSelectionMode,
  onStop,
}: {
  selectedCount: number;
  hasUnitSelection: boolean;
  selectionMode: boolean;
  activeCommand: MobileCommand | null;
  onCommand: (command: MobileCommand) => void;
  onSelectionMode: (active: boolean) => void;
  onStop: () => void;
}) {
  return (
    <section className={styles.touchControls} data-testid="mobile-touch-controls">
      <div className={styles.touchStatus} aria-live="polite">
        <strong>{selectionMode ? "Select units" : selectedCount > 0 ? `${selectedCount} selected` : "No selection"}</strong>
        <span>{selectionMode ? "Drag a box around friendly units" : activeCommand ? `${mobileCommandLabel(activeCommand)} armed` : "Touch controls"}</span>
      </div>
      <div className={styles.touchActions}>
        <ConsoleButton
          className={styles.touchButton}
          aria-pressed={selectionMode}
          data-testid="mobile-select-mode"
          onClick={() => onSelectionMode(!selectionMode)}
        >
          {selectionMode ? "Cancel" : "Select"}
        </ConsoleButton>
        {hasUnitSelection ? (
          <>
            {COMMANDS.map(({ id, label }) => (
              <ConsoleButton
                key={id}
                className={styles.touchButton}
                aria-pressed={activeCommand === id}
                data-testid={`mobile-command-${id}`}
                onClick={() => onCommand(id)}
              >
                {label}
              </ConsoleButton>
            ))}
            <ConsoleButton className={styles.touchButton} data-testid="mobile-command-stop" onClick={onStop}>
              Stop
            </ConsoleButton>
          </>
        ) : null}
      </div>
    </section>
  );
}
