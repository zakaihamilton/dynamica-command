import type { PointerEventHandler, Ref } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import type { BuildingKind, Entity, FactionVisualProfile, Formation, Palette, SimState, Stance, UnitKind } from "@/lib/types";
import type { CommandTab } from "@/lib/ui/shortcuts";
import { ConstructionCameos } from "./ConstructionCameos";
import { MinimapFrame } from "./MinimapFrame";
import { ProductionCameos } from "./ProductionCameos";
import { ResourceDock } from "./ResourceDock";
import { SelectionOrders } from "./SelectionOrders";
import { SelectionPanel } from "./SelectionPanel";
import styles from "./MobileCommandTray.module.css";

export type MobileCommand = "move" | "attack" | "attackMove" | "harvest";
export type MobileSheetContext = "unit" | "base";
export type MobileSurfaceState = {
  dockVisible: boolean;
  sheetOpen: boolean;
  sheetContext: MobileSheetContext;
  activeCommand: MobileCommand | null;
  selectionMode: boolean;
  selectedCount: number;
};

const COMMANDS: { id: MobileCommand; label: string }[] = [
  { id: "move", label: "Move" },
  { id: "attack", label: "Attack" },
  { id: "attackMove", label: "A-Move" },
  { id: "harvest", label: "Harvest" },
];

function commandLabel(command: MobileCommand | null) {
  return COMMANDS.find((item) => item.id === command)?.label ?? "Ready";
}

export function MobileCommandDock({
  surface,
  onCommand,
  onSelectionMode,
  onOpenSheet,
  onPause,
}: {
  surface: MobileSurfaceState;
  onCommand: (command: MobileCommand) => void;
  onSelectionMode: (active: boolean) => void;
  onOpenSheet: () => void;
  onPause: () => void;
}) {
  if (!surface.dockVisible) return null;
  const { activeCommand: command, selectedCount, selectionMode } = surface;
  const hasSelection = selectedCount > 0;
  const hasUnitSelection = surface.sheetContext === "unit" && hasSelection;
  return (
    <nav className={styles.dock} aria-label="Mobile command dock" data-testid="mobile-command-dock">
      <button type="button" className={styles.pause} data-testid="mobile-pause" onClick={onPause} aria-label="Pause mission">
        Pause
      </button>
      <div className={styles.status} aria-live="polite">
        <strong>{selectionMode ? "Select units" : hasSelection ? `${selectedCount} unit${selectedCount === 1 ? "" : "s"}` : "No selection"}</strong>
        {selectionMode ? (
          <span data-testid="mobile-marquee">Drag a box around friendly units</span>
        ) : (
          <span>{command ? `${commandLabel(command)} active` : "Tap a unit or open commands"}</span>
        )}
      </div>
      <ConsoleButton
        className={styles.control}
        aria-pressed={selectionMode}
        data-testid="mobile-select-mode"
        onClick={() => onSelectionMode(!selectionMode)}
      >
        {selectionMode ? "Cancel" : "Select"}
      </ConsoleButton>
      {hasUnitSelection ? (
        <ConsoleButton className={styles.control} data-testid="mobile-command-move" aria-pressed={command === "move"} onClick={() => onCommand("move")}>
          Move
        </ConsoleButton>
      ) : null}
      <ConsoleButton className={styles.control} data-testid="mobile-command-more" onClick={onOpenSheet}>
        Commands
      </ConsoleButton>
    </nav>
  );
}

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
                <span className={styles.activeCommand}>{command ? `${commandLabel(command)} armed` : "Tap a command, then tap the map"}</span>
              </div>
              <div className={styles.commandGrid}>
                {COMMANDS.map((item) => (
                  <ConsoleButton key={item.id} className={styles.command} data-testid={`mobile-command-${item.id}`} aria-pressed={command === item.id} onClick={() => onCommand(item.id)}>
                    {item.label}
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
              friendlyColor={state.factions[0]?.palette.light ?? palette.light}
              hostileColor={state.factions[1]?.palette.light ?? "#ff8b83"}
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
            {activeTab === "construction" ? (
              <ConstructionCameos state={state} palette={palette} profile={profile} placeKind={placeKind} onPlace={onPlace} onCancelBuilding={onCancelBuilding} />
            ) : activeTab === "production" ? (
              <ProductionCameos state={state} palette={palette} profile={profile} power={power} availableProducer={availableProducer} onQueueUnit={onQueueUnit} onCancelUnit={onCancelUnit} />
            ) : (
              <SelectionPanel selected={selected} selectionCount={selectedCount} palette={palette} profile={profile} onStop={onStop} onStance={onStance} onFormation={onFormation} />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
