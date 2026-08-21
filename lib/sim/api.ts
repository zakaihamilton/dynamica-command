import { STARTING_CREDITS, UNIT_STATS } from "../catalog";
import { createRng, mixSeed } from "../seed/rng";
import { inObjectiveZone, RESCUE_CONTACT_RADIUS } from "../types";
import type { Entity, Facing, SimEvent, SimState, UnitKind } from "../types";
import { createCampaign } from "../gen/campaign";
import { generateMap } from "../gen/map";
import { tickAi } from "./ai";
import { tickCombat } from "./combat";
import { tickEconomy } from "./economy";
import { makeFog, tickFog } from "./fog";
import { applyCommands, issue } from "./orders";
import { evaluateObjectives, inspect } from "./objectives";
import { resetPathBudget, tryFindPath } from "./pathBudget";
import { PATH_DIRS, diagonalCornerBlocked, stepAlongPath } from "./pathfinding";
import { tickProduction } from "./production";
import { tickRepair } from "./repair";
import { ensureMissionDirector, tickMissionDirector } from "./director";
import { configureMissionScenario } from "./scenarios";
import { canClimb, emptyRoleCounts, inBounds, isStaticWalkable, makeUnitOccupancy, spawnBuildingAt, spawnUnit } from "./world";
import type { Command } from "../types";
import { missionDifficulty } from "./difficulty";

export { issue, inspect };
export { CONVOY_STAGING_TICKS } from "./scenarios";

function cellOf(state: SimState, x: number, y: number): number {
  return Math.round(y) * state.width + Math.round(x);
}

function tileFree(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  e: Entity,
  x: number,
  y: number,
): boolean {
  if (!inBounds(state, x, y) || !isStaticWalkable(state, x, y)) return false;
  const current = cellOf(state, e.x, e.y);
  const target = y * state.width + x;
  if (target === current) return true;
  if (occupancy[target]) return false;
  const claim = reserved.get(target);
  return claim === undefined || claim === e.id;
}

function trySidestep(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  e: Entity,
  blockedX: number,
  blockedY: number,
): boolean {
  if (e.path.length <= 1) return false;
  const cx = Math.round(e.x);
  const cy = Math.round(e.y);
  const dest = e.path[1] ?? e.path[e.path.length - 1]!;
  const stayD = Math.hypot(cx - dest.x, cy - dest.y);
  let best: { x: number; y: number; d: number } | undefined;
  for (const d of PATH_DIRS) {
    const nx = cx + d.x;
    const ny = cy + d.y;
    if (nx === blockedX && ny === blockedY) continue;
    if (!tileFree(state, occupancy, reserved, e, nx, ny)) continue;
    if (!canClimb(state, cx, cy, nx, ny)) continue;
    if (diagonalCornerBlocked(state, cx, cy, nx, ny)) continue;
    const dist = Math.hypot(nx - dest.x, ny - dest.y);
    if (dist >= stayD) continue;
    if (!best || dist < best.d) best = { x: nx, y: ny, d: dist };
  }
  if (!best) return false;
  e.path[0] = { x: best.x, y: best.y };
  return true;
}

function nudgeIdle(
  state: SimState,
  occupancy: Uint8Array,
  reserved: Map<number, number>,
  blocker: Entity,
): boolean {
  if (blocker.path.length) return false;
  const cx = Math.round(blocker.x);
  const cy = Math.round(blocker.y);
  for (const d of PATH_DIRS) {
    const nx = cx + d.x;
    const ny = cy + d.y;
    if (!tileFree(state, occupancy, reserved, blocker, nx, ny)) continue;
    if (!canClimb(state, cx, cy, nx, ny)) continue;
    if (diagonalCornerBlocked(state, cx, cy, nx, ny)) continue;
    blocker.path = [{ x: nx, y: ny }];
    return true;
  }
  return false;
}

