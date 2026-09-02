import { performance } from "node:perf_hooks";
import { MAX_OPERATION_TICKS } from "../lib/gen/pacing";
import {
  balanceScenarios,
  defaultBalanceJobs,
  runBalanceScenarios,
  stableBalanceRecords,
  type BalanceRunOptions,
} from "../lib/sim/balanceRunner";
import { checkBalance, DEFAULT_BALANCE_THRESHOLDS, summarizeBalance, type BalanceThresholds } from "../lib/sim/balance";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const from = Number(arg("from", "0"));
const to = Number(arg("to", "99"));
const missionArg = arg("mission", "all");
const maxTicks = Number(arg("ticks", String(MAX_OPERATION_TICKS)));
const strategyArg = arg("strategy", "competent");
const details = arg("details", "false") === "true";
const shouldCheck = arg("check", "false") === "true";
const progressEnabled = arg("progress", "true") !== "false";
const progressEvery = Math.max(1, Number(arg("progress-every", "1")) || 1);
const requestedJobs = Math.max(0, Number(arg("jobs", "0")) || 0);
const missions = missionArg === "all" ? [...Array(8).keys()] : [Number(missionArg)];

if (strategyArg !== "competent" && strategyArg !== "baseline") {
  throw new Error(`Unknown strategy ${strategyArg}; use competent or baseline`);
}
const strategy: "competent" | "baseline" = strategyArg;

async function main() {
  const options: BalanceRunOptions = { from, to, missions, maxTicks, strategy };
  const scenarios = balanceScenarios(options);
  const jobs = requestedJobs > 0 ? requestedJobs : defaultBalanceJobs(scenarios.length);
  const startedAt = performance.now();
  const records = await runBalanceScenarios({
    ...options,
    jobs,
    onProgress: progressEnabled ? ({ completed, total, record }) => {
      if (completed % progressEvery !== 0 && completed !== total) return;
      console.error(`[balance] ${completed}/${total} ${record.seed} mission ${record.mission} → ${record.result}`);
    } : undefined,
  });
  const elapsedMs = performance.now() - startedAt;
  const summary = summarizeBalance(records);
  const thresholds: BalanceThresholds = {
  ...DEFAULT_BALANCE_THRESHOLDS,
  minWinRate: Number(arg("min-win-rate", String(DEFAULT_BALANCE_THRESHOLDS.minWinRate))),
  maxWinRate: Number(arg("max-win-rate", String(DEFAULT_BALANCE_THRESHOLDS.maxWinRate))),
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

  const scenarioTimes = records.map((record) => record.scenarioMs);
  const slowestIndex = scenarioTimes.reduce((best, value, index) => value > (scenarioTimes[best] ?? -1) ? index : best, 0);
  const slowest = records[slowestIndex];
  console.log(JSON.stringify({
  strategy,
  jobs,
  range: { from, to },
  missions: [...new Set(missions)].filter((mission) => Number.isInteger(mission) && mission >= 0 && mission < 8).sort((a, b) => a - b),
  ticks: maxTicks,
  samples: records.length,
  timing: {
    elapsedMs: Number(elapsedMs.toFixed(2)),
    averageScenarioMs: records.length ? Number((scenarioTimes.reduce((sum, ms) => sum + ms, 0) / records.length).toFixed(2)) : 0,
    slowestScenarioMs: slowest ? Number(slowest.scenarioMs.toFixed(2)) : 0,
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
  byMission: summary.byMission,
  ...(acceptance ? { acceptance: { ...acceptance, thresholds } } : {}),
  ...(details ? { records: stableBalanceRecords(records) } : {}),
  }, null, 2));

  if (acceptance && !acceptance.passed) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
