import { useMemo, type Ref } from "react";
import { powerBreakdown } from "@/lib/sim/world";
import { shouldShowCommandSidebar } from "@/lib/sim/debrief";
import type { GameSettings } from "@/lib/persist/settings";
import type { Campaign, FactionVisualProfile, SimState } from "@/lib/types";
import type { CommandTab, PauseView } from "@/lib/ui/shortcuts";
import { gameOverlayModel, powerSignature } from "./gameOverlayModel";
import { GameMobileSurface } from "./GameMobileSurface";
import { GamePauseSurface } from "./GamePauseSurface";
import { GameSidebarSurface } from "./GameSidebarSurface";
import { MissionConfirmation } from "./MissionConfirmation";
import { TacticalRoster } from "./TacticalRoster";
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
  tacticalAnnouncement = "",
  audioSettings,
  camera,
  setPauseView,
  setPauseNotice,
  onSelectionMode,
  onOpenMobileSheet,
  onCloseMobileSheet,
  onSelect = () => undefined,
  onAnnounce = () => undefined,
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
  tacticalAnnouncement?: string;
  audioSettings: GameSettings;
  camera: GameCamera;
  setPauseView: (view: PauseView) => void;
  setPauseNotice: (notice: string) => void;
  onSelectionMode: (active: boolean) => void;
  onOpenMobileSheet: () => void;
  onCloseMobileSheet: () => void;
  onSelect?: (ids: number[]) => void;
  onAnnounce?: (message: string) => void;
  actions: GameActions;
  session: GameSession;
}) {
  // Memoized so the selected-entity snapshot is not rebuilt on unrelated re-renders.
  const { palette, selected, mobilePlaying, sheetContext } = useMemo(
    () => gameOverlayModel({ state, selectedIds, tutorial, paused }),
    [state, selectedIds, tutorial, paused],
  );
  // The power grid only changes when an owner-0 building finishes, starts
  // construction, or dies; keying on the signature skips the full entity
  // rescan during unit-movement ticks and selection/pause churn.
  const powerSig = powerSignature(state);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on derived signature, not raw state
  const grid = useMemo(() => powerBreakdown(state, 0), [powerSig]);

  return (
    <>
      {!tutorial ? (
        <GameMobileSurface
          surface={{
            dockVisible: mobilePlaying,
            sheetOpen: mobilePlaying && mobileSheetOpen,
            sheetContext,
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

      {!tutorial && audioSettings.tacticalRosterEnabled ? (
        <TacticalRoster
          state={state}
          selectedIds={selectedIds}
          actions={actions}
          camera={camera}
          announcement={tacticalAnnouncement}
          onSelect={onSelect}
          onAnnounce={onAnnounce}
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
