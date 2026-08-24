import { powerBreakdown } from "@/lib/sim/world";
import type { Entity, SimState } from "@/lib/types";
import type { MobileSheetContext } from "./mobileCommandTypes";

export function gameOverlayModel({
  state,
  selectedIds,
  tutorial,
  paused,
}: {
  state: SimState;
  selectedIds: number[];
  tutorial: boolean;
  paused: boolean;
}) {
  const selectedEntity = state.entities.find((entity: Entity) => selectedIds.includes(entity.id) && entity.hp > 0);
  // The simulation mutates entities in place; give React a new identity for the selected snapshot.
  const selected = selectedEntity ? { ...selectedEntity } : undefined;
  return {
    palette: state.factions[0].palette,
    selected,
    grid: powerBreakdown(state, 0),
    mobilePlaying: !tutorial && !paused && state.result === "playing",
    sheetContext: (selected?.owner === 0 && selected.class === "unit" && !selected.neutral ? "unit" : "base") as MobileSheetContext,
  };
}
