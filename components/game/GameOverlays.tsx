import type { Ref } from "react";
import { powerBreakdown } from "@/lib/sim/world";
import { shouldShowCommandSidebar } from "@/lib/sim/debrief";
import type { GameSettings } from "@/lib/persist/settings";
import type { Campaign, Entity, FactionVisualProfile, Palette, SimState } from "@/lib/types";
import type { CommandTab, PauseView } from "@/lib/ui/shortcuts";
import { CommandSidebar } from "./CommandSidebar";
import { MobileCommandTray } from "./MobileCommandTray";
import { PauseMenu } from "./PauseMenu";
import type { GameActions } from "./hooks/useGameActions";
import type { GameCamera } from "./hooks/useGameCamera";
import type { GameSession } from "./hooks/useGameSession";

export function GameOverlays({
  campaign,
  state,
  playerVisualProfile,
  selectedIds,
  miniRef,
  activeTab,
  onTab,
  paused,
  pauseView,
  pauseNotice,
  audioSettings,
  camera,
  setPauseView,
  setPauseNotice,
  actions,
  session,
}: {
  campaign: Campaign;
  state: SimState;
  playerVisualProfile: FactionVisualProfile;
  selectedIds: number[];
  miniRef: Ref<HTMLCanvasElement>;
  activeTab: CommandTab;
  onTab: (tab: CommandTab) => void;
  paused: boolean;
  pauseView: PauseView;
  pauseNotice: string;
  audioSettings: GameSettings;
  camera: GameCamera;
  setPauseView: (view: PauseView) => void;
  setPauseNotice: (notice: string) => void;
  actions: GameActions;
  session: GameSession;
}) {
  const palette: Palette = state.factions[0].palette;
  const selected = state.entities.find((entity: Entity) => selectedIds.includes(entity.id) && entity.hp > 0);
  const grid = powerBreakdown(state, 0);

  return (
    <>
      <MobileCommandTray
        command={actions.mobileCommandState}
        onCommand={actions.chooseMobileCommand}
        onStop={() => actions.issueSelectedCommand("stop")}
        onRepair={actions.toggleRepair}
        onSell={actions.toggleSell}
        onStance={(stance) => actions.issueSelectedCommand("stance", stance)}
        onFormation={(formation) => actions.issueSelectedCommand("formation", formation)}
        onCancel={actions.cancelMobileCommand}
      />

      {shouldShowCommandSidebar(state.result) ? (
        <CommandSidebar
          factionName={campaign.factions[0].name}
          state={state}
          palette={palette}
          profile={playerVisualProfile}
          selected={selected}
          placeKind={actions.placeKind}
          repairMode={actions.repairMode}
          sellMode={actions.sellMode}
          activeTab={activeTab}
          power={grid.surplus}
          produced={grid.produced}
          used={grid.used}
          miniRef={miniRef}
          onPause={session.openPauseMenu}
          onMinimapPointerDown={camera.onMinimapPointerDown}
          onMinimapPointerMove={camera.onMinimapPointerMove}
          onMinimapPointerUp={camera.onMinimapPointerUp}
          isMinimapDragging={camera.isMinimapDragging}
          onTab={onTab}
          onRepair={actions.toggleRepair}
          onSell={actions.toggleSell}
          onPlace={actions.togglePlace}
          onCancelBuilding={actions.cancelBuilding}
          onQueueUnit={actions.queueUnit}
          onCancelUnit={actions.cancelUnit}
          availableProducer={actions.availableProducer}
          onStop={() => actions.issueSelectedCommand("stop")}
          onStance={(stance) => actions.issueSelectedCommand("stance", stance)}
          onFormation={(formation) => actions.issueSelectedCommand("formation", formation)}
        />
      ) : null}

      {paused ? (
        <PauseMenu
          view={pauseView}
          notice={pauseNotice}
          settings={audioSettings}
          palette={palette}
          onResume={session.resumeMission}
          onSave={session.saveMission}
          onLoad={session.loadMission}
          onBriefing={session.viewMissionBriefing}
          onRestart={session.restartMission}
          onAssets={() => {
            setPauseView("assets");
            setPauseNotice("");
          }}
          onOptions={() => {
            setPauseView("options");
            setPauseNotice("");
          }}
          onMenu={session.goMenu}
          onToggleSound={session.toggleSound}
          onToggleMusic={session.toggleMusic}
          onVolumeChange={session.updateVolume}
          onBack={() => setPauseView("main")}
          onCloseAssets={() => setPauseView("main")}
        />
      ) : null}
    </>
  );
}
