import { performance } from "node:perf_hooks";
import { createCampaign } from "../lib/gen/campaign";
import { generateMap } from "../lib/gen/map";
import { MAX_MISSION_TICKS } from "../lib/gen/pacing";
import { parseSeed } from "../lib/seed/rng";
import { checkBalance, DEFAULT_BALANCE_THRESHOLDS, summarizeBalance, type BalanceRecord, type BalanceThresholds } from "../lib/sim/balance";
import { CompetentCommander } from "../lib/sim/commander";
import { createMission, tick } from "../lib/sim/api";
import { powerBreakdown } from "../lib/sim/world";
import { TILE_BLOCKED, TILE_WATER, type Command } from "../lib/types";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const from = Number(arg("from", "0"));
const to = Number(arg("to", "99"));
const missionArg = arg("mission", "all");
const maxTicks = Number(arg("ticks", String(MAX_MISSION_TICKS)));
const strategy = arg("strategy", "competent");
const details = arg("details", "false") === "true";
const shouldCheck = arg("check", "false") === "true";
const progressEnabled = arg("progress", "true") !== "false";
const progressEvery = Math.max(1, Number(arg("progress-every", "1")) || 1);
const missionIndexes = missionArg === "all" ? [...Array(8).keys()] : [Number(missionArg)];
const seedStart = Math.max(0, from);
const seedEnd = Math.min(9999, to);
const runnableMissions = missionIndexes.filter((mission) => Number.isInteger(mission) && mission >= 0 && mission < 8);
const totalScenarios = seedEnd >= seedStart ? (seedEnd - seedStart + 1) * runnableMissions.length : 0;

if (strategy !== "competent" && strategy !== "baseline") {
  throw new Error(`Unknown strategy ${strategy}; use competent or baseline`);
}

type RecordResult = BalanceRecord & {
  seed: string;
  mission: number;
  scenarioMs: number;
};

