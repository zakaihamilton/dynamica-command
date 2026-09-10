import styles from "./CombatAlert.module.css";
import type { CombatAlertKind } from "./hooks/useCombatAlert";

export function CombatAlert({ text, kind = "warning" }: { text: string; kind?: CombatAlertKind }) {
  const urgent = kind === "warning" || kind === "system";
  return (
    <p className={styles.banner} role={urgent ? "alert" : "status"} aria-live={urgent ? "assertive" : "polite"} data-testid="combat-alert" data-kind={kind}>
      <span className={styles.icon} aria-hidden="true">{kind === "objective" ? "◆" : kind === "contact" ? "⌁" : kind === "system" ? "▣" : "!"}</span>
      {text}
    </p>
  );
}
