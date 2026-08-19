import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { Formation, Stance } from "@/lib/types";
import styles from "./SelectionPanel.module.css";

const STANCES: { id: Stance; label: string }[] = [
  { id: "aggressive", label: "Aggressive" },
  { id: "defensive", label: "Defend" },
  { id: "hold", label: "Hold" },
];

const FORMATIONS: { id: Formation; label: string }[] = [
  { id: "line", label: "Line" },
  { id: "column", label: "Column" },
  { id: "wedge", label: "Wedge" },
];

export function SelectionOrders({
  stance,
  formation,
  onStop,
  onStance,
  onFormation,
}: {
  stance: Stance;
  formation: Formation | undefined;
  onStop: () => void;
  onStance: (stance: Stance) => void;
  onFormation: (formation: Formation) => void;
}) {
  return (
    <div className={styles.orders} data-testid="unit-orders">
      <ConsoleButton
        className={styles.order}
        tooltip="Stop selected units"
        shortcut={SHORTCUT.stop}
        aria-keyshortcuts="x"
        onClick={onStop}
      >
        Stop
      </ConsoleButton>
      <div className={styles.orderGroup} role="group" aria-label="Stance">
        {STANCES.map((item) => (
          <ConsoleButton
            key={item.id}
            className={styles.order}
            aria-pressed={stance === item.id}
            muted={stance !== item.id}
            onClick={() => onStance(item.id)}
          >
            {item.label}
          </ConsoleButton>
        ))}
      </div>
      <div className={styles.orderGroup} role="group" aria-label="Formation">
        {FORMATIONS.map((item) => (
          <ConsoleButton
            key={item.id}
            className={styles.order}
            aria-pressed={formation === item.id}
            muted={formation !== item.id}
            onClick={() => onFormation(item.id)}
          >
            {item.label}
          </ConsoleButton>
        ))}
      </div>
    </div>
  );
}
