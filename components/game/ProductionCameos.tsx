import { UNIT_STATS, unitCameoStatus } from "@/lib/catalog";
import type { Entity, FactionVisualProfile, Palette, SimState, UnitKind } from "@/lib/types";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import { CameoGrid } from "./CameoGrid";
import { CommandCameo } from "./CommandCameo";
import { PRODUCIBLE } from "./hooks/useGameActions";

export function ProductionCameos({
  state,
  palette,
  profile,
  power,
  availableProducer,
  onQueueUnit,
  onCancelUnit,
}: {
  state: SimState;
  palette: Palette;
  profile: FactionVisualProfile;
  power: number;
  availableProducer: (unit: UnitKind) => Entity | undefined;
  onQueueUnit: (unit: UnitKind) => void;
  onCancelUnit: (unit: UnitKind) => void;
}) {
  return (
    <CameoGrid>
      {PRODUCIBLE.map((unit, index) => {
        const cameo = unitCameoStatus(state.entities, 0, unit);
        const producer = availableProducer(unit);
        const canBuy = state.credits[0] >= UNIT_STATS[unit].cost && !!producer && power >= 0;
        return (
          <CommandCameo
            key={unit}
            kind={unit}
            palette={palette}
            profile={profile}
            cost={UNIT_STATS[unit].cost}
            disabled={cameo.phase === "idle" && !canBuy}
            cameo={cameo}
            shortcut={SHORTCUT.cameo[index]}
            onClick={() => onQueueUnit(unit)}
            onContextMenu={() => onCancelUnit(unit)}
          />
        );
      })}
    </CameoGrid>
  );
}
