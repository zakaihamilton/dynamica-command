import type { SimState, TutorialStage } from "../types";
import { canStep } from "./world";

export function tutorialPrompt(state: SimState): string {
  switch (state.tutorialStage) {
    case "select": return "Tap or click your infantry to select it.";
    case "move": return "Move the selected unit to the highlighted ground (right click).";
    case "harvest": return "Select the harvester, then order it to an ore field.";
    case "build": return "Open Construction (Q) and place a power plant.";
    case "produce": return "Open Production (E) and queue infantry.";
    case "attack": return "Use attack-move (Ctrl + right click) or attack an enemy unit.";
    case "repair": return "Use the wrench (R) on a damaged structure.";
    default: return "Training complete. Return to the command desk when ready.";
  }
}

export function tutorialMoveTile(state: SimState): { x: number; y: number } | null {
  if (state.tutorialStage !== "move") return null;
  const infantry = state.entities.find(
    (entity) =>
      entity.hp > 0 &&
      entity.owner === 0 &&
      entity.class === "unit" &&
      entity.kind === "infantry" &&
      !entity.neutral,
  );
  if (!infantry) return null;
  const ix = Math.round(infantry.x);
  const iy = Math.round(infantry.y);
  for (let radius = 1; radius <= 8; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = ix + dx;
        const y = iy + dy;
        if (canStep(state, ix, iy, x, y)) return { x, y };
      }
    }
  }
  return null;
}

export function enterTutorialStage(state: SimState, stage: TutorialStage): void {
  state.tutorialStage = stage;
  if (stage !== "repair") return;
  const building = state.entities.find(
    (entity) =>
      entity.hp > 0 &&
      entity.owner === 0 &&
      entity.class === "building" &&
      entity.constructing === 0 &&
      entity.hp === entity.maxHp,
  );
  if (building) building.hp = Math.max(1, Math.floor(building.maxHp / 2));
}
