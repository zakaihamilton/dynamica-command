import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import type { MissionObjective } from "@/lib/gen/story";
import styles from "./BriefingObjectives.module.css";

export function BriefingObjectives({
  objectives,
  revealed,
}: {
  objectives: MissionObjective[];
  revealed: boolean;
}) {
  return (
    <section className={styles.section} data-testid="mission-objectives">
      <ConsoleLabel>Mission objectives</ConsoleLabel>
      <ol className={styles.list}>
        {objectives.map((obj, i) => (
          <li key={obj.id} className={styles.item}>
            <span className={styles.index}>{String(i + 1).padStart(2, "0")}</span>
            <span>{obj.text}</span>
          </li>
        ))}
      </ol>
      {!revealed ? (
        <p className={styles.decrypting}>Decrypting remaining orders…</p>
      ) : null}
    </section>
  );
}
