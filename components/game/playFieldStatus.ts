import { TICKS_PER_SECOND } from "@/lib/catalog";
import { formatHoldClock, objectiveProgress, secondaryProgress } from "@/lib/sim/objectives";
import type { SimState } from "@/lib/types";

export function playFieldStatus(state: SimState) {
  const objective = objectiveProgress(state);
  const deadline = objective.deadlineTicks === undefined
    ? undefined
    : `Window ${formatHoldClock(Math.ceil(objective.deadlineTicks / TICKS_PER_SECOND))}`;
  const stagingWindow = state.runtime?.kind === "escort" && state.runtime.convoyStartTick !== undefined
    ? `Staging ${formatHoldClock(Math.ceil(Math.max(0, state.runtime.convoyStartTick - state.tick) / TICKS_PER_SECOND))}`
    : undefined;
  return {
    objective: objective.label,
    secondary: secondaryProgress(state).map((item) => `${item.completed ? "✓" : "○"} ${item.label}`),
    deadline,
    stagingWindow,
  };
}