type ScenarioTiming = {
  seed: string;
  mission: number;
  kind: string;
  ms: number;
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function validMap(map: ReturnType<typeof generateMap>): boolean {
  const start = (point: { x: number; y: number }) => {
    const tile = map.tiles[point.y * map.width + point.x];
    return tile !== TILE_BLOCKED && tile !== TILE_WATER;
  };
  return start(map.playerStart) && start(map.enemyStart) &&
    map.markedSpots.every((point) => start(point)) &&
    map.resourceAmount.reduce((sum, amount) => sum + amount, 0) >= 4000;
}

function baselineCommands(state: ReturnType<typeof createMission>, map: ReturnType<typeof generateMap>) {
  if (state.tick % 60 !== 0) return undefined;
  const units = state.entities.filter((entity) => entity.owner === 0 && entity.class === "unit" && entity.hp > 0 && !entity.neutral);
  const combat = units.filter((entity) => entity.kind !== "harvester").map((entity) => entity.id);
  const harvesters = units.filter((entity) => entity.kind === "harvester").map((entity) => entity.id);
  const commands: Command[] = [];
  if (combat.length) commands.push({ type: "attackMove", unitIds: combat, x: map.enemyStart.x, y: map.enemyStart.y });
  if (harvesters.length) commands.push({ type: "harvest", unitIds: harvesters, x: map.playerStart.x + 4, y: map.playerStart.y + 4 });
  return commands;
}

function runScenario(
  state: ReturnType<typeof createMission>,
  map: ReturnType<typeof generateMap>,
  selectedStrategy: string,
) {
  let powerDeficit = false;
  let commandsIssued = 0;
  let commandRejections = 0;
  const commander = selectedStrategy === "competent" ? new CompetentCommander() : undefined;
  const missionHorizon = state.runtime?.deadline ?? state.win.ticks ?? MAX_MISSION_TICKS;
  const tickLimit = Math.min(maxTicks, missionHorizon);
  for (let i = 0; i < tickLimit && state.result === "playing"; i++) {
    const commands = commander?.plan(state) ?? baselineCommands(state, map);
    commandsIssued += commands?.length ?? 0;
    const result = tick(state, commands);
    commandRejections += result.events.filter((event) => event.type === "commandRejected").length;
    powerDeficit ||= powerBreakdown(state, 0).surplus < 0;
  }
  return {
    powerDeficit,
    commandsIssued,
    commandRejections,
    truncated: state.result === "playing" && tickLimit < missionHorizon,
  };
}

const records: RecordResult[] = [];
const timings: ScenarioTiming[] = [];
let totalScenarioMs = 0;
const startedAt = performance.now();
for (let seed = seedStart; seed <= seedEnd; seed++) {
  const parsed = parseSeed(String(seed).padStart(4, "0"));
  if (parsed === null) continue;
  const campaign = createCampaign(parsed);
  for (const mission of runnableMissions) {
    const definition = campaign.missions[mission];
    if (!definition) continue;
    const map = generateMap(parsed, definition);
    const valid = validMap(map);
    const state = createMission({ seed: parsed, missionIndex: mission });
    const scenarioStartedAt = performance.now();
    const run = runScenario(state, map, strategy);
    const scenarioMs = performance.now() - scenarioStartedAt;
    totalScenarioMs += scenarioMs;
    timings.push({ seed: campaign.seed, mission, kind: definition.win.kind, ms: scenarioMs });
    records.push({
      seed: campaign.seed,
      mission,
      kind: definition.win.kind,
      result: state.result,
      truncated: run.truncated,
      duration: state.tick,
      credits: state.credits[0],
      unitsProduced: state.unitsProduced[0],
      aiUnitsProduced: state.unitsProduced[1],
      powerDeficit: run.powerDeficit,
      casualties: state.losses.units[0],
      secondaryCompleted: state.result === "won" ? state.runtime?.secondary.filter((objective) => objective.completed).length ?? 0 : 0,
      mapValid: valid,
      commandsIssued: run.commandsIssued,
      commandRejections: run.commandRejections,
      lossReason: state.lossReason,
      scenarioMs,
    });
    if (progressEnabled && records.length % progressEvery === 0) {
      const elapsedMs = performance.now() - startedAt;
      const averageMs = totalScenarioMs / records.length;
      const remainingMs = Math.max(0, totalScenarios - records.length) * averageMs;
      console.error(
        `[balance] ${records.length}/${totalScenarios} ${campaign.seed} mission ${mission} ` +
        `${definition.win.kind} → ${state.result} in ${formatDuration(scenarioMs)} ` +
        `(${formatDuration(elapsedMs)} elapsed, ~${formatDuration(remainingMs)} remaining)`,
      );
    }
  }
}

const summary = summarizeBalance(records);
const thresholds: BalanceThresholds = {
  ...DEFAULT_BALANCE_THRESHOLDS,
  minWinRate: Number(arg("min-win-rate", String(DEFAULT_BALANCE_THRESHOLDS.minWinRate))),
  maxTimeoutRate: Number(arg("max-timeout-rate", String(DEFAULT_BALANCE_THRESHOLDS.maxTimeoutRate))),
  minKindSamples: Number(arg("min-kind-samples", String(DEFAULT_BALANCE_THRESHOLDS.minKindSamples))),
  minKindWinRate: Number(arg("min-kind-win-rate", String(DEFAULT_BALANCE_THRESHOLDS.minKindWinRate))),
  maxKindTimeoutRate: Number(arg("max-kind-timeout-rate", String(DEFAULT_BALANCE_THRESHOLDS.maxKindTimeoutRate))),
  maxTruncatedRate: Number(arg("max-truncated-rate", String(DEFAULT_BALANCE_THRESHOLDS.maxTruncatedRate))),
  maxMapFailureRate: Number(arg("max-map-failure-rate", String(DEFAULT_BALANCE_THRESHOLDS.maxMapFailureRate))),
  maxPowerDeficitRate: Number(arg("max-power-deficit-rate", String(DEFAULT_BALANCE_THRESHOLDS.maxPowerDeficitRate))),
  maxCommandRejectionRate: Number(arg("max-command-rejection-rate", String(DEFAULT_BALANCE_THRESHOLDS.maxCommandRejectionRate))),
  maxAverageCasualties: Number(arg("max-average-casualties", String(DEFAULT_BALANCE_THRESHOLDS.maxAverageCasualties))),
};
const acceptance = shouldCheck ? checkBalance(summary, thresholds) : undefined;
const elapsedMs = performance.now() - startedAt;
const slowest = timings.reduce<ScenarioTiming | undefined>(
  (current, timing) => !current || timing.ms > current.ms ? timing : current,
  undefined,
);

console.log(JSON.stringify({
  strategy,
  range: { from, to },
  missions: runnableMissions,
  ticks: maxTicks,
  samples: records.length,
  timing: {
    elapsedMs: Number(elapsedMs.toFixed(2)),
    averageScenarioMs: records.length ? Number((totalScenarioMs / records.length).toFixed(2)) : 0,
    slowestScenarioMs: slowest ? Number(slowest.ms.toFixed(2)) : 0,
    slowestScenario: slowest ? { seed: slowest.seed, mission: slowest.mission, kind: slowest.kind } : null,
  },
  winRate: summary.winRate,
  wins: summary.wins,
  losses: summary.losses,
  timeouts: summary.timeouts,
  truncatedRate: summary.truncatedRate,
  mapFailures: Math.round(summary.mapFailureRate * summary.samples),
  commandRejectionRate: summary.commandRejectionRate,
  powerDeficitRate: summary.powerDeficitRate,
  averages: {
    duration: summary.averageDuration,
    credits: summary.averageCredits,
    casualties: summary.averageCasualties,
    unitsProduced: summary.averageUnitsProduced,
    commands: summary.averageCommands,
    commandRejections: summary.averageCommandRejections,
  },
  byMissionKind: summary.byMissionKind,
  ...(acceptance ? { acceptance: { ...acceptance, thresholds } } : {}),
  ...(details ? { records } : {}),
}, null, 2));

if (acceptance && !acceptance.passed) process.exitCode = 1;
