import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { missionDebrief, type ForceDebrief } from "@/lib/sim/debrief";
import type { SimState } from "@/lib/types";
import type { CSSProperties } from "react";
import styles from "./MissionResult.module.css";

function ForceCard({ label, force }: { label: string; force: ForceDebrief }) {
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

export function MissionResult({
  state,
  onNextBriefing,
  onCampaignVictory,
  onRetry,
  onMenu,
}: {
  state: SimState;
  onNextBriefing: () => void;
  onCampaignVictory: () => void;
  onRetry: () => void;
  onMenu: () => void;
}) {
  if (state.result === "playing") return null;
  const debrief = missionDebrief(state);
  return (
    <div
      className={styles.overlay}
      data-testid="mission-result"
      data-result={state.result}
      style={{ "--result-art": `url("${RASTER_ART[state.result === "won" ? "victory" : "defeat"]}")` } as CSSProperties}
    >
      <MetalPanel className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="mission-result-title">
        <ConsoleLabel>Theater status</ConsoleLabel>
        <h2 id="mission-result-title" className={styles.title}>
          {state.result === "won" ? "Mission complete" : "Mission failed"}
        </h2>
        <p className={styles.mission}>Mission {state.missionIndex + 1} {"//"} {state.missionName}</p>

        <section className={styles.outcome} aria-label="Outcome assessment">
          <ConsoleLabel>Outcome assessment</ConsoleLabel>
          <p className={styles.outcomeText}>{debrief.outcome}</p>
          <p className={styles.objectiveLabel}>Primary objective</p>
          <p className={styles.objectiveHeadline}>{debrief.objective.headline}</p>
          <p className={styles.objectiveProgress}>{debrief.objective.progress}</p>
        </section>

        <section className={styles.section} aria-label="Battle record">
          <ConsoleLabel>Battle record</ConsoleLabel>
          <dl className={styles.metrics}>
            <div><dt>Mission time</dt><dd>{debrief.battle.duration}</dd></div>
            <div><dt>Credits gathered</dt><dd>{debrief.battle.creditsGathered}</dd></div>
            <div><dt>Units trained</dt><dd>{debrief.battle.unitsTrained}</dd></div>
            <div><dt>Structures completed</dt><dd>{debrief.battle.structuresCompleted}</dd></div>
          </dl>
        </section>

        <section className={styles.section} aria-label="Force disposition">
          <ConsoleLabel>Force disposition</ConsoleLabel>
          <div className={styles.forceGrid}>
            <ForceCard label="Friendly" force={debrief.forces.friendly} />
            <ForceCard label="Enemy" force={debrief.forces.enemy} />
          </div>
        </section>

        <div className={styles.actions}>
          {state.result === "won" && state.missionIndex < 7 ? (
            <ConsoleButton tooltip="Advance to the next briefing" shortcut={SHORTCUT.resultPrimary} onClick={onNextBriefing}>
              Next briefing
            </ConsoleButton>
          ) : null}
          {state.result === "won" && state.missionIndex >= 7 ? (
            <ConsoleButton tooltip="Return to the main menu" shortcut={SHORTCUT.resultPrimary} onClick={onCampaignVictory}>
              Campaign victory
            </ConsoleButton>
          ) : null}
          {state.result === "lost" ? (
            <ConsoleButton tooltip="Retry this mission" shortcut={SHORTCUT.resultPrimary} onClick={onRetry}>
              Retry
            </ConsoleButton>
          ) : null}
          <ConsoleButton muted tooltip="Return to the main menu" shortcut={SHORTCUT.resultMenu} onClick={onMenu}>
            Menu
          </ConsoleButton>
        </div>
      </MetalPanel>
    </div>
  );
}
