import { useState } from "react";
import { formatSeed } from "@/lib/seed/rng";
import type { MissionObjective } from "@/lib/gen/story";
import { deadlineUrgency, type ObjectiveCardModel } from "@/lib/ui/missionPresentation";
import styles from "./Battlefield.module.css";

export function BattlefieldHud({
  seed,
  levelNumber,
  levelCount,
  missionName,
  objective,
  profileLabel,
  timeRemaining,
  convoyDeparture,
  briefingObjectives,
  objectiveCards = [],
  phaseLabel,
  timeRemainingTicks,
  timeLimitTicks,
  onObjectivePanelToggle,
}: {
  seed: number;
  levelNumber: number;
  levelCount: number;
  missionName: string;
  objective: string;
  profileLabel?: string;
  timeRemaining?: string;
  convoyDeparture?: string;
  briefingObjectives?: MissionObjective[];
  objectiveCards?: ObjectiveCardModel[];
  phaseLabel?: string;
  timeRemainingTicks?: number;
  timeLimitTicks?: number;
  onObjectivePanelToggle?: () => void;
}) {
  const [directiveExpanded, setDirectiveExpanded] = useState(true);
  const urgency = deadlineUrgency(timeRemainingTicks);
  const timerRatio = timeLimitTicks && timeRemainingTicks !== undefined
    ? Math.max(0, Math.min(1, timeRemainingTicks / timeLimitTicks))
    : undefined;
  const timerGlyph = urgency === "critical" ? "‼" : urgency === "urgent" ? "!" : urgency === "watch" ? "◒" : "◷";
  const timerLabel = urgency === "critical" ? "Critical deadline"
    : urgency === "urgent" ? "Urgent deadline"
      : urgency === "watch" ? "Deadline watch"
        : "Time remaining";
  const timerValue = timeRemaining?.replace(/^Time remaining\s*/, "") ?? "";
  const timerText = urgency === "normal" ? `Time remaining ${timerValue}` : `Time remaining ${timerValue} · ${timerLabel}`;
  const secondaryCards = objectiveCards.filter((card) => !card.primary);
  const toggleDirective = () => {
    setDirectiveExpanded((expanded) => !expanded);
    onObjectivePanelToggle?.();
  };
  return (
    <div className={styles.status} data-testid="battlefield-status" data-urgency={urgency}>
      <div className={styles.statusBackdrop} aria-hidden="true" />
      <div className={styles.operationBar}>
        <div className={styles.missionMeta}>
          <div className={styles.seed} data-testid="seed"><span className={styles.statusGlyph} aria-hidden="true">◆</span> Seed {formatSeed(seed)}</div>
          <div className={styles.level} data-testid="level-progress">
            <span>Operation {levelNumber} of {levelCount}</span>
            <span className={styles.operationTicks} aria-label={`Operation ${levelNumber} of ${levelCount}`}>
              {Array.from({ length: levelCount }, (_, index) => (
                <span key={index} className={index < levelNumber ? styles.operationTickActive : styles.operationTick} aria-hidden="true" />
              ))}
            </span>
          </div>
        </div>
        <div className={styles.mission}>{missionName}</div>
        <div className={styles.operationFoot}>
          {profileLabel ? <div className={styles.profile} data-testid="mission-profile">{profileLabel}</div> : null}
        </div>
      </div>
      <div className={styles.objectiveStack} data-directive-expanded={directiveExpanded ? "true" : "false"}>
        <div className={styles.directiveHeader}>
          <span className={styles.directiveKicker}>Mission directive</span>
          {phaseLabel ? <span className={styles.phase} data-testid="mission-phase"><span className={styles.phaseDot} aria-hidden="true" />{phaseLabel}</span> : null}
          <button
            type="button"
            className={styles.directiveToggle}
            aria-label={`${directiveExpanded ? "Collapse" : "Expand"} mission directive`}
            aria-expanded={directiveExpanded}
            aria-controls="mission-directive-body"
            onClick={toggleDirective}
          >
            <span className={styles.directiveToggleIcon} aria-hidden="true">{directiveExpanded ? "−" : "+"}</span>
          </button>
        </div>
        <div id="mission-directive-body" className={styles.directiveBody} hidden={!directiveExpanded}>
            <div className={styles.objective} data-testid="objective" data-status={objectiveCards[0]?.status ?? "active"}>
              <span className={styles.objectivePriority}><span className={styles.priorityIcon} aria-hidden="true">!</span> Primary objective</span>
              <strong>{objective}</strong>
              {objectiveCards[0] && objectiveCards[0].target > 0 ? (
                <span className={styles.objectiveProgress}>
                  {Math.min(objectiveCards[0].current, objectiveCards[0].target)} / {objectiveCards[0].target}
                  <span className={styles.objectiveBar} aria-hidden="true">
                    <span style={{ width: `${Math.round(Math.max(0, Math.min(1, objectiveCards[0].current / objectiveCards[0].target)) * 100)}%` }} />
                  </span>
                </span>
              ) : null}
            </div>
            {timeRemaining ? (
              <div className={styles.timeRemaining} data-testid="time-remaining" data-urgency={urgency} data-tooltip="Time left to complete the primary objective. The mission fails at 00:00.">
                <span className={styles.timerGlyph} aria-hidden="true">{timerGlyph}</span>
                <span>{timerText}</span>
                {timerRatio !== undefined ? <span className={styles.timerBar} aria-hidden="true"><span style={{ width: `${Math.round(timerRatio * 100)}%` }} /></span> : null}
              </div>
            ) : null}
            {convoyDeparture ? (
              <div className={styles.stagingWindow} data-testid="convoy-departure" data-tooltip="The convoy starts moving at 00:00. This wait is included in the mission time.">
                {convoyDeparture}
              </div>
            ) : null}
            {secondaryCards.length ? (
              <section className={styles.secondaryRail} aria-label="Secondary objectives" data-testid="secondary-objectives">
                <div className={styles.secondaryHeader}>Optional directives <span>{secondaryCards.filter((card) => card.status === "complete").length}/{secondaryCards.length}</span></div>
                <div className={styles.secondaryCards}>
                  {secondaryCards.map((card) => (
                    <div className={styles.secondaryCard} key={card.id} data-status={card.status}>
                      <span className={styles.secondaryIcon} aria-hidden="true">{card.status === "complete" ? "✓" : card.status === "failed" ? "×" : "○"}</span>
                      <span>{card.label}</span>
                      <span className={styles.secondaryState}>{card.status === "complete" ? "Complete" : card.status === "failed" ? "Failed" : "Active"}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {briefingObjectives?.length ? (
              <section className={styles.briefingObjectives} aria-label="Mission objectives" data-testid="battlefield-objectives">
                <details open onToggle={onObjectivePanelToggle}>
                  <summary className={styles.briefingLabel}>Strategic directives</summary>
                  <div className={styles.briefingList}>
                    {briefingObjectives.map((item, index) => (
                      <div className={styles.briefingObjective} key={item.id}>
                        <span className={styles.briefingIndex}>{String(index + 1).padStart(2, "0")}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </section>
            ) : null}
        </div>
      </div>
    </div>
  );
}
