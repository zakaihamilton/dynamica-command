import type { PointerEventHandler, Ref } from "react";
import type { CommandBuildControls } from "./commandCatalogTypes";
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
}: CommandBuildControls & {
  open: boolean;
  selectedCount: number;
  command: MobileCommand | null;
  produced: number;
  used: number;
  miniRef: Ref<HTMLCanvasElement>;
  onClose: () => void;
  onCommand: (command: MobileCommand) => void;
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
