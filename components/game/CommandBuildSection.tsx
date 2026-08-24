import type { BuildingKind, Entity, FactionVisualProfile, Formation, Palette, SimState, Stance, UnitKind } from "@/lib/types";
import type { CommandTab } from "@/lib/ui/shortcuts";
import { CommandCatalogContent } from "./CommandCatalogContent";
import { CommandTabs } from "./CommandTabs";
import styles from "./CommandSidebar.module.css";

export function CommandBuildSection({
  state,
  palette,
  profile,
  selected,
  placeKind,
  repairMode,
  sellMode,
  activeTab,
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
}: {
  state: SimState;
  palette: Palette;
  profile: FactionVisualProfile;
  selected: Entity | undefined;
  placeKind: BuildingKind | null;
  repairMode: boolean;
  sellMode: boolean;
  activeTab: CommandTab;
  power: number;
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
  const catalog = (
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
      selectedClassName={activeTab === "selected" ? styles.selectedBody : undefined}
    />
  );

  return (
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
          {catalog}
        </div>
      ) : catalog}
    </section>
  );
}
