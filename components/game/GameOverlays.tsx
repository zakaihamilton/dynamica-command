import type { Ref } from "react";
import { powerBreakdown } from "@/lib/sim/world";
import { shouldShowCommandSidebar } from "@/lib/sim/debrief";
import type { GameSettings } from "@/lib/persist/settings";
import type { Campaign, Entity, FactionVisualProfile, Palette, SimState } from "@/lib/types";
import type { CommandTab, PauseView } from "@/lib/ui/shortcuts";
import { GameMobileSurface } from "./GameMobileSurface";
import { GamePauseSurface } from "./GamePauseSurface";
import { GameSidebarSurface } from "./GameSidebarSurface";
import { MissionConfirmation } from "./MissionConfirmation";
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
  const mobilePlaying = !tutorial && !paused && state.result === "playing";

  return (
    <>
      {!tutorial ? (
        <GameMobileSurface
          surface={{
            dockVisible: mobilePlaying,
            sheetOpen: mobilePlaying && mobileSheetOpen,
            sheetContext: selected?.owner === 0 && selected.class === "unit" && !selected.neutral ? "unit" : "base",
            activeCommand: actions.mobileCommandState,
            selectionMode,
            selectedCount: selectedIds.length,
          }}
          state={state}
          palette={palette}
          profile={playerVisualProfile}
          selected={selected}
          mobileMiniRef={mobileMiniRef}
          activeTab={activeTab}
          power={grid.surplus}
          produced={grid.produced}
          used={grid.used}
          onTab={onTab}
          onSelectionMode={onSelectionMode}
          onOpenSheet={onOpenMobileSheet}
          onCloseSheet={onCloseMobileSheet}
          actions={actions}
          camera={camera}
          session={session}
        />
      ) : null}

      {shouldShowCommandSidebar(state.result) ? (
        <GameSidebarSurface
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
          camera={camera}
          onTab={onTab}
          actions={actions}
        />
      ) : null}

      {paused ? (
        <GamePauseSurface
          view={pauseView}
          notice={pauseNotice}
          settings={audioSettings}
          palette={palette}
          seed={state.seed}
          missionIndex={state.missionIndex}
          setView={setPauseView}
          setNotice={setPauseNotice}
          session={session}
        />
      ) : null}

      {session.confirmation ? (
        <MissionConfirmation
          confirmation={session.confirmation}
          onConfirm={session.confirmAction}
          onCancel={session.cancelConfirmation}
        />
      ) : null}
    </>
  );
}
