import { useMemo, type Ref } from "react";
import { powerBreakdown } from "@/lib/sim/world";
import { shouldShowCommandSidebar } from "@/lib/sim/debrief";
import type { GameSettings } from "@/lib/persist/settings";
import type { Campaign, FactionVisualProfile, SimState } from "@/lib/types";
import type { CommandTab, PauseView } from "@/lib/ui/shortcuts";
import type { MobileCommand } from "./mobileCommandTypes";
import { gameOverlayModel, powerSignature } from "./gameOverlayModel";
import { GamePauseSurface } from "./GamePauseSurface";
import { GameSidebarSurface } from "./GameSidebarSurface";
import { MobileCommandLauncher } from "./MobileCommandLauncher";
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
  mobilePanelOpen,
  mobileLauncherRef,
  miniRef,
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
  onToggleMobilePanel,
  onCloseMobilePanel,
  onPause,
  onTouchCommand,
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
  mobilePanelOpen: boolean;
  mobileLauncherRef: Ref<HTMLButtonElement>;
  miniRef: Ref<HTMLCanvasElement>;
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
  onToggleMobilePanel: () => void;
  onCloseMobilePanel: () => void;
  onPause: () => void;
  onTouchCommand: (command: MobileCommand) => void;
  onSelect?: (ids: number[]) => void;
  onAnnounce?: (message: string) => void;
  actions: GameActions;
  session: GameSession;
}) {
  // Memoized so the selected-entity snapshot is not rebuilt on unrelated re-renders.
  const { palette, selected } = useMemo(
    () => gameOverlayModel({ state, selectedIds }),
    [state, selectedIds],
  );
  // The power grid only changes when an owner-0 building finishes, starts
  // construction, or dies; keying on the signature skips the full entity
  // rescan during unit-movement ticks and selection/pause churn.
  const powerSig = powerSignature(state);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on derived signature, not raw state
  const grid = useMemo(() => powerBreakdown(state, 0), [powerSig]);

  return (
    <>
      {!tutorial && !paused && state.result === "playing" && !session.confirmation ? (
        <MobileCommandLauncher
          open={mobilePanelOpen}
          onToggle={onToggleMobilePanel}
          onPause={onPause}
          buttonRef={mobileLauncherRef}
        />
      ) : null}

      {!tutorial && shouldShowCommandSidebar(state.result) ? (
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
          onPause={onPause}
          camera={camera}
          onTab={onTab}
          actions={actions}
          selectedCount={selectedIds.length}
          selectionMode={selectionMode}
          activeCommand={actions.mobileCommandState}
          onTouchCommand={onTouchCommand}
          onSelectionMode={onSelectionMode}
          mobilePanelOpen={mobilePanelOpen}
          onCloseMobilePanel={onCloseMobilePanel}
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
