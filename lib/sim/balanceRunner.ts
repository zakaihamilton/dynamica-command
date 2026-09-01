import { performance } from "node:perf_hooks";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import { createCampaign } from "../gen/campaign";
import { generateMap, type GeneratedMap } from "../gen/map";
import { MAX_MISSION_TICKS } from "../gen/pacing";
import { formatSeed } from "../seed/rng";
import { createMissionFromData, tick } from "./api";
import { CompetentCommander } from "./commander";
import { powerBreakdown } from "./world";
import { TILE_BLOCKED, TILE_WATER, type Campaign, type Command, type MissionDef, type SimState } from "../types";
import type { BalanceRecord } from "./balance";

export type BalanceRecordWithScenario = BalanceRecord & {
  seed: string;
  mission: number;
  scenarioMs: number;
};

export type BalanceRunOptions = {
  from: number;
  to: number;
  missions: number[];
  maxTicks?: number;
  strategy?: "competent" | "baseline";
};

export type BalanceProgress = {
  completed: number;
  total: number;
  record: BalanceRecordWithScenario;
};

export type BalanceRunJob = BalanceRunOptions & {
  scenarios: Array<{ seed: number; mission: number }>;
};

export function defaultBalanceJobs(scenarioCount: number): number {
  const available = Math.max(1, cpus().length || 1);
  return Math.max(1, Math.min(available, 8, scenarioCount || 1));
}

export function balanceScenarios(options: BalanceRunOptions): Array<{ seed: number; mission: number }> {
  const missions = [...new Set(options.missions)]
    .filter((mission) => Number.isInteger(mission) && mission >= 0 && mission < 8)
    .sort((a, b) => a - b);
  const from = Math.max(0, Math.min(9999, Math.floor(options.from)));
  const to = Math.max(0, Math.min(9999, Math.floor(options.to)));
  const scenarios: Array<{ seed: number; mission: number }> = [];
  if (to < from) return scenarios;
  for (let seed = from; seed <= to; seed++) {
    for (const mission of missions) scenarios.push({ seed, mission });
  }
  return scenarios;
}

function validMap(map: GeneratedMap): boolean {
  const start = (point: { x: number; y: number }) => {
    const tile = map.tiles[point.y * map.width + point.x];
    return tile !== TILE_BLOCKED && tile !== TILE_WATER;
  };
  return start(map.playerStart) && start(map.enemyStart) &&
    map.markedSpots.every((point) => start(point)) &&
    map.resourceAmount.reduce((sum, amount) => sum + amount, 0) >= 4000;
}

function baselineCommands(state: SimState, map: GeneratedMap): Command[] | undefined {
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
  state: SimState,
  map: GeneratedMap,
  strategy: "competent" | "baseline",
  maxTicks: number,
) {
  let powerDeficit = false;
  let commandsIssued = 0;
  let commandRejections = 0;
  const commander = strategy === "competent" ? new CompetentCommander() : undefined;
  const missionHorizon = state.runtime?.deadline ?? state.win.ticks ?? MAX_MISSION_TICKS;
  const tickLimit = Math.min(maxTicks, missionHorizon);
  for (let i = 0; i < tickLimit && state.result === "playing"; i++) {
    const commands = commander?.plan(state) ?? baselineCommands(state, map);
    commandsIssued += commands?.length ?? 0;
    const result = tick(state, commands);
    commandRejections += result.events.filter((event) => event.type === "commandRejected").length;
    if (state.result === "playing") powerDeficit ||= powerBreakdown(state, 0).surplus < 0;
  }
  return {
    powerDeficit,
    commandsIssued,
    commandRejections,
    truncated: state.result === "playing" && tickLimit < missionHorizon,
  };
}

function runOne(
  seed: number,
  missionIndex: number,
  strategy: "competent" | "baseline",
  maxTicks: number,
  campaign: Campaign,
  map: GeneratedMap,
): BalanceRecordWithScenario {
  const scenarioStartedAt = performance.now();
  const definition: MissionDef | undefined = campaign.missions[missionIndex];
  if (!definition) throw new Error(`No mission ${missionIndex}`);
  const state = createMissionFromData({
    seed,
    missionIndex,
    campaign,
    mission: definition,
    map,
  });
  const run = runScenario(state, map, strategy, maxTicks);
  const scenarioMs = performance.now() - scenarioStartedAt;
  return {
    seed: formatSeed(seed),
    mission: missionIndex,
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
    mapValid: validMap(map),
    commandsIssued: run.commandsIssued,
    commandRejections: run.commandRejections,
    lossReason: state.lossReason,
    scenarioMs,
  };
}