function tickMovement(state: SimState): void {
  const occupancy = makeUnitOccupancy(state);
  const atTile = new Map<number, Entity>();
  const reserved = new Map<number, number>();
  const swapped = new Set<number>();
  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit") continue;
    atTile.set(cellOf(state, e.x, e.y), e);
  }

  for (const e of state.entities) {
    if (e.hp <= 0 || e.class !== "unit") continue;
    if (swapped.has(e.id)) continue;
    const speed = UNIT_STATS[e.kind as UnitKind].speed * (1 - Math.min(0.4, (e.suppression ?? 0) / 250));
    const current = cellOf(state, e.x, e.y);
    const next = e.path[0];
    const nx = next ? Math.round(next.x) : Math.round(e.x);
    const ny = next ? Math.round(next.y) : Math.round(e.y);
    const target = ny * state.width + nx;
    const claim = reserved.get(target);
    const blocked = !!next && target !== current && (occupancy[target] === 1 || (claim !== undefined && claim !== e.id));

    if (blocked) {
      const blocker = atTile.get(target);
      if (blocker && blocker.id !== e.id && !swapped.has(blocker.id)) {
        const bNext = blocker.path[0];
        if (bNext && Math.round(bNext.x) === Math.round(e.x) && Math.round(bNext.y) === Math.round(e.y)) {
          const bCell = cellOf(state, blocker.x, blocker.y);
          const ax = e.x;
          const ay = e.y;
          e.x = blocker.x;
          e.y = blocker.y;
          blocker.x = ax;
          blocker.y = ay;
          e.path.shift();
          blocker.path.shift();
          occupancy[current] = 1;
          occupancy[bCell] = 1;
          atTile.set(current, blocker);
          atTile.set(bCell, e);
          swapped.add(e.id);
          swapped.add(blocker.id);
          e.blockedTicks = 0;
          blocker.blockedTicks = 0;
          continue;
        }
      }

      if (trySidestep(state, occupancy, reserved, e, nx, ny)) {
        e.blockedTicks = 0;
      } else {
        if (blocker && blocker.id !== e.id) nudgeIdle(state, occupancy, reserved, blocker);
        e.blockedTicks = (e.blockedTicks ?? 0) + 1;
        if (e.blockedTicks === 1 || e.blockedTicks % 6 === 0) {
          const destination = e.path[e.path.length - 1];
          if (destination) {
            const detour = tryFindPath(state, e, destination, {
              avoidUnits: true,
              ignoreId: e.id,
              occupancy,
            });
            if (!detour) continue;
            const detourFirst = detour[0];
            if (detourFirst) {
              const dx = Math.round(detourFirst.x);
              const dy = Math.round(detourFirst.y);
              const sameBlocked = dx === nx && dy === ny;
              if (!sameBlocked && tileFree(state, occupancy, reserved, e, dx, dy)) {
                e.path = detour;
              }
            }
          }
        }
        continue;
      }
    }

    const stepTarget = e.path[0];
    const stepX = stepTarget ? Math.round(stepTarget.x) : Math.round(e.x);
    const stepY = stepTarget ? Math.round(stepTarget.y) : Math.round(e.y);
    const stepCell = stepY * state.width + stepX;
    if (stepTarget && stepCell !== current && !tileFree(state, occupancy, reserved, e, stepX, stepY)) {
      e.blockedTicks = (e.blockedTicks ?? 0) + 1;
      continue;
    }
    if (stepTarget && stepCell !== current) reserved.set(stepCell, e.id);
    if (stepTarget) {
      const dx = stepTarget.x - e.x;
      const dy = stepTarget.y - e.y;
      if (Math.hypot(dx, dy) > 0.001) {
        const angle = Math.atan2(dy, dx);
        e.facing = ((Math.round((angle / (Math.PI * 2)) * 8) + 8) % 8) as Facing;
      }
    }
    const before = current;
    stepAlongPath(e, speed, (x, y) => tileFree(state, occupancy, reserved, e, Math.round(x), Math.round(y)));
    const after = cellOf(state, e.x, e.y);
    if (after !== before) {
      occupancy[before] = 0;
      occupancy[after] = 1;
      atTile.delete(before);
      atTile.set(after, e);
    }
    if (!e.path.length && stepTarget && reserved.get(stepCell) === e.id) reserved.delete(stepCell);
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
  events.push(...tickMissionDirector(state));
  tickAi(state);
  tickFog(state);
  state.tick += 1;
  events.push(...tickScenario(state));
  events.push(...evaluateObjectives(state));
  return { state, events };
}

function stepRoute(state: SimState, from: { x: number; y: number }, to: { x: number; y: number }) {
  return [...Array.from({ length: 3 }, (_, i) => ({
    x: Math.round(from.x + (to.x - from.x) * (i + 1) / 4),
    y: Math.round(from.y + (to.y - from.y) * (i + 1) / 4),
  })), { x: to.x, y: to.y }];
}

function tickScenario(state: SimState): SimEvent[] {
  const events: SimEvent[] = [];
  const runtime = state.runtime;
  if (!runtime || runtime.phase === "complete") return events;
  const yard = state.entities.find((e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0);
  if (runtime.kind === "extraction" && yard) {
    runtime.zone = { x: yard.x, y: yard.y };
  }
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
        if (runtime.kind === "extraction") runtime.phase = "extraction";
      }
    }
  }
  if (runtime.kind === "escort" && runtime.convoyStartTick !== undefined && state.tick >= runtime.convoyStartTick) {
    for (const id of runtime.targetIds) {
      const convoy = state.entities.find((entity) => entity.id === id && entity.hp > 0);
      if (convoy?.scenarioRole === "convoy" && convoy.neutral) convoy.path = stepRoute(state, convoy, state.runtime!.zone!);
    }
    delete runtime.convoyStartTick;
  }
  if (runtime.kind === "escort" || runtime.kind === "extraction") {
    const zone = runtime.zone;
    if (zone) {
      if (runtime.kind === "extraction") {
        const extracted = new Set(runtime.extractedIds ?? []);
        for (const id of runtime.targetIds) {
          if (extracted.has(id)) continue;
          const e = state.entities.find((item) => item.id === id && item.hp > 0);
          if (!e || e.neutral || !inObjectiveZone(e.x, e.y, zone)) continue;
          extracted.add(id);
          e.marked = false;
        }
        runtime.extractedIds = [...extracted];
        runtime.rescued = extracted.size;
      } else {
        runtime.rescued = runtime.targetIds.filter((id) => {
          const e = state.entities.find((item) => item.id === id && item.hp > 0);
          return !!e && inObjectiveZone(e.x, e.y, zone);
        }).length;
      }
    }
  }
  const preserve = runtime.secondary.find((objective) => objective.kind === "preserveYard");
  if (preserve) preserve.completed = !!yard;
  const timed = runtime.secondary.find((objective) => objective.kind === "completeBefore");
  if (timed && timed.target !== undefined) timed.completed = state.tick < timed.target;
  const keepUnits = runtime.secondary.find((objective) => objective.kind === "keepUnits");
  if (keepUnits) keepUnits.completed = state.entities.some((entity) => entity.owner === 0 && entity.class === "unit" && entity.hp > 0 && !entity.neutral);
  return events;
}

export function createCampaignAndMission(seed: number, missionIndex: number) {
  return { campaign: createCampaign(seed), state: createMission({ seed, missionIndex }) };
}
