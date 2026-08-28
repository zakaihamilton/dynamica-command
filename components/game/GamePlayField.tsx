import type { PointerEventHandler, Ref } from "react";
import type { PanAvailability, PanDir } from "@/lib/render/camera";
import { tutorialPrompt } from "@/lib/sim/tutorial";
import type { Campaign, SimState } from "@/lib/types";
import { Battlefield } from "./Battlefield";
import { CombatAlert } from "./CombatAlert";
import { MissionResult } from "./MissionResult";
import { TutorialOverlay } from "./TutorialOverlay";
import { MIN_RENDER_HEIGHT, MIN_RENDER_WIDTH } from "./hooks/useGameCamera";
import { playFieldStatus } from "./playFieldStatus";

export function GamePlayField({
  hostRef,
  canvasRef,
  panAvail,
  hotPan,
  campaign,
  state,
  tutorial,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onPointerUp,
  onPointerCancel,
  onAdvanceTutorial,
  onExitTutorial,
  onNextBriefing,
  onCampaignVictory,
  onCampaignMap,
  onRetry,
  onMenu,
  combatAlert,
}: {
  hostRef: Ref<HTMLDivElement>;
  canvasRef: Ref<HTMLCanvasElement>;
  panAvail: PanAvailability;
  hotPan: PanDir | null;
  campaign: Campaign;
  state: SimState;
  tutorial: boolean;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerLeave: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>;
  onAdvanceTutorial: () => void;
  onExitTutorial: () => void;
  onNextBriefing: () => void;
  onCampaignVictory: () => void;
  onCampaignMap: () => void;
  onRetry: () => void;
  onMenu: () => void;
  combatAlert?: string | null;
}) {
  const status = playFieldStatus(state);
  return (
    <Battlefield
      hostRef={hostRef}
      canvasRef={canvasRef}
      width={MIN_RENDER_WIDTH}
      height={MIN_RENDER_HEIGHT}
      panAvail={panAvail}
      hotPan={hotPan}
      seed={state.seed}
      levelNumber={state.missionIndex + 1}
      levelCount={campaign.missions.length}
      missionName={state.missionName}
      objective={status.objective}
      timeRemaining={status.timeRemaining}
      convoyDeparture={status.convoyDeparture}
      secondary={status.secondary}
      biome={state.biome}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {combatAlert ? <CombatAlert text={combatAlert} /> : null}
      <MissionResult
        state={state}
        onNextBriefing={onNextBriefing}
        onCampaignVictory={onCampaignVictory}
        onCampaignMap={onCampaignMap}
        onRetry={onRetry}
        onMenu={onMenu}
      />
      {tutorial ? (
        <TutorialOverlay
          prompt={tutorialPrompt(state)}
          complete={state.tutorialStage === "complete"}
          onAdvance={state.tutorialStage === "complete" ? onExitTutorial : onAdvanceTutorial}
          onSkip={onExitTutorial}
        />
      ) : null}
    </Battlefield>
  );
}
