import { UNIT_STATS } from "../catalog";
import { createRng, mixSeed } from "../seed/rng";
import { RESCUE_CONTACT_RADIUS } from "../types";
import type { BuildingKind, MissionRuntime, SimEvent, SimState, UnitKind } from "../types";
import { createCampaign } from "../gen/campaign";
import { generateMap } from "../gen/map";
import { tickAi } from "./ai";
import { tickCombat } from "./combat";
import { tickEconomy } from "./economy";
import { makeFog, tickFog } from "./fog";
import { applyCommands, issue } from "./orders";
import { evaluateObjectives, inspect } from "./objectives";
import { findPath, stepAlongPath } from "./pathfinding";
import { tickProduction } from "./production";
import { tickRepair } from "./repair";
import { emptyRoleCounts, spawnBuildingAt, spawnUnit } from "./world";
import type { Command } from "../types";
import { missionDifficulty } from "./difficulty";

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
    const speed = UNIT_STATS[e.kind as UnitKind].speed * (1 - Math.min(0.4, (e.suppression ?? 0) / 250));
    const currentKey = key(Math.round(e.x), Math.round(e.y));
    const next = e.path[0];
    const targetKey = next ? key(Math.round(next.x), Math.round(next.y)) : currentKey;
    const claim = reserved.get(targetKey);
    const blockedByUnit = next && targetKey !== currentKey && occupied.has(targetKey);
    const blocked = blockedByUnit || (next && targetKey !== currentKey && claim !== undefined && claim !== e.id);
    if (blocked) {
      e.blockedTicks = (e.blockedTicks ?? 0) + 1;
      if (e.blockedTicks === 1 || e.blockedTicks % 6 === 0) {
        const destination = e.path[e.path.length - 1];
        if (destination) {
          const detour = findPath(state, e, destination);
          const detourFirst = detour[0];
          if (detourFirst && !occupied.has(key(Math.round(detourFirst.x), Math.round(detourFirst.y)))) {
            e.path = detour;
          }
        }
      }
      continue;
    }
    e.blockedTicks = 0;
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
    credits: [1000, 1400],
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
    appliedUpgrades: [],
    aiState: "economy",
  };

  const p = map.playerStart;
  const e = map.enemyStart;
  spawnBuildingAt(state, 0, "constructionYard", p.x, p.y);
  spawnBuildingAt(state, 0, "power", p.x + 3, p.y);
  spawnBuildingAt(state, 0, "refinery", p.x, p.y + 3);
  spawnUnit(state, 0, "harvester", p.x + 3, p.y + 3);
  spawnUnit(state, 0, "infantry", p.x + 5, p.y + 2);
  if (mission.index === 0) {
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

  if (["escort", "sabotage", "rescue", "extraction"].includes(mission.win.kind)) {
    const kind = mission.win.kind;
    const targetIds: number[] = [];
    const count = mission.win.targetCount ?? 2;
    if (kind === "sabotage") {
      for (let i = 0; i < count; i++) {
        const spot = map.markedSpots[i] ?? { x: e.x - 4 - i * 3, y: e.y - 5 + (i % 2) * 2 };
        const objective = spawnBuildingAt(state, 1, "objective", spot.x, spot.y, 0, true);
        if (objective) targetIds.push(objective.id);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const point = centerPoint(map, i, count);
        const target = spawnUnit(state, 0, kind === "escort" ? "tank" : "infantry", point.x, point.y);
        target.neutral = kind === "escort" || kind === "rescue" || kind === "extraction";
        targetIds.push(target.id);
        if (kind === "escort") {
          target.path = stepRoute(state, target, map.enemyStart);
        }
      }
    }
    const runtime: MissionRuntime = {
      kind,
      phase: "active",
      targetIds,
      zone: kind === "rescue" ? map.playerStart : map.enemyStart,
      deadline: state.tick + (mission.win.ticks ?? 3600),
      rescued: 0,
      required: count,
      secondary: [
        { id: "yard", kind: "preserveYard", label: "Keep the construction yard standing" },
        { id: "time", kind: "completeBefore", label: "Complete the operation before the deadline", target: mission.win.ticks ?? 3600 },
      ],
    };
    state.runtime = runtime;
    state.win.targetIds = targetIds;
  }

  if (!state.runtime) {
    const secondary = rng.chance(0.5)
      ? { id: "survivors", kind: "keepUnits" as const, label: "Keep at least one combat unit alive", target: 1 }
      : { id: "tempo", kind: "completeBefore" as const, label: "Complete the operation before the final push", target: (mission.win.ticks ?? 3600) + 1 };
    state.runtime = {
      kind: mission.win.kind,
      phase: "active",
      targetIds: mission.win.targetIds ?? [],
      rescued: 0,
      required: mission.win.targetCount ?? 1,
      secondary: [
        { id: "yard", kind: "preserveYard", label: "Keep the construction yard standing" },
        secondary,
      ],
    };
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
  tickScenario(state);
  events.push(...evaluateObjectives(state));
  return { state, events };
}

function centerPoint(map: { playerStart: { x: number; y: number }; enemyStart: { x: number; y: number } }, index: number, count: number) {
  const t = (index + 1) / (count + 1);
  return {
    x: Math.round(map.playerStart.x + (map.enemyStart.x - map.playerStart.x) * t),
    y: Math.round(map.playerStart.y + (map.enemyStart.y - map.playerStart.y) * t),
  };
}

function stepRoute(state: SimState, from: { x: number; y: number }, to: { x: number; y: number }) {
  return [...Array.from({ length: 3 }, (_, i) => ({
    x: Math.round(from.x + (to.x - from.x) * (i + 1) / 4),
    y: Math.round(from.y + (to.y - from.y) * (i + 1) / 4),
  })), { x: to.x, y: to.y }];
}

function tickScenario(state: SimState): void {
  const runtime = state.runtime;
  if (!runtime || runtime.phase === "complete") return;
  const yard = state.entities.find((e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0);
  if (runtime.kind === "rescue" || runtime.kind === "extraction") {
    const rescuers = state.entities.filter(
      (e) => e.owner === 0 && e.class === "unit" && e.hp > 0 && !e.neutral,
    );
    for (const id of runtime.targetIds) {
      const e = state.entities.find((item) => item.id === id && item.hp > 0);
      if (!e?.neutral) continue;
      e.path = [];
      e.idle = true;
      if (rescuers.some((rescuer) => Math.hypot(rescuer.x - e.x, rescuer.y - e.y) <= RESCUE_CONTACT_RADIUS)) {
        e.neutral = false;
        if (runtime.kind === "rescue") runtime.rescued += 1;
      }
    }
  }
  if (runtime.kind === "escort" || runtime.kind === "extraction") {
    const zone = runtime.zone;
    if (zone) {
      runtime.rescued = runtime.targetIds.filter((id) => {
        const e = state.entities.find((item) => item.id === id && item.hp > 0);
        return !!e && Math.hypot(e.x - zone.x, e.y - zone.y) <= 4;
      }).length;
    }
  }
  const preserve = runtime.secondary.find((objective) => objective.kind === "preserveYard");
  if (preserve) preserve.completed = !!yard;
  const timed = runtime.secondary.find((objective) => objective.kind === "completeBefore");
  if (timed && timed.target !== undefined) timed.completed = state.tick < timed.target;
  const keepUnits = runtime.secondary.find((objective) => objective.kind === "keepUnits");
  if (keepUnits) keepUnits.completed = state.entities.some((entity) => entity.owner === 0 && entity.class === "unit" && entity.hp > 0 && !entity.neutral);
}

export function createCampaignAndMission(seed: number, missionIndex: number) {
  return { campaign: createCampaign(seed), state: createMission({ seed, missionIndex }) };
}
