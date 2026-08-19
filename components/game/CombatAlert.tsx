import styles from "./CombatAlert.module.css";

export function CombatAlert({ text }: { text: string }) {
  return (
    <p className={styles.banner} role="status" data-testid="combat-alert">
      {text}
    </p>
  );
}
