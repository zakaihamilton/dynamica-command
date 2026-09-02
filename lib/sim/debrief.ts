import { TICKS_PER_SECOND } from "../catalog";
import { formatMissionMinutesFromTicks, MAX_MISSION_TICKS } from "../gen/pacing";
import { objectiveHeadline } from "../gen/story";
import type { Owner, SimState } from "../types";
import { objectiveProgress, secondaryProgress } from "./objectives";
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
  return formatMissionMinutesFromTicks(ticks);
}

export function shouldShowCommandSidebar(result: SimState["result"]): boolean {
  return result === "playing";
}

export function missionMedals(state: SimState): number {
  if (state.result !== "won") return 0;
  const secondaries = secondaryProgress(state);
  const allSecondaries = secondaries.length > 0 && secondaries.every((objective) => objective.completed);
  return 1 + (allSecondaries ? 1 : 0) + (state.losses.units[0] === 0 ? 1 : 0);
}

const SPEED_BONUS_PER_SECOND = 10;

/** Remaining-time bonus, scaled to a 20-minute window so longer casual clocks do not inflate scores. */
function remainingTimeBonus(state: SimState): number {
  const deadline = state.runtime?.deadline;
  if (deadline === undefined || deadline <= 0) return 0;
  const remaining = Math.max(0, deadline - state.tick);
  const normalizedRemaining = remaining * MAX_MISSION_TICKS / deadline;
  return Math.floor(Math.min(normalizedRemaining, MAX_MISSION_TICKS) / TICKS_PER_SECOND) * SPEED_BONUS_PER_SECOND;
}

export function missionScore(state: SimState): number {
  if (state.result !== "won") return 0;
  const completedSecondaries = secondaryProgress(state).filter((objective) => objective.completed).length;
  return Math.max(
    0,
    1000 + state.creditsEarned[0] + completedSecondaries * 250 + remainingTimeBonus(state)
      - state.losses.units[0] * 100 - state.losses.buildings[0] * 200,
  );
}

export function missionLossMessage(state: SimState): string {
  if (state.lossReason === "deadline") return "Operation window expired.";
  if (state.lossReason === "objectiveTargetLost") {
    if (state.win.kind === "extraction") return "The cargo was lost.";
    if (state.win.kind === "rescue") return "A stranded unit was lost.";
    return "The convoy was lost.";
  }
  return "Construction yard destroyed.";
}

export function missionDebrief(state: SimState) {
  const objective = objectiveProgress(state);
  const won = state.result === "won";
  return {
    outcome: won ? "Primary objective achieved." : missionLossMessage(state),
    objective: {
      headline: objectiveHeadline(state.win),
      progress: objective.label,
    },
    secondary: secondaryProgress(state),
    battle: {
      duration: formatMissionDuration(state.tick),
      creditsGathered: state.creditsEarned[0],
      unitsTrained: state.unitsProduced[0],
      structuresCompleted: state.buildingsCompleted[0],
      score: missionScore(state),
      medals: missionMedals(state),
    },
    forces: {
      friendly: forceDebrief(state, 0),
      enemy: forceDebrief(state, 1),
    },
  };
}

export type MissionDebrief = ReturnType<typeof missionDebrief>;
