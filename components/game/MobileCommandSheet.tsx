import type { PointerEventHandler, Ref } from "react";
import type { BuildingKind, Entity, FactionVisualProfile, Formation, Palette, SimState, Stance, UnitKind } from "@/lib/types";
import type { CommandTab } from "@/lib/ui/shortcuts";
import { MobileBaseControls } from "./MobileBaseControls";
import { MobileBuildCatalog } from "./MobileBuildCatalog";
import { MobileSheetHeader } from "./MobileSheetHeader";
import { MobileUnitOrders } from "./MobileUnitOrders";
import type { MobileCommand } from "./mobileCommandTypes";
import styles from "./MobileCommandTray.module.css";

export function MobileCommandSheet({
  open,
  state,
  palette,
  profile,
  selected,
  selectedCount,
  activeTab,
  command,
  placeKind,
  repairMode,
  sellMode,
  power,
  produced,
  used,
  miniRef,
  onClose,
  onTab,
  onCommand,
  onStop,
  onRepair,
  onSell,
  onStance,
  onFormation,
  onPlace,
  onCancelBuilding,
  onQueueUnit,
  onCancelUnit,
  availableProducer,
  onMinimapPointerDown,
  onMinimapPointerMove,
  onMinimapPointerUp,
  isMinimapDragging,
}: {
  open: boolean;
  state: SimState;
  palette: Palette;
  profile: FactionVisualProfile;
  selected: Entity | undefined;
  selectedCount: number;
  activeTab: CommandTab;
  command: MobileCommand | null;
  placeKind: BuildingKind | null;
  repairMode: boolean;
  sellMode: boolean;
  power: number;
  produced: number;
  used: number;
  miniRef: Ref<HTMLCanvasElement>;
  onClose: () => void;
  onTab: (tab: CommandTab) => void;
  onCommand: (command: MobileCommand) => void;
  onStop: () => void;
  onRepair: () => void;
  onSell: () => void;
  onStance: (stance: Stance) => void;
  onFormation: (formation: Formation) => void;
  onPlace: (kind: BuildingKind) => void;
  onCancelBuilding: (kind: BuildingKind) => void;
  onQueueUnit: (unit: UnitKind) => void;
  onCancelUnit: (unit: UnitKind) => void;
  availableProducer: (unit: UnitKind) => Entity | undefined;
  onMinimapPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerUp: PointerEventHandler<HTMLCanvasElement>;
  isMinimapDragging: boolean;
}) {
  if (!open) return null;

  const friendlyUnit = selected?.owner === 0 && selected.class === "unit" && !selected.neutral;

  return (
    <div className={styles.sheetBackdrop} data-testid="mobile-command-sheet-backdrop" onClick={onClose}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile command sheet"
        data-testid="mobile-command-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <MobileSheetHeader selectedCount={selectedCount} onClose={onClose} />

        <div className={styles.sheetScroll}>
          {friendlyUnit ? (
            <MobileUnitOrders
              command={command}
              selectedCount={selectedCount}
              stance={selected?.stance ?? "aggressive"}
              formation={selected?.formation}
              onCommand={onCommand}
              onStop={onStop}
              onStance={onStance}
              onFormation={onFormation}
            />
          ) : null}

          <MobileBaseControls
            repairMode={repairMode}
            sellMode={sellMode}
            credits={state.credits[0]}
            produced={produced}
            used={used}
            surplus={power}
            miniRef={miniRef}
            onMinimapPointerDown={onMinimapPointerDown}
            onMinimapPointerMove={onMinimapPointerMove}
            onMinimapPointerUp={onMinimapPointerUp}
            isMinimapDragging={isMinimapDragging}
          />

          <MobileBuildCatalog
            state={state}
            palette={palette}
            profile={profile}
            selected={selected}
            selectedCount={selectedCount}
            activeTab={activeTab}
            placeKind={placeKind}
            repairMode={repairMode}
            sellMode={sellMode}
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
        </div>
      </section>
    </div>
  );
}
