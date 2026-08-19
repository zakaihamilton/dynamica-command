import { BUILDING_STATS, buildingCameoStatus } from "@/lib/catalog";
import type { BuildingKind, FactionVisualProfile, Palette, SimState } from "@/lib/types";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import { CameoGrid } from "./CameoGrid";
import { CommandCameo } from "./CommandCameo";
import { PLACEABLE } from "./hooks/useGameActions";

export function ConstructionCameos({
  state,
  palette,
  profile,
  placeKind,
  onPlace,
  onCancelBuilding,
}: {
  state: SimState;
  palette: Palette;
  profile: FactionVisualProfile;
  placeKind: BuildingKind | null;
  onPlace: (kind: BuildingKind) => void;
  onCancelBuilding: (kind: BuildingKind) => void;
}) {
  return (
    <CameoGrid>
      {PLACEABLE.map((kind, index) => {
        const cameo = buildingCameoStatus(state.entities, 0, kind);
        return (
          <CommandCameo
            key={kind}
            kind={kind}
            palette={palette}
            profile={profile}
            cost={BUILDING_STATS[kind].cost}
            disabled={cameo.phase === "idle" && state.credits[0] < BUILDING_STATS[kind].cost}
            active={placeKind === kind}
            cameo={cameo}
            shortcut={SHORTCUT.cameo[index]}
            onClick={() => onPlace(kind)}
            onContextMenu={() => onCancelBuilding(kind)}
          />
        );
      })}
    </CameoGrid>
  );
}
