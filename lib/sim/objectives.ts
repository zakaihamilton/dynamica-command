import { labelFor, TICKS_PER_SECOND } from "../catalog";
import type { InspectReport, MissionKind, MissionRuntime, SimEvent, SimState } from "../types";
import { formatSeed } from "../seed/rng";
import { formatMissionClock, formatMissionClockFromTicks } from "../gen/pacing";
import { living } from "./world";

export function formatHoldClock(seconds: number): string {
  return formatMissionClock(seconds);
}

export type ObjectiveProgress = {
  current: number;
  target: number;
  label: string;
  timeRemainingTicks?: number;
  phase?: MissionRuntime["phase"];
};

export type SecondaryProgress = {
  id: string;
  label: string;
  completed: boolean;
};

function timeRemainingTicks(state: SimState): number | undefined {
  if (state.runtime?.deadline !== undefined) return Math.max(0, state.runtime.deadline - state.tick);
  if (["escort", "sabotage", "rescue", "extraction"].includes(state.win.kind) && state.win.ticks !== undefined) {
    return Math.max(0, state.win.ticks - state.tick);
  }
  if (state.win.kind === "holdTheLine" && state.win.ticks !== undefined) return Math.max(0, state.win.ticks - state.tick);
  return undefined;
}

const LOSS_DEADLINE_KINDS: MissionKind[] = ["escort", "sabotage", "rescue", "extraction"];
const DEADLINE_WARNING_SECONDS = [60, 30, 10] as const;

function entityAlive(state: SimState, id: number): boolean {
  return state.entities.some((entity) => entity.id === id && entity.hp > 0);
}

function scenarioObjectiveTargetLost(state: SimState): boolean {
  const runtime = state.runtime;
  if (!runtime) return false;
  if (runtime.kind === "escort") {
    return runtime.targetIds.some((id) => !entityAlive(state, id));
  }
  if (runtime.kind === "extraction") {
    const extracted = new Set(runtime.extractedIds ?? []);
    return runtime.targetIds.some((id) => !extracted.has(id) && !entityAlive(state, id));
  }
  if (runtime.kind === "rescue") {
    const required = state.win.targetCount ?? runtime.required ?? runtime.targetIds.length;
    const remaining = runtime.targetIds.filter((id) =>
      state.entities.some((entity) => entity.id === id && entity.hp > 0 && entity.neutral === true),
    ).length;
    return runtime.rescued + remaining < required;
  }
  return false;
}

function deadlineWarningEvent(state: SimState): SimEvent | undefined {
  if (!state.runtime || !LOSS_DEADLINE_KINDS.includes(state.runtime.kind)) return undefined;
  const remaining = timeRemainingTicks(state);
  if (remaining === undefined) return undefined;
  if (!DEADLINE_WARNING_SECONDS.some((seconds) => remaining === seconds * TICKS_PER_SECOND)) return undefined;
  return { type: "deadlineWarning", remainingTicks: remaining };
}

export function secondaryProgress(state: SimState): SecondaryProgress[] {
  return (state.runtime?.secondary ?? []).map((objective) => ({
    id: objective.id,
    label: objective.label,
    completed: objective.completed === true,
  }));
}

export function objectiveProgress(state: SimState): ObjectiveProgress {
  const w = state.win;
  let progress: { current: number; target: number; label: string };
  switch (w.kind) {
    case "harvestQuota":
      progress = {
        current: state.creditsEarned[0],
        target: w.target ?? 0,
        label: `Extracted ${state.creditsEarned[0]} / ${w.target}`,
      };
      break;
    case "forceQuota": {
      const current = w.role ? (state.unitsProducedByRole[w.role] ?? 0) : state.unitsProduced[0];
      progress = {
        current,
        target: w.target ?? 0,
        label: w.role
          ? `${labelFor(w.role)} ${current} / ${w.target}`
          : `Units built ${current} / ${w.target}`,
      };
      break;
    }
    case "structureQuota": {
      const current = w.building
        ? (state.buildingsCompletedByKind[w.building] ?? 0)
        : state.buildingsCompleted[0];
      progress = {
        current,
        target: w.target ?? 0,
        label: w.building
          ? `${labelFor(w.building)} ${current} / ${w.target}`
          : `Buildings ${current} / ${w.target}`,
      };
      break;
    }
    case "destroyMarked": {
      const ids = w.targetIds ?? [];
      const remaining = ids.filter((id) => state.entities.some((e) => e.id === id && e.hp > 0)).length;
      const current = ids.length - remaining;
      progress = { current, target: ids.length, label: `Targets ${current} / ${ids.length}` };
      break;
    }
    case "razeAll": {
      const left = living(state).filter((e) => e.owner === 1 && e.class === "building").length;
      progress = { current: left === 0 ? 1 : 0, target: 1, label: left === 0 ? "All structures down" : `Enemy buildings left ${left}` };
      break;
    }
    case "decapitate": {
      const cy = living(state).some((e) => e.owner === 1 && e.kind === "constructionYard");
      progress = { current: cy ? 0 : 1, target: 1, label: cy ? "Destroy the enemy Construction Yard" : "Construction Yard destroyed" };
      break;
    }
    case "annihilate": {
      const left = living(state).filter((e) => e.owner === 1).length;
      progress = { current: left === 0 ? 1 : 0, target: 1, label: left === 0 ? "Theater clear" : `Hostiles left ${left}` };
      break;
    }
    case "holdTheLine": {
      if (w.ticks === undefined) {
        progress = { current: 0, target: 0, label: "Training range — no time limit" };
        break;
      }
      const t = w.ticks;
      const left = Math.max(0, t - state.tick);
      progress = {
        current: Math.min(state.tick, t),
        target: t,
        label: left <= 0 ? "Held" : `Hold ${formatMissionClockFromTicks(left)} remaining`,
      };
      break;
    }
    case "escort":
    case "rescue":
    case "extraction": {
      const runtime = state.runtime;
      const current = runtime?.rescued ?? 0;
      const target = w.targetCount ?? runtime?.required ?? 1;
      const label = w.kind === "escort" ? `Convoy ${current} / ${target}` : w.kind === "rescue" ? `Rescued ${current} / ${target}` : `Extracted ${current} / ${target}`;
      progress = { current, target, label };
      break;
    }
    case "sabotage": {
      const ids = w.targetIds ?? [];
      const current = ids.filter((id) => !state.entities.some((e) => e.id === id && e.hp > 0)).length;
      progress = { current, target: ids.length || w.targetCount || 1, label: `Systems ${current} / ${ids.length || w.targetCount || 1}` };
      break;
    }
    default:
      progress = { current: 0, target: 1, label: "Unknown" };
  }
  return { ...progress, timeRemainingTicks: timeRemainingTicks(state), phase: state.runtime?.phase };
}

