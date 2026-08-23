import { STARTING_CREDITS } from "../catalog";
import { createRng, mixSeed } from "../seed/rng";
import type { SimEvent, SimState, UnitKind } from "../types";
import { createCampaign } from "../gen/campaign";
import { generateMap } from "../gen/map";
import { tickAi } from "./ai";
import { tickCombat } from "./combat";
import { tickEconomy } from "./economy";
import { makeFog, tickFog } from "./fog";
import { applyCommands, issue } from "./orders";
import { evaluateObjectives, inspect } from "./objectives";
import { resetPathBudget } from "./pathBudget";
import { tickProduction } from "./production";
import { tickRepair } from "./repair";
import { tickSupport } from "./support";
import { ensureMissionDirector, tickMissionDirector } from "./director";
import { configureMissionScenario, tickScenario } from "./scenarios";
import { emptyRoleCounts, spawnBuildingAt, spawnUnit } from "./world";
import type { Command } from "../types";
import { missionDifficulty } from "./difficulty";
import { tickMovement } from "./movement";

export { issue, inspect };
export { CONVOY_STAGING_TICKS } from "./scenarios";

export function createMission(opts: { seed: number; missionIndex: number }): SimState {
  const campaign = createCampaign(opts.seed);
  const mission = campaign.missions[opts.missionIndex];
  if (!mission) throw new Error(`No mission ${opts.missionIndex}`);
  const map = generateMap(opts.seed, mission);
  const rng = createRng(opts.seed, `mission-spawn:${opts.missionIndex}`);
  const difficulty = missionDifficulty(mission.index);

  const state: SimState = {
    seed: opts.seed,
    missionIndex: opts.missionIndex,
    tick: 0,
    width: map.width,
    height: map.height,
    tiles: map.tiles,
    heights: map.heights,
    surfaces: map.surfaces,
    biome: map.biome,
    resourceAmount: map.resourceAmount,
    fog: makeFog(map.width, map.height, 0),
    entities: [],
    nextId: 1,
    credits: [STARTING_CREDITS.player, STARTING_CREDITS.enemy],
    creditsEarned: [0, 0],
    unitsProduced: [0, 0],
    unitsProducedByRole: emptyRoleCounts(),
    buildingsCompleted: [0, 0],
    buildingsCompletedByKind: {},
    losses: { units: [0, 0], buildings: [0, 0] },
    win: { ...mission.win },
    result: "playing",
    rngState: mixSeed(opts.seed, `sim:${opts.missionIndex}`) || 1,
    factions: campaign.factions,
    missionName: mission.name,
    missionKind: mission.win.kind,
    aiState: "economy",
  };

  const p = map.playerStart;
  const e = map.enemyStart;
  const offensiveMission = ["sabotage", "destroyMarked", "razeAll", "decapitate", "annihilate"].includes(mission.win.kind);
  spawnBuildingAt(state, 0, "constructionYard", p.x, p.y);
  spawnBuildingAt(state, 0, "power", p.x + 3, p.y);
  spawnBuildingAt(state, 0, "refinery", p.x, p.y + 3);
  spawnUnit(state, 0, "harvester", p.x + 3, p.y + 3);
  spawnUnit(state, 0, "infantry", p.x + 5, p.y + 2);
  if (mission.index >= 1 || offensiveMission) {
    spawnBuildingAt(state, 0, "turret", p.x + 5, p.y);
    spawnBuildingAt(state, 0, "barracks", p.x + 3, p.y - 3);
    spawnUnit(state, 0, "antiArmor", p.x + 5, p.y + 4);
  }
  if (mission.index >= 4 || offensiveMission) {
    spawnUnit(state, 0, "tank", p.x + 6, p.y + 4);
  }
  if (mission.index >= 3 || offensiveMission) {
    spawnBuildingAt(state, 0, "factory", p.x, p.y - 5);
  }
  if (mission.index === 0 && !offensiveMission) {
    spawnBuildingAt(state, 0, "barracks", p.x + 3, p.y - 3);
  }

  spawnBuildingAt(state, 1, "constructionYard", e.x, e.y);
  spawnBuildingAt(state, 1, "power", e.x - 3, e.y);
  spawnBuildingAt(state, 1, "refinery", e.x - 2, e.y - 3);
  spawnBuildingAt(state, 1, "barracks", e.x - 5, e.y - 3);
  if (difficulty.startingTurret) {
    spawnBuildingAt(state, 1, "turret", e.x - 5, e.y);
  }
  spawnUnit(state, 1, "harvester", e.x + 1, e.y - 3);
  spawnUnit(state, 1, "infantry", e.x - 1, e.y + 2);
  if (difficulty.startingTank) {
    spawnUnit(state, 1, "tank", e.x - 4, e.y + 1);
  }

  const extraGuards = Math.floor(mission.index / 2);
  for (let i = 0; i < extraGuards; i++) {
    spawnUnit(state, 1, i % 2 === 0 ? "infantry" : "antiArmor", e.x - 6 - (i % 2), e.y + 1 + i);
  }
  if (mission.index >= 3) {
    spawnBuildingAt(state, 1, "factory", e.x, e.y - 6);
    spawnBuildingAt(state, 1, "turret", e.x + 3, e.y - 3);
  }

  const assault =
    mission.win.kind === "razeAll" ||
    mission.win.kind === "decapitate" ||
    mission.win.kind === "annihilate" ||
    mission.win.kind === "destroyMarked";
  if (assault && difficulty.assaultSupport) {
    spawnBuildingAt(state, 1, "turret", e.x + 2, e.y);
    spawnUnit(state, 1, "tank", e.x - 2, e.y + 2);
  }

  if (mission.win.kind === "holdTheLine") {
    const holdLineKinds: UnitKind[] = ["infantry", "antiArmor", "tank", "infantry"];
    for (let i = 0; i < difficulty.holdLineReinforcements; i++) {
      const kind = holdLineKinds[i]!;
      spawnUnit(state, 1, kind, e.x - 6 - (i % 2), e.y - (i % 3));
    }
  }

  configureMissionScenario(state, map, mission, rng);

  ensureMissionDirector(state);
  tickFog(state);
  return state;
}

export function tick(state: SimState, commands?: Command[]): { state: SimState; events: SimEvent[] } {
  resetPathBudget();
  const events: SimEvent[] = [];
  if (commands?.length) events.push(...applyCommands(state, commands));
  if (state.result !== "playing") return { state, events };
  events.push(...tickProduction(state));
  events.push(...tickEconomy(state));
  tickMovement(state);
  events.push(...tickCombat(state));
  events.push(...tickRepair(state));
  events.push(...tickSupport(state));
  events.push(...tickMissionDirector(state));
  tickAi(state);
  tickFog(state);
  state.tick += 1;
  events.push(...tickScenario(state));
  events.push(...evaluateObjectives(state));
  return { state, events };
}

export function createCampaignAndMission(seed: number, missionIndex: number) {
  return { campaign: createCampaign(seed), state: createMission({ seed, missionIndex }) };
}
