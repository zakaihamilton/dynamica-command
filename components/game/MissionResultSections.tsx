import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import type { ForceDebrief, MissionDebrief } from "@/lib/sim/debrief";
import styles from "./MissionResult.module.css";

export function MissionOutcome({ debrief }: { debrief: MissionDebrief }) {
  return (
    <section className={styles.outcome} aria-label="Outcome assessment">
      <ConsoleLabel>Outcome assessment</ConsoleLabel>
      <p className={styles.outcomeText}>{debrief.outcome}</p>
      <div className={styles.resultCard} data-testid="primary-result-card">
        <p className={styles.objectiveLabel}>Primary objective</p>
        <p className={styles.objectiveHeadline}>{debrief.objective.headline}</p>
        <p className={styles.objectiveProgress}>{debrief.objective.progress}</p>
      </div>
      <div className={styles.profileAssessment} data-testid="profile-assessment">
        <p className={styles.objectiveLabel}>Tactical profile</p>
        <p className={styles.profileLabel}>{debrief.tactical.label}</p>
        <p className={styles.profileText}>{debrief.tactical.emphasis}</p>
        <p className={debrief.tactical.completed ? styles.profileComplete : styles.profileIncomplete}>
          {debrief.tactical.completed ? "Profile challenge met." : "Profile challenge not met."}
        </p>
      </div>
      {debrief.secondary.length ? (
        <div className={styles.secondaryList} aria-label="Secondary objectives">
          <p className={styles.objectiveLabel}>Secondary objectives</p>
          {debrief.secondary.map((objective) => (
            <div className={styles.secondaryCard} key={objective.id}>
              <p className={objective.completed ? styles.secondaryComplete : objective.failed ? styles.secondaryFailed : styles.secondaryIncomplete}>
                <span aria-hidden="true">{objective.completed ? "✓" : objective.failed ? "×" : "○"}</span> {objective.completed ? "Complete" : objective.failed ? "Failed" : "Incomplete"}: {objective.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {debrief.retryGuidance ? (
        <div className={styles.retryGuidance} data-testid="retry-guidance">
          <p className={styles.objectiveLabel}>Retry guidance</p>
          <p>{debrief.retryGuidance}</p>
        </div>
      ) : null}
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
        <div><dt>Mission score</dt><dd>{debrief.battle.score}</dd></div>
        <div><dt>Medals</dt><dd>{debrief.battle.medals} / 3</dd></div>
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
