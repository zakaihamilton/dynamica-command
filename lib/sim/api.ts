import { UNIT_STATS } from "../catalog";
import { createRng, mixSeed } from "../seed/rng";
import type { BuildingKind, SimEvent, SimState, UnitKind } from "../types";
import { createCampaign } from "../gen/campaign";
import { generateMap } from "../gen/map";
import { tickAi } from "./ai";
import { tickCombat } from "./combat";
import { tickEconomy } from "./economy";
import { tickFog } from "./fog";
import { applyCommands, issue } from "./orders";
import { evaluateObjectives, inspect } from "./objectives";
import { stepAlongPath } from "./pathfinding";
import { tickProduction } from "./production";
import { emptyRoleCounts, spawnBuilding, spawnUnit } from "./world";
import type { Command } from "../types";

export { issue, inspect };

function tickMovement(state: SimState): void {
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit") continue;
    const speed = UNIT_STATS[e.kind as UnitKind].speed;
    stepAlongPath(e, speed);
  }
}

export function createMission(opts: { seed: number; missionIndex: number }): SimState {
  const campaign = createCampaign(opts.seed);
  const mission = campaign.missions[opts.missionIndex];
  if (!mission) throw new Error(`No mission ${opts.missionIndex}`);
  const map = generateMap(opts.seed, mission);
  const rng = createRng(opts.seed, `mission-spawn:${opts.missionIndex}`);

  const state: SimState = {
    seed: opts.seed,
    missionIndex: opts.missionIndex,
    tick: 0,
    width: map.width,
    height: map.height,
    tiles: map.tiles,
    resourceAmount: map.resourceAmount,
    fog: new Array(map.width * map.height).fill(0),
    entities: [],
    nextId: 1,
    credits: [1000, 1400],
    creditsEarned: [0, 0],
    unitsProduced: [0, 0],
    unitsProducedByRole: emptyRoleCounts(),
    buildingsCompleted: [0, 0],
    buildingsCompletedByKind: {},
    win: { ...mission.win },
    result: "playing",
    rngState: mixSeed(opts.seed, `sim:${opts.missionIndex}`) || 1,
    factions: campaign.factions,
    missionName: mission.name,
  };

  const p = map.playerStart;
  const e = map.enemyStart;
  spawnBuilding(state, 0, "constructionYard", p.x, p.y);
  spawnBuilding(state, 0, "power", p.x + 2, p.y);
  spawnBuilding(state, 0, "refinery", p.x, p.y + 2);
  spawnUnit(state, 0, "harvester", p.x + 1, p.y + 2);
  spawnUnit(state, 0, "infantry", p.x + 3, p.y);

  spawnBuilding(state, 1, "constructionYard", e.x, e.y);
  spawnBuilding(state, 1, "power", e.x - 2, e.y);
  spawnBuilding(state, 1, "refinery", e.x, e.y - 2);
  spawnBuilding(state, 1, "barracks", e.x - 2, e.y - 2);
  spawnBuilding(state, 1, "turret", e.x - 3, e.y - 1);
  spawnUnit(state, 1, "harvester", e.x - 1, e.y - 2);
  spawnUnit(state, 1, "infantry", e.x - 3, e.y);
  spawnUnit(state, 1, "tank", e.x - 3, e.y - 1);

  const extraGuards = Math.floor(mission.index / 2);
  for (let i = 0; i < extraGuards; i++) {
    spawnUnit(state, 1, i % 2 === 0 ? "infantry" : "antiArmor", e.x - 4 - (i % 2), e.y - i);
  }
  if (mission.index >= 3) {
    spawnBuilding(state, 1, "factory", e.x - 4, e.y - 2);
    spawnBuilding(state, 1, "turret", e.x - 1, e.y - 4);
  }

  const assault =
    mission.win.kind === "razeAll" ||
    mission.win.kind === "decapitate" ||
    mission.win.kind === "annihilate" ||
    mission.win.kind === "destroyMarked";
  if (assault) {
    spawnBuilding(state, 1, "turret", e.x + 1, e.y - 2);
    spawnUnit(state, 1, "tank", e.x - 2, e.y + 1);
  }

  if (mission.win.kind === "holdTheLine") {
    spawnUnit(state, 1, "infantry", e.x - 4, e.y);
    spawnUnit(state, 1, "antiArmor", e.x - 4, e.y - 1);
    spawnUnit(state, 1, "tank", e.x - 5, e.y);
  }

  if (mission.win.kind === "destroyMarked") {
    const ids: number[] = [];
    const spots = map.markedSpots.length
      ? map.markedSpots
      : [
          { x: e.x - 3, y: e.y - 3 },
          { x: e.x - 4, y: e.y - 2 },
        ];
    const count = mission.win.targetCount ?? 1;
    for (let i = 0; i < count; i++) {
      const spot = spots[i] ?? { x: e.x - 3 - i, y: e.y - 3 };
      const kind = (rng.pick(["refinery", "factory", "objective"]) as BuildingKind);
      const b = spawnBuilding(state, 1, kind === "refinery" ? "objective" : kind, spot.x, spot.y, 0, true);
      ids.push(b.id);
    }
    state.win.targetIds = ids;
  }

  tickFog(state);
  return state;
}

export function tick(state: SimState, commands?: Command[]): { state: SimState; events: SimEvent[] } {
  const events: SimEvent[] = [];
  if (commands?.length) events.push(...applyCommands(state, commands));
  if (state.result !== "playing") return { state, events };
  events.push(...tickProduction(state));
  events.push(...tickEconomy(state));
  tickMovement(state);
  events.push(...tickCombat(state));
  tickAi(state);
  tickFog(state);
  state.tick += 1;
  events.push(...evaluateObjectives(state));
  return { state, events };
}

export function createCampaignAndMission(seed: number, missionIndex: number) {
  return { campaign: createCampaign(seed), state: createMission({ seed, missionIndex }) };
}
