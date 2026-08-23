import { ConsoleButton } from "@/components/ui/ConsoleButton";
import type { MobileCommand, MobileSurfaceState } from "./mobileCommandTypes";
import styles from "./MobileCommandTray.module.css";

const COMMANDS: { id: MobileCommand; label: string }[] = [
  { id: "move", label: "Move" },
  { id: "attack", label: "Attack" },
  { id: "attackMove", label: "A-Move" },
  { id: "harvest", label: "Harvest" },
];

export function mobileCommandLabel(command: MobileCommand | null) {
  return COMMANDS.find((item) => item.id === command)?.label ?? "Ready";
}

export function MobileCommandDock({
  surface,
  onCommand,
  onSelectionMode,
  onOpenSheet,
  onPause,
}: {
  surface: MobileSurfaceState;
  onCommand: (command: MobileCommand) => void;
  onSelectionMode: (active: boolean) => void;
  onOpenSheet: () => void;
  onPause: () => void;
}) {
  if (!surface.dockVisible) return null;
  const { activeCommand: command, selectedCount, selectionMode } = surface;
  const hasSelection = selectedCount > 0;
  const hasUnitSelection = surface.sheetContext === "unit" && hasSelection;

  return (
    <nav className={styles.dock} aria-label="Mobile command dock" data-testid="mobile-command-dock">
      <button type="button" className={styles.pause} data-testid="mobile-pause" onClick={onPause} aria-label="Pause mission">
        Pause
      </button>
      <div className={styles.status} aria-live="polite">
        <strong>{selectionMode ? "Select units" : hasSelection ? `${selectedCount} unit${selectedCount === 1 ? "" : "s"}` : "No selection"}</strong>
        {selectionMode ? (
          <span data-testid="mobile-marquee">Drag a box around friendly units</span>
        ) : (
          <span>{command ? `${mobileCommandLabel(command)} active` : "Tap a unit or open commands"}</span>
        )}
      </div>
      <ConsoleButton
        className={styles.control}
        aria-pressed={selectionMode}
        data-testid="mobile-select-mode"
        onClick={() => onSelectionMode(!selectionMode)}
      >
        {selectionMode ? "Cancel" : "Select"}
      </ConsoleButton>
      {hasUnitSelection ? (
        <ConsoleButton className={styles.control} data-testid="mobile-command-move" aria-pressed={command === "move"} onClick={() => onCommand("move")}>
          Move
        </ConsoleButton>
      ) : null}
      <ConsoleButton className={styles.control} data-testid="mobile-command-more" onClick={onOpenSheet}>
        Commands
      </ConsoleButton>
    </nav>
  );
}
