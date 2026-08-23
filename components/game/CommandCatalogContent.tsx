import type { BuildingKind, Entity, FactionVisualProfile, Formation, Palette, SimState, Stance, UnitKind } from "@/lib/types";
import type { CommandTab } from "@/lib/ui/shortcuts";
import { ConstructionCameos } from "./ConstructionCameos";
import { ProductionCameos } from "./ProductionCameos";
import { SelectionPanel } from "./SelectionPanel";

export function CommandCatalogContent({
  state,
  palette,
  profile,
  activeTab,
  placeKind,
  selected,
  selectionCount,
  power,
  availableProducer,
  onPlace,
  onCancelBuilding,
  onQueueUnit,
  onCancelUnit,
  onStop,
  onStance,
  onFormation,
  selectedClassName,
}: {
  state: SimState;
  palette: Palette;
  profile: FactionVisualProfile;
  activeTab: CommandTab;
  placeKind: BuildingKind | null;
  selected: Entity | undefined;
  selectionCount?: number;
  power: number;
  availableProducer: (unit: UnitKind) => Entity | undefined;
  onPlace: (kind: BuildingKind) => void;
  onCancelBuilding: (kind: BuildingKind) => void;
  onQueueUnit: (unit: UnitKind) => void;
  onCancelUnit: (unit: UnitKind) => void;
  onStop: () => void;
  onStance: (stance: Stance) => void;
  onFormation: (formation: Formation) => void;
  selectedClassName?: string;
}) {
  if (activeTab === "construction") {
    return (
      <ConstructionCameos
        state={state}
        palette={palette}
        profile={profile}
        placeKind={placeKind}
        onPlace={onPlace}
        onCancelBuilding={onCancelBuilding}
      />
    );
  }

  if (activeTab === "production") {
    return (
      <ProductionCameos
        state={state}
        palette={palette}
        profile={profile}
        power={power}
        availableProducer={availableProducer}
        onQueueUnit={onQueueUnit}
        onCancelUnit={onCancelUnit}
      />
    );
  }

  return (
    <SelectionPanel
      selected={selected}
      selectionCount={selectionCount}
      palette={palette}
      profile={profile}
      className={selectedClassName}
      onStop={onStop}
      onStance={onStance}
      onFormation={onFormation}
    />
  );
}
