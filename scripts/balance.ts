import { createCampaign } from "../lib/gen/campaign";
import { generateMap } from "../lib/gen/map";
import { parseSeed } from "../lib/seed/rng";
import { createMission, tick } from "../lib/sim/api";
import { applyUpgradeSnapshot } from "../lib/sim/upgrades";
import { powerBreakdown } from "../lib/sim/world";
import { TILE_BLOCKED, TILE_WATER, type Command, type UpgradeId } from "../lib/types";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const from = Number(arg("from", "0"));
const to = Number(arg("to", "9999"));
const missionArg = arg("mission", "all");
const maxTicks = Number(arg("ticks", "1200"));
const requestedUpgrades = arg("upgrades", "").split(",").filter(Boolean) as UpgradeId[];
const missionIndexes = missionArg === "all" ? [...Array(8).keys()] : [Number(missionArg)];

type RecordResult = {
  seed: string;
  mission: number;
  kind: string;
  result: string;
  duration: number;
  credits: number;
  unitsProduced: number;
  aiUnitsProduced: number;
  powerDeficit: boolean;
  casualties: number;
  secondaryCompleted: number;
  upgradeImpact: number;
  mapValid: boolean;
};

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

function runScenario(state: ReturnType<typeof createMission>, map: ReturnType<typeof generateMap>) {
  let powerDeficit = false;
  for (let i = 0; i < maxTicks && state.result === "playing"; i++) {
    tick(state, baselineCommands(state, map));
    powerDeficit ||= powerBreakdown(state, 0).surplus < 0;
  }
  return powerDeficit;
}

function outcomeScore(state: ReturnType<typeof createMission>): number {
  return (state.result === "won" ? 1000 : 0) + state.credits[0] - state.losses.units[0] * 100;
}

const records: RecordResult[] = [];
for (let seed = Math.max(0, from); seed <= Math.min(9999, to); seed++) {
  const parsed = parseSeed(String(seed).padStart(4, "0"));
  if (parsed === null) continue;
  const campaign = createCampaign(parsed);
  for (const mission of missionIndexes) {
    const definition = campaign.missions[mission];
    if (!definition) continue;
    const map = generateMap(parsed, definition);
    const valid = validMap(map);
    const baseline = createMission({ seed: parsed, missionIndex: mission });
    const state = createMission({ seed: parsed, missionIndex: mission });
    if (requestedUpgrades.length) applyUpgradeSnapshot(state, requestedUpgrades);
    const baselinePowerDeficit = runScenario(baseline, map);
    const upgradedPowerDeficit = runScenario(state, map);
    records.push({
      seed: campaign.seed,
      mission,
      kind: definition.win.kind,
      result: state.result,
      duration: state.tick,
      credits: state.credits[0],
      unitsProduced: state.unitsProduced[0],
      aiUnitsProduced: state.unitsProduced[1],
      powerDeficit: upgradedPowerDeficit || baselinePowerDeficit,
      casualties: state.losses.units[0],
      secondaryCompleted: state.result === "won" ? state.runtime?.secondary.filter((objective) => objective.completed).length ?? 0 : 0,
      upgradeImpact: outcomeScore(state) - outcomeScore(baseline),
      mapValid: valid,
    });
  }
}

const wins = records.filter((record) => record.result === "won").length;
console.log(JSON.stringify({
  range: { from, to },
  missions: missionIndexes,
  upgrades: requestedUpgrades,
  ticks: maxTicks,
  samples: records.length,
  winRate: records.length ? wins / records.length : 0,
  mapFailures: records.filter((record) => !record.mapValid).length,
  averages: {
    duration: records.length ? records.reduce((sum, record) => sum + record.duration, 0) / records.length : 0,
    credits: records.length ? records.reduce((sum, record) => sum + record.credits, 0) / records.length : 0,
    casualties: records.length ? records.reduce((sum, record) => sum + record.casualties, 0) / records.length : 0,
  },
  records,
}, null, 2));
