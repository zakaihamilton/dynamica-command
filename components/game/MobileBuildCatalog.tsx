import { ConsoleButton } from "@/components/ui/ConsoleButton";
import type { CommandBuildControls } from "./commandCatalogTypes";
import { CommandCatalogContent } from "./CommandCatalogContent";
import styles from "./MobileCommandTray.module.css";

export function MobileBuildCatalog({
  state,
  palette,
  profile,
  selected,
  selectedCount,
  activeTab,
  placeKind,
  repairMode,
  sellMode,
  power,
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
}: CommandBuildControls & { selectedCount: number }) {
  return (
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
  );
}
