import type { PointerEventHandler, Ref } from "react";
import type { PanAvailability, PanDir } from "@/lib/render/camera";
import { TICKS_PER_SECOND } from "@/lib/catalog";
import { tutorialPrompt } from "@/lib/sim/tutorial";
import { formatHoldClock, objectiveProgress, secondaryProgress } from "@/lib/sim/objectives";
import type { Campaign, SimState } from "@/lib/types";
import { Battlefield } from "./Battlefield";
import { CombatAlert } from "./CombatAlert";
import { MissionResult } from "./MissionResult";
import { TutorialOverlay } from "./TutorialOverlay";
import { MIN_RENDER_HEIGHT, MIN_RENDER_WIDTH } from "./hooks/useGameCamera";

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
  onAdvanceTutorial,
  onExitTutorial,
  onNextBriefing,
  onCampaignVictory,
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
  onAdvanceTutorial: () => void;
  onExitTutorial: () => void;
  onNextBriefing: () => void;
  onCampaignVictory: () => void;
  onRetry: () => void;
  onMenu: () => void;
  combatAlert?: string | null;
}) {
  const objective = objectiveProgress(state);
  const secondary = secondaryProgress(state).map((item) => `${item.completed ? "✓" : "○"} ${item.label}`);
  const deadline = objective.deadlineTicks === undefined
    ? undefined
    : `Window ${formatHoldClock(Math.ceil(objective.deadlineTicks / TICKS_PER_SECOND))}`;
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
      objective={objective.label}
      deadline={deadline}
      secondary={secondary}
      biome={state.biome}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerUp}
    >
      {combatAlert ? <CombatAlert text={combatAlert} /> : null}
      <MissionResult
        state={state}
        onNextBriefing={onNextBriefing}
        onCampaignVictory={onCampaignVictory}
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
