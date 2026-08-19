import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import type { ForceDebrief, MissionDebrief } from "@/lib/sim/debrief";
import styles from "./MissionResult.module.css";

export function MissionOutcome({ debrief }: { debrief: MissionDebrief }) {
  return (
    <section className={styles.outcome} aria-label="Outcome assessment">
      <ConsoleLabel>Outcome assessment</ConsoleLabel>
      <p className={styles.outcomeText}>{debrief.outcome}</p>
      <p className={styles.objectiveLabel}>Primary objective</p>
      <p className={styles.objectiveHeadline}>{debrief.objective.headline}</p>
      <p className={styles.objectiveProgress}>{debrief.objective.progress}</p>
    </section>
  );
}

export function MissionBattleRecord({ debrief }: { debrief: MissionDebrief }) {
  return (
    <section className={styles.section} aria-label="Battle record">
      <ConsoleLabel>Battle record</ConsoleLabel>
      <dl className={styles.metrics}>
        <div><dt>Mission time</dt><dd>{debrief.battle.duration}</dd></div>
        <div><dt>Credits gathered</dt><dd>{debrief.battle.creditsGathered}</dd></div>
        <div><dt>Units trained</dt><dd>{debrief.battle.unitsTrained}</dd></div>
        <div><dt>Structures completed</dt><dd>{debrief.battle.structuresCompleted}</dd></div>
      </dl>
    </section>
  );
}

export function MissionForceCard({ label, force }: { label: string; force: ForceDebrief }) {
  return (
    <div className={styles.forceCard}>
      <h3>{label}</h3>
      <dl>
        <div>
          <dt>Units remaining</dt>
          <dd>{force.unitsRemaining}</dd>
        </div>
        <div>
          <dt>Structures remaining</dt>
          <dd>{force.buildingsRemaining}</dd>
        </div>
        <div>
          <dt>Units lost</dt>
          <dd>{force.unitsLost}</dd>
        </div>
        <div>
          <dt>Structures lost</dt>
          <dd>{force.buildingsLost}</dd>
        </div>
      </dl>
    </div>
  );
}

export function MissionForceDisposition({ debrief }: { debrief: MissionDebrief }) {
  return (
    <section className={styles.section} aria-label="Force disposition">
      <ConsoleLabel>Force disposition</ConsoleLabel>
      <div className={styles.forceGrid}>
        <MissionForceCard label="Friendly" force={debrief.forces.friendly} />
        <MissionForceCard label="Enemy" force={debrief.forces.enemy} />
      </div>
    </section>
  );
}
