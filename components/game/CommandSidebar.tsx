import { useEffect, useState, type PointerEventHandler, type Ref } from "react";
import type { CommandBuildControls } from "./commandCatalogTypes";
import { CommandBuildSection } from "./CommandBuildSection";
import { CommandHeader } from "./CommandHeader";
import { MinimapFrame } from "./MinimapFrame";
import { MobileTouchControls } from "./MobileTouchControls";
import { ResourceDock } from "./ResourceDock";
import type { MobileCommand } from "./mobileCommandTypes";
import styles from "./CommandSidebar.module.css";

export function CommandSidebar({
  factionName,
  state,
  palette,
  profile,
  selected,
  placeKind,
  repairMode,
  sellMode,
  activeTab,
  power,
  produced,
  used,
  miniRef,
  onPause,
  onMinimapPointerDown,
  onMinimapPointerMove,
  onMinimapPointerUp,
  isMinimapDragging,
  onTab,
  onRepair,
  onSell,
  onPlace,
  onCancelBuilding,
  onQueueUnit,
  onCancelUnit,
  availableProducer,
  onStop,
  onStance,
  onFormation,
  selectedCount,
  selectionMode,
  activeCommand,
  onTouchCommand,
  onSelectionMode,
  mobilePanelOpen,
  onCloseMobilePanel,
}: CommandBuildControls & {
  factionName: string;
  produced: number;
  used: number;
  miniRef: Ref<HTMLCanvasElement>;
  onPause: () => void;
  onMinimapPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerUp: PointerEventHandler<HTMLCanvasElement>;
  isMinimapDragging: boolean;
  selectedCount: number;
  selectionMode: boolean;
  activeCommand: MobileCommand | null;
  onTouchCommand: (command: MobileCommand) => void;
  onSelectionMode: (active: boolean) => void;
  mobilePanelOpen: boolean;
  onCloseMobilePanel: () => void;
}) {
  const hasUnitSelection = selected?.owner === 0 && selected.class === "unit" && !selected.neutral && selectedCount > 0;
  const [portraitViewport, setPortraitViewport] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(max-width: 799px) and (orientation: portrait)");
    const update = () => setPortraitViewport(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  const panelHidden = portraitViewport && !mobilePanelOpen;

  return (
    <aside
      id="command-sidebar"
      className={styles.sidebar}
      data-mobile-open={mobilePanelOpen ? "true" : "false"}
      data-testid="command-sidebar"
      aria-hidden={panelHidden || undefined}
      inert={panelHidden || undefined}
    >
      <span className={styles.rail} aria-hidden />
      <CommandHeader factionName={factionName} onPause={onPause} />
      <div className={styles.mobilePanelBar}>
        <span>Touch command layer</span>
        <button type="button" className={styles.mobilePanelClose} onClick={onCloseMobilePanel}>
          Close
        </button>
      </div>

      <div className={styles.radarSlot}>
        <MinimapFrame
          canvasRef={miniRef}
          onPointerDown={onMinimapPointerDown}
          onPointerMove={onMinimapPointerMove}
          onPointerUp={onMinimapPointerUp}
          isDragging={isMinimapDragging}
        />
      </div>

      <div className={styles.resourceSlot}>
        <ResourceDock credits={state.credits[0]} produced={produced} used={used} surplus={power} />
      </div>

      <MobileTouchControls
        selectedCount={selectedCount}
        hasUnitSelection={hasUnitSelection}
        selectionMode={selectionMode}
        activeCommand={activeCommand}
        onCommand={onTouchCommand}
        onSelectionMode={onSelectionMode}
        onStop={onStop}
      />

      <CommandBuildSection
        state={state}
        palette={palette}
        profile={profile}
        selected={selected}
        placeKind={placeKind}
        repairMode={repairMode}
        sellMode={sellMode}
        activeTab={activeTab}
        power={power}
        onTab={onTab}
        onRepair={onRepair}
        onSell={onSell}
        onPlace={onPlace}
        onCancelBuilding={onCancelBuilding}
        onQueueUnit={onQueueUnit}
        onCancelUnit={onCancelUnit}
        availableProducer={availableProducer}
        onStop={onStop}
        onStance={onStance}
        onFormation={onFormation}
      />
    </aside>
  );
}
