import { createMission, tick } from "../lib/sim/api";
import { CompetentCommander } from "../lib/sim/commander";
import { tickCombat } from "../lib/sim/combat";
import { addBuilding, addUnit, makeFixture, setHeight } from "../lib/sim/fixtures";
import { resetPathBudget } from "../lib/sim/pathBudget";
import { bakeTerrainAtlasData } from "../lib/render/terrainAtlas";

const MAX_ATLAS_MS = 1_000;
const MAX_ATLAS_BYTES = 4 * 1024 * 1024;
const MAX_SIM_P95_MS = 25;
const MAX_BLOCKED_COMBAT_P95_MS = 25;
const SIM_TICKS = 600;
const SIM_WARMUP_TICKS = 60;
const BLOCKED_COMBAT_UNITS = 24;
const BLOCKED_COMBAT_TICKS = 120;

type Sample = {
  seed: number;
  mission: number;
  map: string;
  ms: number;
  bytes: number;
};

const atlasSamples: Sample[] = [];
for (const seed of [0, 421, 9999]) {
  const state = createMission({ seed, missionIndex: 7 });
  const started = performance.now();
  const atlas = bakeTerrainAtlasData(state);
  atlasSamples.push({
    seed,
    mission: state.missionIndex,
    map: `${state.width}x${state.height}`,
    ms: performance.now() - started,
    bytes: atlas.data.byteLength,
  });
}

type SimulationSample = {
  seed: number;
  mission: number;
  map: string;
  ticks: number;
  result: string;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

const simulationSamples: SimulationSample[] = [];
for (const seed of [0, 421, 9999]) {
  const state = createMission({ seed, missionIndex: 7 });
  const commander = new CompetentCommander();
  const timings: number[] = [];
  for (let i = 0; i < SIM_TICKS && state.result === "playing"; i++) {
    const started = performance.now();
    const commands = commander.plan(state);
    tick(state, commands);
    if (i >= SIM_WARMUP_TICKS) timings.push(performance.now() - started);
  }
  simulationSamples.push({
    seed,
    mission: state.missionIndex,
    map: `${state.width}x${state.height}`,
    ticks: state.tick,
    result: state.result,
    p50Ms: percentile(timings, 0.5),
    p95Ms: percentile(timings, 0.95),
    maxMs: Math.max(...timings, 0),
  });
}

const blockedCombatState = makeFixture({ width: 40, height: 28, win: { kind: "annihilate" } });
const blockedTarget = addBuilding(blockedCombatState, 1, "power", 20, 12);
blockedTarget.hp = 1_000_000;
blockedTarget.maxHp = 1_000_000;
setHeight(blockedCombatState, 18, 12, 4);
for (let i = 0; i < BLOCKED_COMBAT_UNITS; i++) {
  const attacker = addUnit(blockedCombatState, 0, "tank", 17, 12);
  attacker.attackTarget = blockedTarget.id;
  attacker.orderMode = "attack";
  attacker.idle = false;
}
const blockedCombatTimings: number[] = [];
for (let i = 0; i < BLOCKED_COMBAT_TICKS; i++) {
  resetPathBudget();
  const started = performance.now();
  tickCombat(blockedCombatState);
  if (i >= SIM_WARMUP_TICKS / 2) blockedCombatTimings.push(performance.now() - started);
}

const atlasFailures = atlasSamples.filter((sample) => sample.ms > MAX_ATLAS_MS || sample.bytes > MAX_ATLAS_BYTES);
const simulationFailures = simulationSamples.filter((sample) => sample.p95Ms > MAX_SIM_P95_MS);
const blockedCombatP95Ms = percentile(blockedCombatTimings, 0.95);
console.log(JSON.stringify({
  maxAtlasMs: MAX_ATLAS_MS,
  maxAtlasBytes: MAX_ATLAS_BYTES,
  maxSimulationP95Ms: MAX_SIM_P95_MS,
  maxBlockedCombatP95Ms: MAX_BLOCKED_COMBAT_P95_MS,
  simulationTicks: SIM_TICKS,
  atlasSamples,
  simulationSamples,
  blockedCombat: {
    units: BLOCKED_COMBAT_UNITS,
    ticks: BLOCKED_COMBAT_TICKS,
    p50Ms: percentile(blockedCombatTimings, 0.5),
    p95Ms: blockedCombatP95Ms,
    maxMs: Math.max(...blockedCombatTimings, 0),
  },
}, null, 2));
if (atlasFailures.length || simulationFailures.length || blockedCombatP95Ms > MAX_BLOCKED_COMBAT_P95_MS) {
  const failures = [
    ...atlasFailures.map((sample) => `terrain ${sample.seed}/${sample.mission}`),
    ...simulationFailures.map((sample) => `simulation ${sample.seed}/${sample.mission}`),
    ...(blockedCombatP95Ms > MAX_BLOCKED_COMBAT_P95_MS ? ["blocked combat"] : []),
  ];
  throw new Error(`Performance budget exceeded for ${failures.join(", ")}`);
}
