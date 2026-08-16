import { UNIT_STATS } from "../catalog";
import { createRng, mixSeed } from "../seed/rng";
import type { BuildingKind, SimEvent, SimState, UnitKind } from "../types";
import { createCampaign } from "../gen/campaign";
import { generateMap } from "../gen/map";
import { tickAi } from "./ai";
import { tickCombat } from "./combat";
import { tickEconomy } from "./economy";
import { makeFog, tickFog } from "./fog";
import { applyCommands, issue } from "./orders";
import { evaluateObjectives, inspect } from "./objectives";
import { stepAlongPath } from "./pathfinding";
import { tickProduction } from "./production";
import { tickRepair } from "./repair";
import { emptyRoleCounts, spawnBuildingAt, spawnUnit } from "./world";
import type { Command } from "../types";

export { issue, inspect };

function tickMovement(state: SimState): void {
  const occupied = new Set<string>();
  const reserved = new Map<string, number>();
  const key = (x: number, y: number) => `${x},${y}`;
  for (const e of state.entities) {
    if (e.hp > 0 && e.class === "unit") occupied.add(key(Math.round(e.x), Math.round(e.y)));
  }
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit") continue;
    const speed = UNIT_STATS[e.kind as UnitKind].speed;
    const currentKey = key(Math.round(e.x), Math.round(e.y));
    const next = e.path[0];
    const targetKey = next ? key(Math.round(next.x), Math.round(next.y)) : currentKey;
    const claim = reserved.get(targetKey);
    if (next && targetKey !== currentKey && (occupied.has(targetKey) || (claim !== undefined && claim !== e.id))) continue;
    if (next && targetKey !== currentKey) reserved.set(targetKey, e.id);
    const beforeKey = currentKey;
    stepAlongPath(e, speed);
    const afterKey = key(Math.round(e.x), Math.round(e.y));
    if (afterKey !== beforeKey) {
      occupied.delete(beforeKey);
      occupied.add(afterKey);
    }
    if (!e.path.length && next && reserved.get(targetKey) === e.id) reserved.delete(targetKey);
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
    heights: map.heights,
    surfaces: map.surfaces,
    biome: map.biome,
    resourceAmount: map.resourceAmount,
    fog: makeFog(map.width, map.height, 0),
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
  spawnBuildingAt(state, 0, "constructionYard", p.x, p.y);
  spawnBuildingAt(state, 0, "power", p.x + 3, p.y);
  spawnBuildingAt(state, 0, "refinery", p.x, p.y + 3);
  spawnUnit(state, 0, "harvester", p.x + 3, p.y + 3);
  spawnUnit(state, 0, "infantry", p.x + 5, p.y + 2);

  spawnBuildingAt(state, 1, "constructionYard", e.x, e.y);
  spawnBuildingAt(state, 1, "power", e.x - 3, e.y);
  spawnBuildingAt(state, 1, "refinery", e.x - 2, e.y - 3);
  spawnBuildingAt(state, 1, "barracks", e.x - 5, e.y - 3);
  spawnBuildingAt(state, 1, "turret", e.x - 5, e.y);
  spawnUnit(state, 1, "harvester", e.x + 1, e.y - 3);
  spawnUnit(state, 1, "infantry", e.x - 1, e.y + 2);
  spawnUnit(state, 1, "tank", e.x - 4, e.y + 1);

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
  if (assault) {
    spawnBuildingAt(state, 1, "turret", e.x + 2, e.y);
    spawnUnit(state, 1, "tank", e.x - 2, e.y + 2);
  }

  if (mission.win.kind === "holdTheLine") {
    spawnUnit(state, 1, "infantry", e.x - 6, e.y);
    spawnUnit(state, 1, "antiArmor", e.x - 6, e.y - 1);
    spawnUnit(state, 1, "tank", e.x - 7, e.y);
  }

  if (mission.win.kind === "destroyMarked") {
    const ids: number[] = [];
    const spots = map.markedSpots.length
      ? map.markedSpots
      : [
          { x: e.x - 4, y: e.y - 6 },
          { x: e.x + 2, y: e.y - 6 },
        ];
    const count = mission.win.targetCount ?? 1;
    for (let i = 0; i < count; i++) {
      const spot = spots[i] ?? { x: e.x - 4 - i * 3, y: e.y - 6 };
      const kind = rng.pick(["refinery", "factory", "objective"]) as BuildingKind;
      const placed = spawnBuildingAt(
        state,
        1,
        kind === "refinery" ? "objective" : kind,
        spot.x,
        spot.y,
        0,
        true,
      );
      if (placed) ids.push(placed.id);
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
  events.push(...tickRepair(state));
  tickAi(state);
  tickFog(state);
  state.tick += 1;
  events.push(...evaluateObjectives(state));
  return { state, events };
}

export function createCampaignAndMission(seed: number, missionIndex: number) {
  return { campaign: createCampaign(seed), state: createMission({ seed, missionIndex }) };
}
