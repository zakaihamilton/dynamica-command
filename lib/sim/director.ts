import { footprintOf } from "../catalog";
import type { MissionDirectorPhase, MissionRuntime, SimEvent, SimState, UnitKind } from "../types";
import { missionDifficulty } from "./difficulty";
import { trySpawnUnit } from "./world";

const CLASSIC_DIRECTOR_DURATION = 3600;
const CLASSIC_DURATION_STEP = 480;

export function directorTimeline(state: SimState): { pressureStart: number; finaleStart: number } {
  const convoyStaging = state.runtime?.kind === "escort" ? state.runtime.convoyStartTick ?? 0 : 0;
  const duration = Math.max(
    360,
    (state.win.ticks ?? CLASSIC_DIRECTOR_DURATION + state.missionIndex * CLASSIC_DURATION_STEP) + convoyStaging,
  );
  const difficulty = missionDifficulty(state.missionIndex);
  const pressureStart = state.runtime?.kind === "escort"
    ? Math.max(convoyStaging + 240, Math.round(duration * 0.28))
    : Math.min(
        Math.max(240, Math.round(duration * 0.28)),
        difficulty.enemyAssaultEvery,
      );
  const finaleStart = Math.max(pressureStart + 360, Math.round(duration * 0.75));
  return { pressureStart, finaleStart };
}

export function ensureMissionDirector(state: SimState): MissionRuntime | undefined {
  const runtime = state.runtime;
  if (!runtime) return undefined;
  if (state.tutorialStage !== undefined) return runtime;
  if (!runtime.director) {
    const timeline = directorTimeline(state);
    runtime.director = {
      phase: "opening",
      ...timeline,
      eventCount: 0,
    };
  }
  return runtime;
}

function phaseAt(state: SimState, director: NonNullable<MissionRuntime["director"]>): MissionDirectorPhase {
  if (state.runtime?.kind === "escort" && state.runtime.convoyStartTick !== undefined) return "opening";
  if (state.tick >= director.finaleStart) return "finale";
  if (state.tick >= director.pressureStart) return "pressure";
  return "opening";
}

function reinforcementKinds(state: SimState, phase: MissionDirectorPhase): UnitKind[] {
  if (phase === "pressure") return ["infantry"];
  if (state.missionIndex >= 4) return ["tank", "antiArmor", "infantry"];
  return ["tank", "infantry"];
}

function spawnReinforcements(state: SimState, phase: MissionDirectorPhase): number {
  const yard = state.entities.find(
    (entity) => entity.owner === 1 && entity.class === "building" && entity.kind === "constructionYard" && entity.hp > 0,
  );
  if (!yard) return 0;
  const footprint = footprintOf("constructionYard");
  let spawned = 0;
  for (const [index, kind] of reinforcementKinds(state, phase).entries()) {
    if (trySpawnUnit(state, 1, kind, yard.x - 1, yard.y + footprint.h + index)) spawned += 1;
  }
  return spawned;
}

function phaseAlert(runtime: MissionRuntime, phase: MissionDirectorPhase): string {
  if (phase === "pressure") {
    if (runtime.kind === "escort") return "Enemy reserves are moving on the convoy route.";
    if (runtime.kind === "rescue") return "Enemy patrols are closing on the rescue zone.";
    if (runtime.kind === "extraction") return "Enemy patrols are converging on the extraction route.";
    return "Enemy activity is rising — secure the resource lanes.";
  }
  if (runtime.kind === "holdTheLine") return "Final enemy push detected — hold the construction yard.";
  if (runtime.kind === "sabotage" || runtime.kind === "destroyMarked") return "Enemy reserves are regrouping around the marked targets.";
  return "Final enemy push detected — finish the operation now.";
}

export function tickMissionDirector(state: SimState): SimEvent[] {
  if (state.result !== "playing" || state.tutorialStage !== undefined) return [];
  const runtime = ensureMissionDirector(state);
  if (!runtime?.director || runtime.phase === "complete") return [];
  const nextPhase = phaseAt(state, runtime.director);
  if (nextPhase === runtime.director.phase) return [];

  runtime.director.phase = nextPhase;
  runtime.director.eventCount += 1;
  spawnReinforcements(state, nextPhase);
  return [{ type: "alert", kind: "objective", text: phaseAlert(runtime, nextPhase) }];
}
