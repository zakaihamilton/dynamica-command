import type { Ref } from "react";
import type { Entity, FactionVisualProfile, Palette, SimState } from "@/lib/types";
import type { CommandTab } from "@/lib/ui/shortcuts";
import { MobileCommandDock, MobileCommandSheet, type MobileSurfaceState } from "./MobileCommandTray";
import type { GameActions } from "./hooks/useGameActions";
import type { GameCamera } from "./hooks/useGameCamera";
import type { GameSession } from "./hooks/useGameSession";

export function GameMobileSurface({
  surface,
  state,
  palette,
  profile,
  selected,
  mobileMiniRef,
  activeTab,
  power,
  produced,
  used,
  onTab,
  onSelectionMode,
  onOpenSheet,
  onCloseSheet,
  actions,
  camera,
  session,
}: {
  surface: MobileSurfaceState;
  state: SimState;
  palette: Palette;
  profile: FactionVisualProfile;
  selected: Entity | undefined;
  mobileMiniRef: Ref<HTMLCanvasElement>;
  activeTab: CommandTab;
  power: number;
  produced: number;
  used: number;
  onTab: (tab: CommandTab) => void;
  onSelectionMode: (active: boolean) => void;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  actions: GameActions;
  camera: GameCamera;
  session: GameSession;
}) {
  return (
    <>
      <MobileCommandDock
        surface={surface}
        onCommand={actions.chooseMobileCommand}
        onSelectionMode={onSelectionMode}
        onOpenSheet={onOpenSheet}
        onPause={session.openPauseMenu}
      />
      <MobileCommandSheet
        open={surface.sheetOpen}
        state={state}
        palette={palette}
        profile={profile}
        selected={selected}
        selectedCount={surface.selectedCount}
        activeTab={activeTab}
        command={surface.activeCommand}
        placeKind={actions.placeKind}
        repairMode={actions.repairMode}
        sellMode={actions.sellMode}
        power={power}
        produced={produced}
        used={used}
        miniRef={mobileMiniRef}
        onClose={onCloseSheet}
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
  );
}
