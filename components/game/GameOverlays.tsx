import type { Ref } from "react";
import { powerBreakdown } from "@/lib/sim/world";
import { shouldShowCommandSidebar } from "@/lib/sim/debrief";
import type { GameSettings } from "@/lib/persist/settings";
import type { Campaign, Entity, FactionVisualProfile, Palette, SimState } from "@/lib/types";
import type { CommandTab, PauseView } from "@/lib/ui/shortcuts";
import { CommandSidebar } from "./CommandSidebar";
import { MobileCommandDock, MobileCommandSheet, type MobileSurfaceState } from "./MobileCommandTray";
import { PauseMenu } from "./PauseMenu";
import type { GameActions } from "./hooks/useGameActions";
import type { GameCamera } from "./hooks/useGameCamera";
import type { GameSession } from "./hooks/useGameSession";

export function GameOverlays({
  campaign,
  state,
  playerVisualProfile,
  selectedIds,
  tutorial,
  selectionMode,
  mobileSheetOpen,
  miniRef,
  mobileMiniRef,
  activeTab,
  onTab,
  paused,
  pauseView,
  pauseNotice,
  audioSettings,
  camera,
  setPauseView,
  setPauseNotice,
  onSelectionMode,
  onOpenMobileSheet,
  onCloseMobileSheet,
  actions,
  session,
}: {
  campaign: Campaign;
  state: SimState;
  playerVisualProfile: FactionVisualProfile;
  selectedIds: number[];
  tutorial: boolean;
  selectionMode: boolean;
  mobileSheetOpen: boolean;
  miniRef: Ref<HTMLCanvasElement>;
  mobileMiniRef: Ref<HTMLCanvasElement>;
  activeTab: CommandTab;
  onTab: (tab: CommandTab) => void;
  paused: boolean;
  pauseView: PauseView;
  pauseNotice: string;
  audioSettings: GameSettings;
  camera: GameCamera;
  setPauseView: (view: PauseView) => void;
  setPauseNotice: (notice: string) => void;
  onSelectionMode: (active: boolean) => void;
  onOpenMobileSheet: () => void;
  onCloseMobileSheet: () => void;
  actions: GameActions;
  session: GameSession;
}) {
  const palette: Palette = state.factions[0].palette;
  const selected = state.entities.find((entity: Entity) => selectedIds.includes(entity.id) && entity.hp > 0);
  const grid = powerBreakdown(state, 0);
  const selectedCount = selectedIds.length;
  const mobilePlaying = !tutorial && !paused && state.result === "playing";
  const mobileSurface: MobileSurfaceState = {
    dockVisible: mobilePlaying,
    sheetOpen: mobilePlaying && mobileSheetOpen,
    sheetContext: selected?.owner === 0 && selected.class === "unit" && !selected.neutral ? "unit" : "base",
    activeCommand: actions.mobileCommandState,
    selectionMode,
    selectedCount,
  };

  return (
    <>
      {!tutorial ? (
        <>
          <MobileCommandDock
            surface={mobileSurface}
            onCommand={actions.chooseMobileCommand}
            onSelectionMode={onSelectionMode}
            onOpenSheet={onOpenMobileSheet}
            onPause={session.openPauseMenu}
          />
          <MobileCommandSheet
            open={mobileSurface.sheetOpen}
            state={state}
            palette={palette}
            profile={playerVisualProfile}
            selected={selected}
            selectedCount={mobileSurface.selectedCount}
            activeTab={activeTab}
            command={mobileSurface.activeCommand}
            placeKind={actions.placeKind}
            repairMode={actions.repairMode}
            sellMode={actions.sellMode}
            power={grid.surplus}
            produced={grid.produced}
            used={grid.used}
            miniRef={mobileMiniRef}
            onClose={onCloseMobileSheet}
            onTab={onTab}
            onCommand={actions.chooseMobileCommand}
            onStop={() => actions.issueSelectedCommand("stop")}
            onRepair={actions.toggleRepair}
            onSell={actions.toggleSell}
            onStance={(stance) => actions.issueSelectedCommand("stance", stance)}
            onFormation={(formation) => actions.issueSelectedCommand("formation", formation)}
            onPlace={actions.togglePlace}
            onCancelBuilding={actions.cancelBuilding}
            onQueueUnit={actions.queueUnit}
            onCancelUnit={actions.cancelUnit}
            availableProducer={actions.availableProducer}
            onMinimapPointerDown={camera.onMinimapPointerDown}
            onMinimapPointerMove={camera.onMinimapPointerMove}
            onMinimapPointerUp={camera.onMinimapPointerUp}
            isMinimapDragging={camera.isMinimapDragging}
          />
        </>
      ) : null}

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
          seed={state.seed}
          missionIndex={state.missionIndex}
          onResume={session.resumeMission}
          onSave={session.saveMission}
          onLoad={session.loadMission}
          onBriefing={session.viewMissionBriefing}
          onRestart={session.restartMission}
          onAssets={() => {
            setPauseView("assets");
            setPauseNotice("");
          }}
          onSoundtrack={() => {
            setPauseView("soundtrack");
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
