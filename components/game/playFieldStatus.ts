import { formatMissionClockFromTicks } from "@/lib/gen/pacing";
import { objectiveProgress, secondaryProgress } from "@/lib/sim/objectives";
import type { SimState } from "@/lib/types";

export function playFieldStatus(state: SimState) {
  const objective = objectiveProgress(state);
  const timeRemaining = state.runtime?.deadline === undefined || objective.timeRemainingTicks === undefined
    ? undefined
    : `Time remaining ${formatMissionClockFromTicks(objective.timeRemainingTicks)}`;
  const convoyDeparture = state.runtime?.kind === "escort" && state.runtime.convoyStartTick !== undefined
    ? `Convoy departs in ${formatMissionClockFromTicks(Math.max(0, state.runtime.convoyStartTick - state.tick))}`
    : undefined;
  return {
    objective: objective.label,
    secondary: secondaryProgress(state).map((item) => `${item.completed ? "✓" : "○"} ${item.label}`),
    timeRemaining,
    convoyDeparture,
  };
}
