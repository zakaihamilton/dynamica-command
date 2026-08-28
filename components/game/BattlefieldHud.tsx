import { formatSeed } from "@/lib/seed/rng";
import styles from "./Battlefield.module.css";

export function BattlefieldHud({
  seed,
  levelNumber,
  levelCount,
  missionName,
  objective,
  timeRemaining,
  convoyDeparture,
  secondary,
}: {
  seed: number;
  levelNumber: number;
  levelCount: number;
  missionName: string;
  objective: string;
  timeRemaining?: string;
  convoyDeparture?: string;
  secondary?: string[];
}) {
  return (
    <div className={styles.status}>
      <div>
        <div className={styles.missionMeta}>
          <div className={styles.seed} data-testid="seed">Seed {formatSeed(seed)}</div>
          <div className={styles.level} data-testid="level-progress">
            Level {levelNumber} of {levelCount}
          </div>
        </div>
        <div className={styles.mission}>{missionName}</div>
      </div>
      <div className={styles.objectiveStack}>
        <div className={styles.objective} data-testid="objective">
          {objective}
        </div>
        {timeRemaining ? (
          <div className={styles.timeRemaining} data-testid="time-remaining" data-tooltip="Time remaining: the total time left to complete the primary objective. The mission fails when it reaches 00:00.">
            {timeRemaining}
          </div>
        ) : null}
        {convoyDeparture ? (
          <div className={styles.stagingWindow} data-testid="convoy-departure" data-tooltip="Convoy departure: the convoy begins moving at 00:00. This staging time is included in the total mission time.">
            {convoyDeparture}
          </div>
        ) : null}
        {secondary?.length ? (
          <div className={styles.secondary} data-testid="secondary-objectives">
            {secondary.map((item) => <div key={item}>{item}</div>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