export function evaluateObjectives(state: SimState): SimEvent[] {
  if (state.result !== "playing") return [];
  const playerCy = living(state).some((e) => e.owner === 0 && e.kind === "constructionYard");
  if (!playerCy) {
    state.result = "lost";
    state.lossReason = "yardDestroyed";
    if (state.runtime) state.runtime.phase = "complete";
    return [{ type: "lost" }];
  }

  const w = state.win;
  let won = false;
  switch (w.kind) {
    case "harvestQuota":
      won = state.creditsEarned[0] >= (w.target ?? Infinity);
      break;
    case "forceQuota": {
      const current = w.role ? (state.unitsProducedByRole[w.role] ?? 0) : state.unitsProduced[0];
      won = current >= (w.target ?? Infinity);
      break;
    }
    case "structureQuota": {
      const current = w.building
        ? (state.buildingsCompletedByKind[w.building] ?? 0)
        : state.buildingsCompleted[0];
      won = current >= (w.target ?? Infinity);
      break;
    }
    case "destroyMarked": {
      const ids = w.targetIds ?? [];
      won = ids.length > 0 && ids.every((id) => !state.entities.some((e) => e.id === id && e.hp > 0));
      break;
    }
    case "razeAll":
      won = !living(state).some((e) => e.owner === 1 && e.class === "building");
      break;
    case "decapitate":
      won = !living(state).some((e) => e.owner === 1 && e.kind === "constructionYard");
      break;
    case "annihilate":
      won = !living(state).some((e) => e.owner === 1);
      break;
    case "holdTheLine":
      if (state.tick >= (w.ticks ?? Infinity) && playerCy) won = true;
      break;
    case "escort":
    case "extraction":
      won = (state.runtime?.rescued ?? 0) >= (w.targetCount ?? state.runtime?.required ?? Infinity);
      break;
    case "rescue":
      won = (state.runtime?.rescued ?? 0) >= (w.targetCount ?? state.runtime?.required ?? Infinity);
      break;
    case "sabotage":
      won = (w.targetIds ?? []).length > 0 && (w.targetIds ?? []).every((id) => !state.entities.some((e) => e.id === id && e.hp > 0));
      break;
    default:
      break;
  }

  if (won) {
    state.result = "won";
    if (state.runtime) state.runtime.phase = "complete";
    return [{ type: "won" }];
  }

  if (state.runtime && LOSS_DEADLINE_KINDS.includes(state.runtime.kind)) {
    if (scenarioObjectiveTargetLost(state)) {
      state.result = "lost";
      state.lossReason = "objectiveTargetLost";
      state.runtime.phase = "complete";
      return [{ type: "lost" }];
    }
    const deadline = state.runtime.deadline ?? w.ticks;
    if (deadline !== undefined && state.tick >= deadline) {
      state.result = "lost";
      state.lossReason = "deadline";
      state.runtime.phase = "complete";
      return [{ type: "objectiveExpired", kind: state.runtime.kind }, { type: "lost" }];
    }
  }
  const warning = deadlineWarningEvent(state);
  return warning ? [warning] : [];
}

export function inspect(state: SimState): InspectReport {
  const obj = objectiveProgress(state);
  const units = living(state).filter((e) => e.class === "unit");
  const buildings = living(state).filter((e) => e.class === "building");
  return {
    seed: formatSeed(state.seed),
    missionIndex: state.missionIndex,
    tick: state.tick,
    credits: state.credits[0],
    creditsEarned: state.creditsEarned[0],
    units: {
      player: units.filter((e) => e.owner === 0).length,
      enemy: units.filter((e) => e.owner === 1).length,
    },
    buildings: {
      player: buildings.filter((e) => e.owner === 0).length,
      enemy: buildings.filter((e) => e.owner === 1).length,
    },
    objective: {
      kind: state.win.kind,
      label: obj.label,
      current: obj.current,
      target: obj.target,
    },
    result: state.result,
  };
}
