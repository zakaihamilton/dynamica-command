import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import type { ForceDebrief, MissionDebrief } from "@/lib/sim/debrief";
import styles from "./MissionResult.module.css";

type ObjectiveResult = MissionDebrief["secondary"][number];

function secondaryOutcomeLabel(objective: ObjectiveResult): string {
  if (objective.id === "yard") return objective.completed ? "Command HQ intact" : "Command HQ destroyed";
  if (objective.id === "survivors") return objective.completed ? "Combat unit retained" : "No combat unit survived";
  if (objective.id === "time") {
    const within = objective.label.match(/within (.+?)(?: total)?$/i)?.[1];
    if (within) return objective.completed ? `Operation finished within ${within}` : `Operation not finished within ${within}`;
    return objective.completed ? "Operation finished before the final push" : "Operation not finished before the final push";
  }
  return objective.label;
}

function objectiveState(objective: ObjectiveResult): { label: string; icon: string } {
  if (objective.completed) return { label: "Complete", icon: "✓" };
  if (objective.failed) return { label: "Failed", icon: "×" };
  return { label: "Required", icon: "!" };
}

function ObjectiveRow({ objective, optional = false }: { objective: ObjectiveResult; optional?: boolean }) {
  const state = objectiveState(objective);
  return (
    <div className={styles.objectiveRow} data-status={objective.completed ? "complete" : objective.failed ? "failed" : "active"}>
      <span className={styles.objectiveStatusIcon} aria-hidden="true">{optional && state.label === "Required" ? "○" : state.icon}</span>
      <span className={styles.objectiveRowLabel}>{secondaryOutcomeLabel(objective)}</span>
      <span className={styles.objectiveRowState}>{optional && state.label === "Required" ? "Bonus" : state.label}</span>
    </div>
  );
}

export function MissionOutcome({ debrief }: { debrief: MissionDebrief }) {
  const primaryObjective = debrief.objective;
  const primaryState = debrief.status === "won" ? "complete" : "failed";
  const primaryIcon = primaryState === "complete" ? "✓" : "!";

  return (
    <section className={styles.outcome} aria-label="Outcome assessment" data-status={primaryState}>
      <div className={styles.outcomeSummary}>
        <span className={styles.outcomeIcon} aria-hidden="true">{primaryIcon}</span>
        <p className={styles.outcomeText}>{debrief.outcome}</p>
      </div>

      <div className={styles.resultCard} data-testid="primary-result-card" data-status={primaryState}>
        <div className={styles.resultCardHeader}>
          <p className={styles.objectiveLabel}>Primary objective</p>
          <span className={styles.cardStatus}><span aria-hidden="true">{primaryIcon}</span>{primaryState === "complete" ? "Complete" : "Failed"}</span>
        </div>
        <p className={styles.objectiveHeadline}>{primaryObjective.headline}</p>
        <p className={styles.objectiveProgress}>{primaryObjective.progress}</p>
      </div>

      {debrief.primaryObjectives.length ? (
        <div className={styles.objectiveList} aria-label="Primary objectives" data-testid="required-objectives">
          <div className={styles.listHeader}>
            <span>Primary objectives</span>
            <span>{debrief.primaryObjectives.filter((objective) => objective.completed).length}/{debrief.primaryObjectives.length}</span>
          </div>
          {debrief.primaryObjectives.map((objective) => <ObjectiveRow key={objective.id} objective={objective} />)}
        </div>
      ) : null}

      {debrief.optionalObjectives.length ? (
        <div className={styles.objectiveList} aria-label="Optional objectives" data-testid="optional-objectives">
          <div className={styles.listHeader}>
            <span>Bonus objectives</span>
            <span>{debrief.optionalObjectives.filter((objective) => objective.completed).length}/{debrief.optionalObjectives.length}</span>
          </div>
          {debrief.optionalObjectives.map((objective) => <ObjectiveRow key={objective.id} objective={objective} optional />)}
        </div>
      ) : null}

      <details className={styles.disclosure} data-testid="profile-assessment" open>
        <summary>
          <span>Tactical profile</span>
          <span className={styles.disclosureValue}>{debrief.tactical.label} · {debrief.tactical.completed ? "Met" : "Not met"}</span>
        </summary>
        <div className={styles.disclosureBody}>
          <p>{debrief.tactical.emphasis}</p>
        </div>
      </details>

      {debrief.retryGuidance ? (
        <details className={styles.disclosure} data-testid="retry-guidance" open>
          <summary>
            <span>Retry guidance</span>
            <span className={styles.disclosureValue}>How to improve</span>
          </summary>
          <div className={styles.disclosureBody}><p>{debrief.retryGuidance}</p></div>
        </details>
      ) : null}
    </section>
  );
}

export function MissionBattleRecord({ debrief }: { debrief: MissionDebrief }) {
  return (
    <section className={styles.section} aria-label="Battle record" data-testid="battle-record">
      <div className={styles.sectionHeader}>
        <ConsoleLabel>Battle record</ConsoleLabel>
      </div>
      <dl className={styles.metrics}>
        <div><dt>Time</dt><dd>{debrief.battle.duration}</dd></div>
        <div><dt>Credits</dt><dd>{debrief.battle.creditsGathered}</dd></div>
        <div><dt>Trained</dt><dd>{debrief.battle.unitsTrained}</dd></div>
        <div><dt>Built</dt><dd>{debrief.battle.structuresCompleted}</dd></div>
        <div><dt>Score</dt><dd>{debrief.battle.score}</dd></div>
        <div><dt>Medals</dt><dd>{debrief.battle.medals} / 3</dd></div>
      </dl>
    </section>
  );
}

export function MissionForceCard({ label, force }: { label: string; force: ForceDebrief }) {
  return (
    <div className={styles.forceCard} data-force={label.toLowerCase()}>
      <h3><span className={styles.forceMark} aria-hidden="true" />{label}</h3>
      <dl>
        <div><dt>Units</dt><dd>{force.unitsRemaining} <small>left</small></dd></div>
        <div><dt>Structures</dt><dd>{force.buildingsRemaining} <small>left</small></dd></div>
        <div><dt>Losses</dt><dd>{force.unitsLost}u · {force.buildingsLost}s</dd></div>
      </dl>
    </div>
  );
}

export function MissionForceDisposition({ debrief }: { debrief: MissionDebrief }) {
  return (
    <section className={styles.section} aria-label="Force disposition" data-testid="force-disposition">
      <div className={styles.sectionHeader}>
        <ConsoleLabel>Forces</ConsoleLabel>
      </div>
      <div className={styles.forceGrid}>
        <MissionForceCard label="Friendly" force={debrief.forces.friendly} />
        <MissionForceCard label="Enemy" force={debrief.forces.enemy} />
      </div>
    </section>
  );
}
