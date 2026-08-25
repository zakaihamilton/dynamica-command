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
    mobilePlaying: !tutorial && !paused && state.result === "playing",
    sheetContext: (selected?.owner === 0 && selected.class === "unit" && !selected.neutral ? "unit" : "base") as MobileSheetContext,
  };
}

/**
 * Cheap fingerprint of the inputs `powerBreakdown(state, 0)` depends on:
 * owner-0 living buildings and whether each is still constructing. Unit
 * movement, enemy activity, and selection churn leave this unchanged, so
 * callers can memoize the breakdown on it instead of on `state`.
 */
export function powerSignature(state: SimState): string {
  const parts: string[] = [];
  for (const e of state.entities) {
    if (e.hp <= 0 || e.owner !== 0 || e.class !== "building") continue;
    parts.push(e.constructing > 0 ? `${e.kind}~` : e.kind);
  }
  return parts.sort().join("|");
}
