import { labelFor, TICKS_PER_SECOND } from "../catalog";
import { formatMissionMinutesFromTicks, MAX_MISSION_TICKS } from "../gen/pacing";
import { profileContractFor, resolveMissionProfile } from "../gen/profile";
import { objectiveHeadline } from "../gen/story";
import type { LossReason, MissionKind, Owner, SimState } from "../types";
import { objectivePriorityFor, objectiveProgress, secondaryProgress } from "./objectives";
import { livingView } from "./world";

export type ForceDebrief = {
  unitsRemaining: number;
  buildingsRemaining: number;
  unitsLost: number;
  buildingsLost: number;
};

function forceDebrief(state: SimState, owner: Owner): ForceDebrief {
  const active = livingView(state).filter((entity) => entity.owner === owner);
  return {
    unitsRemaining: active.filter((entity) => entity.class === "unit").length,
    buildingsRemaining: active.filter((entity) => entity.class === "building").length,
    unitsLost: state.losses.units[owner],
    buildingsLost: state.losses.buildings[owner],
  };
}

function scenarioTargetObjective(state: SimState, won: boolean) {
  const runtime = state.runtime;
  if (!runtime || runtime.targetIds.length === 0) return undefined;
  const labels: Partial<Record<MissionKind, string>> = {
    escort: "Convoy reaches extraction",
    rescue: "Stranded units return to Command HQ",
    extraction: "Cargo reaches extraction",
  };
  const label = labels[runtime.kind];
  if (!label) return undefined;
  return {
    id: "scenario-target",
    label,
    completed: won,
    failed: state.lossReason === "objectiveTargetLost",
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

export function lossReasonLabel(reason?: LossReason, missionKind?: MissionKind): string {
  if (reason === "deadline") return "Time ran out.";
  if (reason === "objectiveTargetLost") {
    if (missionKind === "extraction") return "The cargo was lost.";
    if (missionKind === "rescue") return "A stranded unit was lost.";
    return "The convoy was lost.";
  }
  if (reason === "yardDestroyed") return `The ${labelFor("constructionYard")} was destroyed.`;
  return "Mission failed.";
}

export function missionLossMessage(state: SimState): string {
  return lossReasonLabel(state.lossReason ?? "yardDestroyed", state.win.kind);
}

export function missionDebrief(state: SimState) {
  const objective = objectiveProgress(state);
  const won = state.result === "won";
  const profile = profileContractFor(resolveMissionProfile(state.seed, state.missionIndex, state.win.kind));
  const secondary = secondaryProgress(state);
  const targetObjective = scenarioTargetObjective(state, won);
  const primaryObjectives = [
    ...secondary.filter((item) => objectivePriorityFor(item.id) === "primary"),
    ...(targetObjective ? [targetObjective] : []),
  ];
  const optionalObjectives = secondary.filter((item) => objectivePriorityFor(item.id) === "optional");
  return {
    status: won ? "won" as const : "lost" as const,
    outcome: won ? "Primary objective achieved." : missionLossMessage(state),
    retryGuidance: won ? undefined : retryGuidance(state),
    objective: {
      headline: objectiveHeadline(state.win),
      progress: objective.label,
    },
    tactical: {
      label: profile.label,
      emphasis: profile.emphasis,
      completed: won,
    },
    // Keep `secondary` for existing callers and share-card compatibility. The
    // grouped fields are presentation-only and make required conditions
    // impossible to mislabel as optional in result surfaces.
    secondary,
    primaryObjectives,
    optionalObjectives,
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

function retryGuidance(state: SimState): string {
  if (state.lossReason === "deadline") return "Open with power and a refinery, then queue only the force needed for the objective. Keep the timer visible and move before the final minute.";
  if (state.lossReason === "objectiveTargetLost") return "Protect the mission target first. Establish a nearby escort, use attack-move to clear the route, and keep support units behind the front line.";
  if (state.lossReason === "yardDestroyed") return "Rebuild the defensive screen around Command HQ and use Repair on damaged structures before committing to another push.";
  return "Review the objective card, secure the opening economy, and use the Selected tab to issue focused orders.";
}

export type MissionDebrief = ReturnType<typeof missionDebrief>;
