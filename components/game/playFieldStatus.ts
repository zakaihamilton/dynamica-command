import { formatMissionClockFromTicks } from "@/lib/gen/pacing";
import { objectiveProgress, secondaryProgress } from "@/lib/sim/objectives";
import { missionObjectives } from "@/lib/gen/story";
import type { Campaign, SimState } from "@/lib/types";

export function playFieldStatus(state: SimState, campaign?: Campaign) {
  const objective = objectiveProgress(state);
  const timeRemaining = state.runtime?.deadline === undefined || objective.timeRemainingTicks === undefined
    ? undefined
    : `Time remaining ${formatMissionClockFromTicks(objective.timeRemainingTicks)}`;
  const convoyDeparture = state.runtime?.kind === "escort" && state.runtime.convoyStartTick !== undefined
    ? `Convoy departs in ${formatMissionClockFromTicks(Math.max(0, state.runtime.convoyStartTick - state.tick))}`
    : undefined;
  const mission = campaign?.missions[state.missionIndex];
  return {
    objective: objective.label,
    secondary: secondaryProgress(state).map((item) => `${item.completed ? "✓" : "○"} ${item.label}`),
    briefingObjectives: mission ? missionObjectives(mission, campaign) : [],
    timeRemaining,
    convoyDeparture,
  };
}
