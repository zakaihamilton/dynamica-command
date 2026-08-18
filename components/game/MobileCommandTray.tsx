import type { Formation, Stance } from "@/lib/types";
import styles from "./MobileCommandTray.module.css";

export type MobileCommand = "move" | "attack" | "attackMove" | "harvest";

export function MobileCommandTray({
  command,
  onCommand,
  onStop,
  onRepair,
  onSell,
  onStance,
  onFormation,
  onCancel,
}: {
  command: MobileCommand | null;
  onCommand: (command: MobileCommand) => void;
  onStop: () => void;
  onRepair: () => void;
  onSell: () => void;
  onStance: (stance: Stance) => void;
  onFormation: (formation: Formation) => void;
  onCancel: () => void;
}) {
  return (
    <nav className={styles.tray} aria-label="Touch commands">
      {(["move", "attack", "attackMove", "harvest"] as const).map((item) => (
        <button key={item} type="button" className={styles.button} aria-pressed={command === item} onClick={() => onCommand(item)}>
          {item === "attackMove" ? "A-Move" : item}
        </button>
      ))}
      <button type="button" className={styles.button} onClick={onStop}>Stop</button>
      <button type="button" className={styles.button} onClick={onRepair}>Repair</button>
      <button type="button" className={styles.button} onClick={onSell}>Sell</button>
      <button type="button" className={styles.button} onClick={() => onStance("defensive")}>Defend</button>
      <button type="button" className={styles.button} onClick={() => onStance("hold")}>Hold</button>
      <button type="button" className={styles.button} onClick={() => onFormation("line")}>Line</button>
      <button type="button" className={styles.button} onClick={() => onFormation("wedge")}>Wedge</button>
      <button type="button" className={styles.cancel} onClick={onCancel}>Cancel</button>
    </nav>
  );
}
