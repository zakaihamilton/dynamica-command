import { ConsoleButton } from "@/components/ui/ConsoleButton";
import styles from "./TutorialOverlay.module.css";

export function TutorialOverlay({ prompt, complete, onAdvance, onSkip, onBack }: { prompt: string; complete: boolean; onAdvance: () => void; onSkip: () => void; onBack: () => void }) {
  return (
    <section className={styles.card} role="dialog" aria-label="Training instruction" data-testid="tutorial-overlay">
      <p className={styles.kicker}>Training range</p>
      <p className={styles.prompt}>{prompt}</p>
      <div className={styles.actions}>
        <ConsoleButton muted onClick={onBack}>Back</ConsoleButton>
        <ConsoleButton onClick={onAdvance}>{complete ? "Deploy to mission 1" : "Continue"}</ConsoleButton>
        <ConsoleButton muted onClick={onSkip}>Skip training</ConsoleButton>
      </div>
    </section>
  );
}
