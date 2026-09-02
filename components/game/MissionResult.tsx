"use client";

import { useState, type CSSProperties } from "react";
import { SoundtrackPanel } from "@/components/audio/SoundtrackPanel";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { useModalFocus } from "@/components/ui/useModalFocus";
import { RASTER_ART } from "@/lib/gen/visualAssets";
import { missionDebrief } from "@/lib/sim/debrief";
import type { SimState } from "@/lib/types";
import { MissionBattleRecord, MissionForceDisposition, MissionOutcome } from "./MissionResultSections";
import { MissionResultActions } from "./MissionResultActions";
import styles from "./MissionResult.module.css";

export function MissionResult({
  state,
  onNextBriefing,
  onCampaignVictory,
  onCampaignMap,
  onRetry,
  onMenu,
}: {
  state: SimState;
  onNextBriefing: () => void;
  onCampaignVictory: () => void;
  onCampaignMap: () => void;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const [soundtrackOpen, setSoundtrackOpen] = useState(false);
  const dialogRef = useModalFocus(state.result !== "playing" && !soundtrackOpen, state.result, "dialog");
  if (state.result === "playing") return null;
  const debrief = missionDebrief(state);
  return (
    <div
      className={styles.overlay}
      data-testid="mission-result"
      data-result={state.result}
      style={{ "--result-art": `url("${RASTER_ART[state.result === "won" ? "victory" : "defeat"]}")` } as CSSProperties}
    >
      <MetalPanel
        ref={dialogRef}
        tabIndex={-1}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-result-title"
      >
        <ConsoleLabel>Theater status</ConsoleLabel>
        <h2 id="mission-result-title" className={styles.title}>
          {state.result === "won" ? "Mission complete" : "Mission failed"}
        </h2>
        <p className={styles.mission}>Mission {state.missionIndex + 1} {"//"} {state.missionName}</p>
        <MissionOutcome debrief={debrief} />
        <MissionBattleRecord debrief={debrief} />
        <MissionForceDisposition debrief={debrief} />
        <MissionResultActions
          state={state}
          onNextBriefing={onNextBriefing}
          onCampaignVictory={onCampaignVictory}
          onCampaignMap={onCampaignMap}
          onRetry={onRetry}
          onMenu={onMenu}
          onSoundtrack={() => setSoundtrackOpen(true)}
        />
      </MetalPanel>
      {soundtrackOpen ? <SoundtrackPanel seed={state.seed} missionIndex={state.missionIndex} onClose={() => setSoundtrackOpen(false)} /> : null}
    </div>
  );
}
