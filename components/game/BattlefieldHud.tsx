import { formatSeed } from "@/lib/seed/rng";
import styles from "./Battlefield.module.css";

export function BattlefieldHud({
  seed,
  levelNumber,
  levelCount,
  missionName,
  objective,
  deadline,
  stagingWindow,
  secondary,
}: {
  seed: number;
  levelNumber: number;
  levelCount: number;
  missionName: string;
  objective: string;
  deadline?: string;
  stagingWindow?: string;
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
        {deadline ? <div className={styles.deadline}>{deadline}</div> : null}
        {stagingWindow ? <div className={styles.stagingWindow}>{stagingWindow}</div> : null}
        {secondary?.length ? (
          <div className={styles.secondary} data-testid="secondary-objectives">
            {secondary.map((item) => <div key={item}>{item}</div>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