export function runBalanceJob(job: BalanceRunJob, onRecord?: (record: BalanceRecordWithScenario) => void): BalanceRecordWithScenario[] {
  const strategy = job.strategy ?? "competent";
  const maxTicks = job.maxTicks ?? MAX_MISSION_TICKS;
  const campaigns = new Map<number, Campaign>();
  const maps = new Map<string, GeneratedMap>();
  const records: BalanceRecordWithScenario[] = [];
  for (const { seed, mission } of job.scenarios) {
    const campaign = campaigns.get(seed) ?? createCampaign(seed);
    campaigns.set(seed, campaign);
    const definition = campaign.missions[mission];
    if (!definition) throw new Error(`No mission ${mission}`);
    const mapKey = `${seed}:${mission}`;
    const map = maps.get(mapKey) ?? generateMap(seed, definition);
    maps.set(mapKey, map);
    const record = runOne(seed, mission, strategy, maxTicks, campaign, map);
    records.push(record);
    onRecord?.(record);
  }
  return records;
}

export function sortBalanceRecords(records: BalanceRecordWithScenario[]): BalanceRecordWithScenario[] {
  return [...records].sort((a, b) => Number(a.seed) - Number(b.seed) || a.mission - b.mission);
}

function runWorker(
  job: BalanceRunJob,
  onRecord?: (record: BalanceRecordWithScenario) => void,
): Promise<BalanceRecordWithScenario[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../scripts/balanceWorker.cjs", import.meta.url), {
      workerData: {
        from: job.from,
        to: job.to,
        missions: job.missions,
        maxTicks: job.maxTicks,
        strategy: job.strategy,
        scenarios: job.scenarios,
      },
    });
    worker.on("message", (message: { type: "progress" | "complete"; record?: BalanceRecordWithScenario; records?: BalanceRecordWithScenario[] }) => {
      if (message.type === "progress" && message.record) onRecord?.(message.record);
      if (message.type === "complete" && message.records) resolve(message.records);
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Balance worker exited with code ${code}`));
    });
  });
}

export async function runBalanceScenarios(
  options: BalanceRunOptions & { jobs?: number; onProgress?: (progress: BalanceProgress) => void },
): Promise<BalanceRecordWithScenario[]> {
  const scenarios = balanceScenarios(options);
  const requestedJobs = options.jobs ?? defaultBalanceJobs(scenarios.length);
  const jobs = Math.max(1, Math.min(Math.floor(requestedJobs) || 1, scenarios.length || 1));
  let completed = 0;
  const report = (record: BalanceRecordWithScenario) => {
    completed += 1;
    options.onProgress?.({ completed, total: scenarios.length, record });
  };
  const jobOptions = {
    from: options.from,
    to: options.to,
    missions: options.missions,
    maxTicks: options.maxTicks,
    strategy: options.strategy,
  };
  if (jobs === 1 || scenarios.length < 2) return sortBalanceRecords(runBalanceJob({ ...jobOptions, scenarios }, report));

  const assignments = Array.from({ length: jobs }, () => [] as Array<{ seed: number; mission: number }>);
  const groupedBySeed = new Map<number, Array<{ seed: number; mission: number }>>();
  for (const scenario of scenarios) {
    const group = groupedBySeed.get(scenario.seed) ?? [];
    group.push(scenario);
    groupedBySeed.set(scenario.seed, group);
  }
  const seedGroups = [...groupedBySeed.values()];
  seedGroups.forEach((group, index) => assignments[index % jobs]!.push(...group));
  const results = await Promise.all(assignments.filter((assignment) => assignment.length).map((assignment) =>
    runWorker({ ...jobOptions, scenarios: assignment }, report),
  ));
  return sortBalanceRecords(results.flat());
}

/** Remove machine timing so gameplay records can be compared byte-for-byte. */
export function stableBalanceRecords(records: BalanceRecordWithScenario[]): BalanceRecord[] {
  return sortBalanceRecords(records).map(({ scenarioMs: _scenarioMs, ...record }) => {
    void _scenarioMs;
    return record;
  });
}
