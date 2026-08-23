import type { PointerEventHandler, Ref } from "react";
import type { BuildingKind, Entity, FactionVisualProfile, Formation, Palette, SimState, Stance, UnitKind } from "@/lib/types";
import type { CommandTab } from "@/lib/ui/shortcuts";
import { CommandHeader } from "./CommandHeader";
import { CommandTabs } from "./CommandTabs";
import { CommandCatalogContent } from "./CommandCatalogContent";
import { MinimapFrame } from "./MinimapFrame";
import { ResourceDock } from "./ResourceDock";
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
}: {
  factionName: string;
  state: SimState;
  palette: Palette;
  profile: FactionVisualProfile;
  selected: Entity | undefined;
  placeKind: BuildingKind | null;
  repairMode: boolean;
  sellMode: boolean;
  activeTab: CommandTab;
  power: number;
  produced: number;
  used: number;
  miniRef: Ref<HTMLCanvasElement>;
  onPause: () => void;
  onMinimapPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerUp: PointerEventHandler<HTMLCanvasElement>;
  isMinimapDragging: boolean;
  onTab: (tab: CommandTab) => void;
  onRepair: () => void;
  onSell: () => void;
  onPlace: (kind: BuildingKind) => void;
  onCancelBuilding: (kind: BuildingKind) => void;
  onQueueUnit: (unit: UnitKind) => void;
  onCancelUnit: (unit: UnitKind) => void;
  availableProducer: (unit: UnitKind) => Entity | undefined;
  onStop: () => void;
  onStance: (stance: Stance) => void;
  onFormation: (formation: Formation) => void;
}) {
  return (
    <aside className={styles.sidebar} data-testid="command-sidebar">
      <span className={styles.rail} aria-hidden />
      <CommandHeader factionName={factionName} onPause={onPause} />

      <div className={styles.radarSlot}>
        <MinimapFrame
          canvasRef={miniRef}
          onPointerDown={onMinimapPointerDown}
          onPointerMove={onMinimapPointerMove}
          onPointerUp={onMinimapPointerUp}
          isDragging={isMinimapDragging}
          friendlyColor={state.factions[0]?.palette.light ?? palette.light}
          hostileColor={state.factions[1]?.palette.light ?? "#ff8b83"}
        />
      </div>

      <div className={styles.resourceSlot}>
        <ResourceDock credits={state.credits[0]} produced={produced} used={used} surplus={power} />
      </div>

      <section className={styles.build} data-testid="build-progress">
        <CommandTabs
          activeTab={activeTab}
          repairMode={repairMode}
          sellMode={sellMode}
          onConstruction={() => onTab("construction")}
          onProduction={() => onTab("production")}
          onSelected={() => onTab("selected")}
        onRepair={onRepair}
        onSell={onSell}
      />
        {activeTab === "selected" ? (
          <div className={styles.selected} data-testid="selected-panel">
            <CommandCatalogContent
              state={state}
              palette={palette}
              profile={profile}
              activeTab={activeTab}
              placeKind={placeKind}
              selected={selected}
              power={power}
              availableProducer={availableProducer}
              onPlace={onPlace}
              onCancelBuilding={onCancelBuilding}
              onQueueUnit={onQueueUnit}
              onCancelUnit={onCancelUnit}
              onStop={onStop}
              onStance={onStance}
              onFormation={onFormation}
              selectedClassName={styles.selectedBody}
            />
          </div>
        ) : (
          <CommandCatalogContent
            state={state}
            palette={palette}
            profile={profile}
            activeTab={activeTab}
            placeKind={placeKind}
            selected={selected}
            power={power}
            availableProducer={availableProducer}
            onPlace={onPlace}
            onCancelBuilding={onCancelBuilding}
            onQueueUnit={onQueueUnit}
            onCancelUnit={onCancelUnit}
            onStop={onStop}
            onStance={onStance}
            onFormation={onFormation}
          />
        )}
      </section>
    </aside>
  );
}
