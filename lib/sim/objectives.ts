import type { InspectReport, SimEvent, SimState } from "../types";
import { formatSeed } from "../seed/rng";
import { living } from "./world";

export function objectiveProgress(state: SimState): { current: number; target: number; label: string } {
  const w = state.win;
  switch (w.kind) {
    case "harvestQuota":
      return {
        current: state.creditsEarned[0],
        target: w.target ?? 0,
        label: `Credits ${state.creditsEarned[0]} / ${w.target}`,
      };
    case "forceQuota": {
      const current = w.role ? (state.unitsProducedByRole[w.role] ?? 0) : state.unitsProduced[0];
      return {
        current,
        target: w.target ?? 0,
        label: w.role
          ? `${w.role} ${current} / ${w.target}`
          : `Units built ${current} / ${w.target}`,
      };
    }
    case "structureQuota": {
      const current = w.building
        ? (state.buildingsCompletedByKind[w.building] ?? 0)
        : state.buildingsCompleted[0];
      return {
        current,
        target: w.target ?? 0,
        label: w.building
          ? `${w.building} ${current} / ${w.target}`
          : `Buildings ${current} / ${w.target}`,
      };
    }
    case "destroyMarked": {
      const ids = w.targetIds ?? [];
      const remaining = ids.filter((id) => state.entities.some((e) => e.id === id && e.hp > 0)).length;
      const current = ids.length - remaining;
      return { current, target: ids.length, label: `Targets ${current} / ${ids.length}` };
    }
    case "razeAll": {
      const left = living(state).filter((e) => e.owner === 1 && e.class === "building").length;
      return { current: left === 0 ? 1 : 0, target: 1, label: left === 0 ? "All structures down" : `Enemy buildings left ${left}` };
    }
    case "decapitate": {
      const cy = living(state).some((e) => e.owner === 1 && e.kind === "constructionYard");
      return { current: cy ? 0 : 1, target: 1, label: cy ? "Destroy enemy construction yard" : "Yard destroyed" };
    }
    case "annihilate": {
      const left = living(state).filter((e) => e.owner === 1).length;
      return { current: left === 0 ? 1 : 0, target: 1, label: left === 0 ? "Theater clear" : `Hostiles left ${left}` };
    }
    case "holdTheLine": {
      const t = w.ticks ?? 0;
      return { current: Math.min(state.tick, t), target: t, label: `Hold ${state.tick} / ${t}` };
    }
    default:
      return { current: 0, target: 1, label: "Unknown" };
  }
}

export function evaluateObjectives(state: SimState): SimEvent[] {
  if (state.result !== "playing") return [];
  const playerCy = living(state).some((e) => e.owner === 0 && e.kind === "constructionYard");
  const playerForce = living(state).filter((e) => e.owner === 0);
  if (!playerCy && playerForce.length === 0) {
    state.result = "lost";
    return [{ type: "lost" }];
  }
  if (!playerCy) {
    state.result = "lost";
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
    default:
      break;
  }

  if (won) {
    state.result = "won";
    return [{ type: "won" }];
  }
  return [];
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
