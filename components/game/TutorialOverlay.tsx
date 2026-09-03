import { ConsoleButton } from "@/components/ui/ConsoleButton";
import styles from "./TutorialOverlay.module.css";

export function TutorialOverlay({ prompt, complete, onAdvance, onBack }: { prompt: string; complete: boolean; onAdvance: () => void; onBack: () => void }) {
  return (
    <section className={styles.card} role="dialog" aria-label="Training instruction" data-testid="tutorial-overlay">
      <p className={styles.kicker}>Training range</p>
      <p className={styles.prompt}>{prompt}</p>
      <div className={styles.actions}>
        <ConsoleButton muted onClick={onBack}>Exit Training</ConsoleButton>
        <ConsoleButton onClick={onAdvance}>{complete ? "Return to command desk" : "Continue"}</ConsoleButton>
      </div>
    </section>
  );
}
