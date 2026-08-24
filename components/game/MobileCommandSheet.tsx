import type { PointerEventHandler, Ref } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import type { BuildingKind, Entity, FactionVisualProfile, Formation, Palette, SimState, Stance, UnitKind } from "@/lib/types";
import type { CommandTab } from "@/lib/ui/shortcuts";
import { CommandCatalogContent } from "./CommandCatalogContent";
import { MinimapFrame } from "./MinimapFrame";
import { ResourceDock } from "./ResourceDock";
import { SelectionOrders } from "./SelectionOrders";
import type { MobileCommand } from "./mobileCommandTypes";
import { mobileCommandLabel } from "./MobileCommandDock";
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
  const hasSelection = selectedCount > 0;
  const stance = selected?.stance ?? "aggressive";
  const formation = selected?.formation;

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
        <div className={styles.sheetHeader}>
          <div>
            <span className={styles.eyebrow}>Genesis command</span>
            <strong>{hasSelection ? `${selectedCount} selected` : "Base systems"}</strong>
          </div>
          <ConsoleButton className={styles.close} muted onClick={onClose} aria-label="Close commands" data-testid="mobile-command-close">
            Close
          </ConsoleButton>
        </div>

        <div className={styles.sheetScroll}>
          {friendlyUnit ? (
            <section className={styles.section} data-testid="mobile-unit-commands">
              <div className={styles.sectionHeader}>
                <span className={styles.eyebrow}>Unit orders</span>
                <span className={styles.activeCommand}>{command ? `${mobileCommandLabel(command)} armed` : "Tap a command, then tap the map"}</span>
              </div>
              <div className={styles.commandGrid}>
                {([
                  ["move", "Move"],
                  ["attack", "Attack"],
                  ["attackMove", "A-Move"],
                  ["harvest", "Harvest"],
                ] as const).map(([id, label]) => (
                  <ConsoleButton key={id} className={styles.command} data-testid={`mobile-command-${id}`} aria-pressed={command === id} onClick={() => onCommand(id)}>
                    {label}
                  </ConsoleButton>
                ))}
                <ConsoleButton className={styles.command} data-testid="mobile-command-stop" onClick={onStop}>Stop</ConsoleButton>
              </div>
              {selectedCount === 1 ? (
                <SelectionOrders
                  stance={stance}
                  formation={formation}
                  onStop={onStop}
                  onStance={onStance}
                  onFormation={onFormation}
                />
              ) : null}
            </section>
          ) : null}

          <section className={styles.section} data-testid="mobile-base-controls">
            <div className={styles.sectionHeader}>
              <span className={styles.eyebrow}>Theater systems</span>
              <span className={styles.activeCommand}>{repairMode ? "Repair mode" : sellMode ? "Sell mode" : "Base overview"}</span>
            </div>
            <div className={styles.resources}>
              <ResourceDock credits={state.credits[0]} produced={produced} used={used} surplus={power} />
            </div>
            <MinimapFrame
              canvasRef={miniRef}
              onPointerDown={onMinimapPointerDown}
              onPointerMove={onMinimapPointerMove}
              onPointerUp={onMinimapPointerUp}
              isDragging={isMinimapDragging}
            />
          </section>

          <section className={styles.section} data-testid="mobile-build-controls">
            <div className={styles.sectionHeader}>
              <span className={styles.eyebrow}>Command catalog</span>
              <span className={styles.activeCommand}>Tap an item to activate</span>
            </div>
            <div className={styles.tabs} role="tablist" aria-label="Mobile command catalog">
              <ConsoleButton role="tab" aria-selected={activeTab === "construction"} onClick={() => onTab("construction")}>Build</ConsoleButton>
              <ConsoleButton role="tab" aria-selected={activeTab === "production"} onClick={() => onTab("production")}>Produce</ConsoleButton>
              <ConsoleButton role="tab" aria-selected={activeTab === "selected"} onClick={() => onTab("selected")}>Selected</ConsoleButton>
              <ConsoleButton aria-pressed={repairMode} onClick={onRepair}>Repair</ConsoleButton>
              <ConsoleButton aria-pressed={sellMode} onClick={onSell}>Sell</ConsoleButton>
            </div>
            <CommandCatalogContent
              state={state}
              palette={palette}
              profile={profile}
              activeTab={activeTab}
              placeKind={placeKind}
              selected={selected}
              selectionCount={selectedCount}
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
          </section>
        </div>
      </section>
    </div>
  );
}
