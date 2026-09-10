import { ConsoleButton } from "@/components/ui/ConsoleButton";
import type { TutorialStage } from "@/lib/types";
import styles from "./TutorialOverlay.module.css";

const STAGES: TutorialStage[] = ["select", "move", "harvest", "build", "produce", "attack", "repair", "complete"];

const TARGETS: Record<TutorialStage, string> = {
  select: "Friendly infantry",
  move: "Highlighted ground tile",
  harvest: "Ore field",
  build: "Construction tab",
  produce: "Production tab",
  attack: "Enemy contact",
  repair: "Damaged structure",
  complete: "Command desk",
};

const HINTS: Record<TutorialStage, string> = {
  select: "Selection works with a click or a drag box.",
  move: "Right-click ground to move. Use attack-move when advancing under fire.",
  harvest: "Harvesters only accept ore-field destinations.",
  build: "Power keeps the command center online and unlocks production.",
  produce: "Queue a unit, then use the Selected tab for its stance and formation.",
  attack: "Attack-move advances and engages; direct attack focuses one target.",
  repair: "Repair mode is safe to cancel with Escape or the visible cancel action.",
  complete: "Fog of war hides contacts until your force establishes a sight line.",
};

export function TutorialOverlay({ prompt, complete, stage = "select", onAdvance, onBack }: { prompt: string; complete: boolean; stage?: TutorialStage; onAdvance: () => void; onBack: () => void }) {
  const stageIndex = STAGES.indexOf(stage);
  return (
    <section className={styles.card} role="dialog" aria-label="Training instruction" data-testid="tutorial-overlay" data-stage={stage}>
      <div className={styles.heading}>
        <p className={styles.kicker}>Training range</p>
        <span className={styles.progressLabel}>Step {Math.max(1, stageIndex + 1)} / {STAGES.length}</span>
      </div>
      <div className={styles.progress} aria-label={`Training progress: step ${Math.max(1, stageIndex + 1)} of ${STAGES.length}`}>
        {STAGES.map((item, index) => <span key={item} className={index <= stageIndex ? styles.progressActive : styles.progressPending} aria-hidden="true" />)}
      </div>
      <p className={styles.target}><span aria-hidden="true">◉</span> Next target: <strong>{TARGETS[stage]}</strong></p>
      <p className={styles.prompt}>{prompt}</p>
      <details className={styles.hint}>
        <summary>Context hint</summary>
        <p>{HINTS[stage]}</p>
      </details>
      <div className={styles.actions}>
        <ConsoleButton muted onClick={onBack}>Exit Training</ConsoleButton>
        <ConsoleButton onClick={onAdvance}>{complete ? "Return to command desk" : "Continue"}</ConsoleButton>
      </div>
    </section>
  );
}
