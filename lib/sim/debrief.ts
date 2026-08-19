import { TICKS_PER_SECOND } from "../catalog";
import { objectiveHeadline } from "../gen/story";
import type { Owner, SimState } from "../types";
import { objectiveProgress } from "./objectives";
import { living } from "./world";

export type ForceDebrief = {
  unitsRemaining: number;
  buildingsRemaining: number;
  unitsLost: number;
  buildingsLost: number;
};

function forceDebrief(state: SimState, owner: Owner): ForceDebrief {
  const active = living(state).filter((entity) => entity.owner === owner);
  return {
    unitsRemaining: active.filter((entity) => entity.class === "unit").length,
    buildingsRemaining: active.filter((entity) => entity.class === "building").length,
    unitsLost: state.losses.units[owner],
    buildingsLost: state.losses.buildings[owner],
  };
}

export function formatMissionDuration(ticks: number): string {
  const seconds = Math.floor(ticks / TICKS_PER_SECOND);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function shouldShowCommandSidebar(result: SimState["result"]): boolean {
  return result === "playing";
}

export function missionDebrief(state: SimState) {
  const objective = objectiveProgress(state);
  const won = state.result === "won";
  return {
    outcome: won ? "Primary objective achieved." : "Construction yard destroyed.",
    objective: {
      headline: objectiveHeadline(state.win),
      progress: objective.label,
    },
    battle: {
      duration: formatMissionDuration(state.tick),
      creditsGathered: state.creditsEarned[0],
      unitsTrained: state.unitsProduced[0],
      structuresCompleted: state.buildingsCompleted[0],
    },
    forces: {
      friendly: forceDebrief(state, 0),
      enemy: forceDebrief(state, 1),
    },
  };
}

export type MissionDebrief = ReturnType<typeof missionDebrief>;
