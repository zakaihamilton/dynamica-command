import { describe, it } from "vitest";
import { footprintOf, NEW_MISSION_KINDS } from "../lib/catalog";
import { createCampaign } from "../lib/gen/campaign";
import { mapSizeForMission } from "../lib/gen/map";
import { createMission } from "../lib/sim/api";
import { canClimb, footprintFlat, inBounds, isStaticWalkable, terrainAccess } from "../lib/sim/world";
import { diagonalCornerBlocked, PATH_DIRS } from "../lib/sim/pathfinding";
import type { Entity, MissionKind, SimState, Vec2 } from "../lib/types";

const SEED_COUNT = 10_000;
const EXHAUSTIVE_TEST_TIMEOUT = process.env.NODE_V8_COVERAGE || process.env.VITEST_COVERAGE ? 60_000 : 30_000;
const REPRESENTATIVE_SEEDS = [
  ...Array.from({ length: 64 }, (_, index) => index * 157),
  421,
  9999,
];
const SCENARIO_KINDS = new Set<MissionKind>(["escort", "sabotage", "rescue", "extraction"]);

function reachableCells(state: SimState, from: Vec2): Uint8Array {
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const seen = new Uint8Array(state.width * state.height);
  const queue: Vec2[] = [start];
  seen[start.y * state.width + start.x] = 1;

  while (queue.length) {
    const current = queue.shift()!;
    for (const dir of PATH_DIRS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      if (!inBounds(state, next.x, next.y)) continue;
      const index = next.y * state.width + next.x;
      if (seen[index] || !isStaticWalkable(state, next.x, next.y)) continue;
      if (!canClimb(state, current.x, current.y, next.x, next.y)) continue;
      if (diagonalCornerBlocked(state, current.x, current.y, next.x, next.y)) continue;
      seen[index] = 1;
      queue.push(next);
    }
  }
  return seen;
}

function reachable(state: SimState, from: Vec2, to: Vec2): boolean {
  const seen = reachableCells(state, from);
  const x = Math.round(to.x);
  const y = Math.round(to.y);
  return inBounds(state, x, y) && seen[y * state.width + x] === 1;
}

function reachableTarget(state: SimState, from: Vec2, target: Entity): boolean {
  if (target.class !== "building") return reachable(state, from, target);
  const seen = reachableCells(state, from);
  const footprint = footprintOf(target.kind as Parameters<typeof footprintOf>[0]);
  for (let y = target.y - 1; y <= target.y + footprint.h; y++) {
    for (let x = target.x - 1; x <= target.x + footprint.w; x++) {
      const inside = x >= target.x && x < target.x + footprint.w && y >= target.y && y < target.y + footprint.h;
      if (inside || !inBounds(state, x, y) || !isStaticWalkable(state, x, y)) continue;
      if (seen[y * state.width + x] === 1) return true;
    }
  }
  return false;
}

function livingEntity(state: SimState, id: number): Entity | undefined {
  return state.entities.find((entity) => entity.id === id && entity.hp > 0);
}

describe("all-seed invariants", () => {
  it("keeps campaign topology valid for every four-digit seed", () => {
    for (let seed = 0; seed < SEED_COUNT; seed++) {
      const campaign = createCampaign(seed);
      const missions = campaign.missions;
      const kinds = missions.map((mission) => mission.win.kind);
      const scenarioKinds = kinds.filter((kind) => SCENARIO_KINDS.has(kind));
      const classicKinds = kinds.filter((kind) => !NEW_MISSION_KINDS.includes(kind as typeof NEW_MISSION_KINDS[number]));

      if (missions.length !== 8) throw new Error(`Seed ${seed} generated ${missions.length} missions`);
      if (new Set(kinds).size !== 8) throw new Error(`Seed ${seed} generated duplicate mission kinds`);
      if (scenarioKinds.length !== 4 || new Set(scenarioKinds).size !== 4) {
        throw new Error(`Seed ${seed} generated invalid scenario mix: ${scenarioKinds.join(", ")}`);
      }
      if (classicKinds.length !== 4 || new Set(classicKinds).size !== 4) {
        throw new Error(`Seed ${seed} generated invalid classic mix: ${classicKinds.join(", ")}`);
      }
      if (new Set(missions.map((mission) => mission.biome)).size !== 8) {
        throw new Error(`Seed ${seed} repeated a biome`);
      }
      for (const [index, mission] of missions.entries()) {
        if (mission.index !== index || mission.mapSize !== mapSizeForMission(index) || mission.kind !== mission.win.kind) {
          throw new Error(`Seed ${seed} generated inconsistent mission metadata at index ${index}`);
        }
      }
    }
  }, 15_000);

  it("keeps scenario targets spawned, valid, and reachable across representative maps", () => {
    for (const seed of REPRESENTATIVE_SEEDS) {
      const campaign = createCampaign(seed);
      for (const mission of campaign.missions) {
        if (!SCENARIO_KINDS.has(mission.win.kind)) continue;
        const state = createMission({ seed, missionIndex: mission.index });
        const targetIds = state.runtime?.targetIds ?? [];
        const expected = mission.win.targetCount ?? 0;
        if (targetIds.length !== expected || state.runtime?.required !== expected) {
          throw new Error(`Seed ${seed} mission ${mission.index} spawned ${targetIds.length}/${expected} targets`);
        }

        const playerUnit = state.entities.find((entity) => entity.owner === 0 && entity.class === "unit" && !entity.neutral);
        if (!playerUnit) throw new Error(`Seed ${seed} mission ${mission.index} has no player unit`);
        for (const id of targetIds) {
          const target = livingEntity(state, id);
          if (!target) throw new Error(`Seed ${seed} mission ${mission.index} has missing target ${id}`);
          const x = Math.round(target.x);
          const y = Math.round(target.y);
          const footprint = target.class === "building"
            ? footprintOf(target.kind as Parameters<typeof footprintOf>[0])
            : { w: 1, h: 1 };
          const validSpawn = Array.from({ length: footprint.h }, (_, oy) =>
            Array.from({ length: footprint.w }, (_, ox) => {
              const tx = x + ox;
              const ty = y + oy;
              const access = inBounds(state, tx, ty) ? terrainAccess(state, tx, ty) : undefined;
              return target.class === "building" ? access?.buildable === true : access?.traversable === true;
            }).every(Boolean),
          ).every(Boolean) && footprintFlat(state, x, y, footprint.w, footprint.h);
          if (!validSpawn) {
            throw new Error(`Seed ${seed} mission ${mission.index} placed target ${id} on invalid terrain`);
          }
          if (!reachableTarget(state, playerUnit, target)) {
            throw new Error(`Seed ${seed} mission ${mission.index} placed unreachable target ${id}`);
          }
        }
      }
    }
  }, EXHAUSTIVE_TEST_TIMEOUT);
});
