import { ConsoleButton } from "@/components/ui/ConsoleButton";
import type { Formation, Stance } from "@/lib/types";
import { SelectionOrders } from "./SelectionOrders";
import type { MobileCommand } from "./mobileCommandTypes";
import { mobileCommandLabel } from "./MobileCommandDock";
import styles from "./MobileCommandTray.module.css";

const UNIT_COMMANDS = [
  ["move", "Move"],
  ["attack", "Attack"],
  ["attackMove", "A-Move"],
  ["harvest", "Harvest"],
] as const;

export function MobileUnitOrders({
  command,
  selectedCount,
  stance,
  formation,
  onCommand,
  onStop,
  onStance,
  onFormation,
}: {
  command: MobileCommand | null;
  selectedCount: number;
  stance: Stance;
  formation: Formation | undefined;
  onCommand: (command: MobileCommand) => void;
  onStop: () => void;
  onStance: (stance: Stance) => void;
  onFormation: (formation: Formation) => void;
}) {
  return (
    <section className={styles.section} data-testid="mobile-unit-commands">
      <div className={styles.sectionHeader}>
        <span className={styles.eyebrow}>Unit orders</span>
        <span className={styles.activeCommand}>{command ? `${mobileCommandLabel(command)} armed` : "Tap a command, then tap the map"}</span>
      </div>
      <div className={styles.commandGrid}>
        {UNIT_COMMANDS.map(([id, label]) => (
          <ConsoleButton key={id} className={styles.command} data-testid={`mobile-command-${id}`} aria-pressed={command === id} onClick={() => onCommand(id)}>
            {label}
          </ConsoleButton>
        ))}
        <ConsoleButton className={styles.command} data-testid="mobile-command-stop" onClick={onStop}>Stop</ConsoleButton>
      </div>
      {selectedCount === 1 ? (
        <SelectionOrders
          stance={stance}
          formation={formation}
          onStop={onStop}
          onStance={onStance}
          onFormation={onFormation}
        />
      ) : null}
    </section>
  );
}
