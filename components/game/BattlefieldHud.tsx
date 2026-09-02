import { formatSeed } from "@/lib/seed/rng";
import type { MissionObjective } from "@/lib/gen/story";
import styles from "./Battlefield.module.css";

export function BattlefieldHud({
  seed,
  levelNumber,
  levelCount,
  missionName,
  objective,
  timeRemaining,
  convoyDeparture,
  briefingObjectives,
}: {
  seed: number;
  levelNumber: number;
  levelCount: number;
  missionName: string;
  objective: string;
  timeRemaining?: string;
  convoyDeparture?: string;
  briefingObjectives?: MissionObjective[];
}) {
  return (
    <div className={styles.status}>
      <div>
        <div className={styles.missionMeta}>
          <div className={styles.seed} data-testid="seed">Seed {formatSeed(seed)}</div>
          <div className={styles.level} data-testid="level-progress">
            Operation {levelNumber} of {levelCount}
          </div>
        </div>
        <div className={styles.mission}>{missionName}</div>
      </div>
      <div className={styles.objectiveStack}>
        <div className={styles.objective} data-testid="objective">
          {objective}
        </div>
        {timeRemaining ? (
          <div className={styles.timeRemaining} data-testid="time-remaining" data-tooltip="Time left to complete the primary objective. The mission fails at 00:00.">
            {timeRemaining}
          </div>
        ) : null}
        {convoyDeparture ? (
          <div className={styles.stagingWindow} data-testid="convoy-departure" data-tooltip="The convoy starts moving at 00:00. This wait is included in the mission time.">
            {convoyDeparture}
          </div>
        ) : null}
        {briefingObjectives?.length ? (
          <section className={styles.briefingObjectives} aria-label="Mission objectives" data-testid="battlefield-objectives">
            <div className={styles.briefingLabel}>Mission objectives</div>
            {briefingObjectives.map((item, index) => (
              <div className={styles.briefingObjective} key={item.id}>
                <span className={styles.briefingIndex}>{String(index + 1).padStart(2, "0")}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
