import { canPlaceBuilding } from "@/lib/sim/world";
import { canRepair } from "@/lib/sim/repair";
import { canSell } from "@/lib/sim/sell";
import { TILE_RESOURCE, type BuildingKind, type Entity, type SimState } from "@/lib/types";

export type BattlefieldCursor = "crosshair" | "pointer" | "cell" | "not-allowed";

const SUPPORT_KINDS = new Set(["harvester", "medic", "repairTruck", "convoyTruck"]);

function hasResourceNear(state: SimState, cx: number, cy: number, maxRadius = 1): boolean {
  for (let dy = -maxRadius; dy <= maxRadius; dy++) {
    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
        const i = ny * state.width + nx;
        if (state.tiles[i] === TILE_RESOURCE && (state.resourceAmount[i] ?? 0) > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

export function battlefieldCursor({
  state,
  hoverTile,
  hoverEntity,
  selectedIds,
  placeKind,
  repairMode,
  sellMode,
}: {
  state: SimState;
  hoverTile: { x: number; y: number } | null;
  hoverEntity: Entity | undefined;
  selectedIds: number[];
  placeKind: BuildingKind | null;
  repairMode: boolean;
  sellMode: boolean;
}): BattlefieldCursor {
  if (placeKind) {
    if (!hoverTile) return "cell";
    return canPlaceBuilding(state, placeKind, hoverTile.x, hoverTile.y) ? "cell" : "not-allowed";
  }
  if (repairMode) {
    if (!hoverEntity) return "not-allowed";
    return hoverEntity.owner === 0 && (hoverEntity.repairing || canRepair(hoverEntity)) ? "pointer" : "not-allowed";
  }
  if (sellMode) {
    if (!hoverEntity) return "not-allowed";
    return hoverEntity.owner === 0 && canSell(hoverEntity) ? "pointer" : "not-allowed";
  }
  if (hoverEntity?.owner === 0) return "pointer";
  if (hoverEntity && hoverEntity.owner === 1) {
    const selectedCombat = selectedIds.some((id) => {
      const entity = state.entities.find((item) => item.id === id && item.hp > 0 && item.owner === 0 && item.class === "unit");
      return Boolean(entity && !SUPPORT_KINDS.has(entity.kind));
    });
    return selectedCombat ? "crosshair" : "not-allowed";
  }
  if (hoverTile && hasResourceNear(state, hoverTile.x, hoverTile.y, 1)) {
    const harvesting = selectedIds.some((id) => {
      const entity = state.entities.find((item) => item.id === id);
      return entity?.kind === "harvester" && entity.hp > 0 && entity.owner === 0;
    });
    if (harvesting) return "cell";
  }
  return "crosshair";
}
