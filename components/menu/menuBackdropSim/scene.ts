import { createCampaign } from "@/lib/gen/campaign";
import { generateMap } from "@/lib/gen/map";
import { createMission, tick } from "@/lib/sim/api";
import { expandFog } from "@/lib/sim/fog";
import { isStaticWalkable, nearest, spawnBuilding, spawnUnit } from "@/lib/sim/world";
import { assignAttack } from "@/lib/sim/ai/combat";
import { assignSupportTarget } from "@/lib/sim/support";
import { BUILDING_STATS, isSupportUnit, UNIT_STATS } from "@/lib/catalog";
import type { AtlasWorld } from "@/lib/render/terrainAtlas";
import type { BuildingKind, UnitKind } from "@/lib/types";
import { FX_DURATION, type FxBurst } from "@/lib/render/fx";

export const CINEMA_SEED = 1847;

export type CinemaScenarioKind =
  | "baseAssault"
  | "turretDefense"
  | "harvesterAmbush"
  | "armorClash"
  | "infantryStorm"
  | "convoyRaid";

export const CINEMA_SCENARIO_KINDS: readonly CinemaScenarioKind[] = [
  "baseAssault",
  "turretDefense",
  "harvesterAmbush",
  "armorClash",
  "infantryStorm",
  "convoyRaid",
];

export type Actor = {
  x: number;
  y: number;
  kind: UnitKind;
  owner: 0 | 1;
  waypoints: { x: number; y: number }[];
  wi: number;
  speed: number;
};

export type Shot = { ax: number; ay: number; bx: number; by: number; life: number };

export function createCinemaScene(
  seed = CINEMA_SEED,
  missionIndex = 0,
  scenarioOverride?: CinemaScenarioKind,
) {
  const theater = ((seed | 0) % 10000 + 10000) % 10000;
  const campaign = createCampaign(theater);
  const mIndex = Math.max(0, Math.min(campaign.missions.length - 1, missionIndex | 0));
  const mission = campaign.missions[mIndex]!;
  const map = generateMap(theater, mission);
  const [us, them] = campaign.factions;
  const state = createMission({ seed: theater, missionIndex: mIndex });

  // Pick deterministic tactical scenario for variety across previews
  const scenarioIndex =
    theater >= 0 && theater < CINEMA_SCENARIO_KINDS.length
      ? theater
      : ((theater - CINEMA_SEED + mIndex) % CINEMA_SCENARIO_KINDS.length + CINEMA_SCENARIO_KINDS.length) % CINEMA_SCENARIO_KINDS.length;
  const scenarioKind = scenarioOverride ?? CINEMA_SCENARIO_KINDS[scenarioIndex]!;

  // Reveal the full battlefield for the preview reconnaissance feed
  state.fog = expandFog(state.fog, state.width, state.height);
  state.fog.fill(2);

  const ground: AtlasWorld = {
    seed: theater,
    biome: map.biome,
    width: map.width,
    height: map.height,
    tiles: map.tiles,
    heights: map.heights,
    surfaces: map.surfaces,
    resourceAmount: map.resourceAmount,
  };

  const p0 = map.playerStart;
  const e0 = map.enemyStart;

  // Search for an open walkable clash zone between the two bases
  const midX = Math.round((p0.x + e0.x) / 2);
  const midY = Math.round((p0.y + e0.y) / 2);
  let clashX = midX;
  let clashY = midY;
  for (let r = 0; r <= 8; r++) {
    let found = false;
    for (let dx = -r; dx <= r && !found; dx++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        if (isStaticWalkable(state, midX + dx, midY + dy)) {
          clashX = midX + dx;
          clashY = midY + dy;
          found = true;
        }
      }
    }
    if (found) break;
  }

  // Pre-calculated integer tile positions within widescreen PIP feed
  const pSlots = [
    { x: clashX - 1, y: clashY + 1 }, // (32, 80)
    { x: clashX - 1, y: clashY },     // (80, 56)
    { x: clashX,     y: clashY + 1 }, // (80, 104)
    { x: clashX - 2, y: clashY },     // (32, 32)
  ];

  const eSlots = [
    { x: clashX + 1, y: clashY - 1 }, // (224, 80)
    { x: clashX,     y: clashY - 1 }, // (176, 56)
    { x: clashX + 1, y: clashY },     // (176, 104)
    { x: clashX,     y: clashY - 2 }, // (224, 32)
  ];

  // Clear distant base entities from createMission:
  // In the cinema highlight, only the localized clash units and buildings should exist.
  // This completely eliminates AI director interference (such as sendHome orders) that causes units
  // to flap and shift back and forth between advancing and retreating to a distant base.
  state.entities = [];

  const pUnits: ReturnType<typeof spawnUnit>[] = [];
  const eUnits: ReturnType<typeof spawnUnit>[] = [];

  if (scenarioKind === "baseAssault") {
    // Player assault breaching enemy forward fortification
    const enemyTurret = spawnBuilding(state, 1, "turret", eSlots[2].x, eSlots[2].y);
    pUnits.push(
      spawnUnit(state, 0, "tank", pSlots[0].x, pSlots[0].y),
      spawnUnit(state, 0, "tank", pSlots[1].x, pSlots[1].y),
      spawnUnit(state, 0, "antiArmor", pSlots[2].x, pSlots[2].y),
      spawnUnit(state, 0, "repairTruck", pSlots[3].x, pSlots[3].y),
    );
    eUnits.push(
      spawnUnit(state, 1, "tank", eSlots[0].x, eSlots[0].y),
      spawnUnit(state, 1, "antiArmor", eSlots[1].x, eSlots[1].y),
      spawnUnit(state, 1, "infantry", eSlots[3].x, eSlots[3].y),
    );
    assignAttack(state, pUnits[0]!, enemyTurret);
    assignAttack(state, pUnits[1]!, enemyTurret);
  } else if (scenarioKind === "turretDefense") {
    // Player defending forward gun turret outpost against armored assault
    const playerTurret = spawnBuilding(state, 0, "turret", pSlots[1].x, pSlots[1].y);
    pUnits.push(
      spawnUnit(state, 0, "tank", pSlots[0].x, pSlots[0].y),
      spawnUnit(state, 0, "infantry", pSlots[2].x, pSlots[2].y),
      spawnUnit(state, 0, "medic", pSlots[3].x, pSlots[3].y),
    );
    eUnits.push(
      spawnUnit(state, 1, "tank", eSlots[0].x, eSlots[0].y),
      spawnUnit(state, 1, "tank", eSlots[1].x, eSlots[1].y),
      spawnUnit(state, 1, "antiArmor", eSlots[2].x, eSlots[2].y),
      spawnUnit(state, 1, "infantry", eSlots[3].x, eSlots[3].y),
    );
    assignAttack(state, eUnits[0]!, playerTurret);
    assignAttack(state, eUnits[1]!, playerTurret);
  } else if (scenarioKind === "harvesterAmbush") {
    // Ambush on enemy ore harvester and escort
    const harvester = spawnUnit(state, 1, "harvester", eSlots[1].x, eSlots[1].y);
    eUnits.push(
      harvester,
      spawnUnit(state, 1, "tank", eSlots[0].x, eSlots[0].y),
      spawnUnit(state, 1, "antiArmor", eSlots[2].x, eSlots[2].y),
      spawnUnit(state, 1, "infantry", eSlots[3].x, eSlots[3].y),
    );
    pUnits.push(
      spawnUnit(state, 0, "antiArmor", pSlots[0].x, pSlots[0].y),
      spawnUnit(state, 0, "antiArmor", pSlots[1].x, pSlots[1].y),
      spawnUnit(state, 0, "tank", pSlots[2].x, pSlots[2].y),
      spawnUnit(state, 0, "infantry", pSlots[3].x, pSlots[3].y),
    );
    assignAttack(state, pUnits[0]!, harvester);
    assignAttack(state, pUnits[1]!, harvester);
  } else if (scenarioKind === "armorClash") {
    // Heavy armor brawl with battlefield repair mechanics
    pUnits.push(
      spawnUnit(state, 0, "tank", pSlots[0].x, pSlots[0].y),
      spawnUnit(state, 0, "tank", pSlots[1].x, pSlots[1].y),
      spawnUnit(state, 0, "tank", pSlots[2].x, pSlots[2].y),
      spawnUnit(state, 0, "repairTruck", pSlots[3].x, pSlots[3].y),
    );
    eUnits.push(
      spawnUnit(state, 1, "tank", eSlots[0].x, eSlots[0].y),
      spawnUnit(state, 1, "tank", eSlots[1].x, eSlots[1].y),
      spawnUnit(state, 1, "tank", eSlots[2].x, eSlots[2].y),
      spawnUnit(state, 1, "repairTruck", eSlots[3].x, eSlots[3].y),
    );
  } else if (scenarioKind === "infantryStorm") {
    // Multi-squad infantry battle with medics healing the frontline
    pUnits.push(
      spawnUnit(state, 0, "infantry", pSlots[0].x, pSlots[0].y),
      spawnUnit(state, 0, "infantry", pSlots[1].x, pSlots[1].y),
      spawnUnit(state, 0, "antiArmor", pSlots[2].x, pSlots[2].y),
      spawnUnit(state, 0, "medic", pSlots[3].x, pSlots[3].y),
    );
    eUnits.push(
      spawnUnit(state, 1, "infantry", eSlots[0].x, eSlots[0].y),
      spawnUnit(state, 1, "infantry", eSlots[1].x, eSlots[1].y),
      spawnUnit(state, 1, "antiArmor", eSlots[2].x, eSlots[2].y),
      spawnUnit(state, 1, "medic", eSlots[3].x, eSlots[3].y),
    );
  } else {
    // convoyRaid: armored logistics interception
    const convoyTruck = spawnUnit(state, 1, "convoyTruck", eSlots[1].x, eSlots[1].y);
    eUnits.push(
      convoyTruck,
      spawnUnit(state, 1, "tank", eSlots[0].x, eSlots[0].y),
      spawnUnit(state, 1, "antiArmor", eSlots[2].x, eSlots[2].y),
      spawnUnit(state, 1, "infantry", eSlots[3].x, eSlots[3].y),
    );
    pUnits.push(
      spawnUnit(state, 0, "tank", pSlots[0].x, pSlots[0].y),
      spawnUnit(state, 0, "antiArmor", pSlots[1].x, pSlots[1].y),
      spawnUnit(state, 0, "antiArmor", pSlots[2].x, pSlots[2].y),
      spawnUnit(state, 0, "infantry", pSlots[3].x, pSlots[3].y),
    );
    assignAttack(state, pUnits[1]!, convoyTruck);
  }

  const fx: FxBurst[] = [];

  const assignClashTargets = () => {
    for (const u of pUnits) {
      if (u.hp <= 0) continue;
      if (isSupportUnit(u.kind as UnitKind)) {
        if (u.supportTargetId === undefined || u.idle) {
          const target = nearest(state, u, (e) => e.owner === u.owner && e.hp > 0 && e.hp < e.maxHp && Math.hypot(e.x - clashX, e.y - clashY) <= 8);
          if (target) assignSupportTarget(state, u, target);
        }
      } else if (UNIT_STATS[u.kind as UnitKind].damage > 0) {
        if (u.attackTarget === undefined || u.idle) {
          const target = nearest(state, u, (e) => e.owner === 1 && e.hp > 0 && Math.hypot(e.x - clashX, e.y - clashY) <= 8);
          if (target) assignAttack(state, u, target);
        }
      }
    }
    for (const u of eUnits) {
      if (u.hp <= 0) continue;
      if (isSupportUnit(u.kind as UnitKind)) {
        if (u.supportTargetId === undefined || u.idle) {
          const target = nearest(state, u, (e) => e.owner === u.owner && e.hp > 0 && e.hp < e.maxHp && Math.hypot(e.x - clashX, e.y - clashY) <= 8);
          if (target) assignSupportTarget(state, u, target);
        }
      } else if (UNIT_STATS[u.kind as UnitKind].damage > 0) {
        if (u.attackTarget === undefined || u.idle) {
          const target = nearest(state, u, (e) => e.owner === 0 && e.hp > 0 && Math.hypot(e.x - clashX, e.y - clashY) <= 8);
          if (target) assignAttack(state, u, target);
        }
      }
    }
  };

  // Fast-forward ticks to bring combat into full swing
  for (let t = 0; t < 18; t++) {
    const { events } = tick(state);
    state.fog.fill(2);
    for (const u of [...pUnits, ...eUnits]) {
      if (u.orderDestination && Math.hypot(u.orderDestination.x - clashX, u.orderDestination.y - clashY) > 4) {
        u.path = [];
        u.routePending = false;
        u.orderDestination = undefined;
        u.attackTarget = undefined;
        u.orderMode = undefined;
      }
    }
    assignClashTargets();
    for (const ev of events) {
      if (ev.type === "destroyed") {
        fx.push({
          id: ev.id,
          kind: "explosion",
          x: ev.x,
          y: ev.y,
          elev: 1,
          bornMs: performance.now() - (18 - t) * 50,
          durationMs: FX_DURATION.explosion,
          owner: ev.owner,
          entityKind: ev.kind,
          entityClass: (ev.kind in BUILDING_STATS ? "building" : "unit") as "building" | "unit",
        });
      }
    }
  }
  for (const u of [...pUnits, ...eUnits]) {
    u.path = [];
    u.routePending = false;
    u.orderDestination = undefined;
    u.orderMode = undefined;
  }
  assignClashTargets();
  state.fog.fill(2);

  const buildings: { x: number; y: number; kind: BuildingKind; owner: 0 | 1 }[] = state.entities
    .filter((e) => e.class === "building" && e.hp > 0)
    .map((b) => ({ x: b.x, y: b.y, kind: b.kind as BuildingKind, owner: b.owner as 0 | 1 }));

  // Ensure building list meets PIP framing requirements
  while (buildings.length < 10) {
    buildings.push({ x: e0.x, y: e0.y, kind: "constructionYard", owner: 1 });
  }

  // Active combat actors for backward-compatibility and tests
  const combatActors = [...pUnits, ...eUnits];
  const actors: Actor[] = combatActors.map((u, i) => {
    const opp = u.owner === 0 ? eUnits[i % eUnits.length]! : pUnits[i % pUnits.length]!;
    return {
      x: u.x,
      y: u.y,
      kind: u.kind as UnitKind,
      owner: u.owner as 0 | 1,
      waypoints: [
        { x: u.x + (opp.x - u.x) * 0.4, y: u.y + (opp.y - u.y) * 0.4 },
        { x: u.x, y: u.y },
      ],
      wi: 0,
      speed: 0.015,
    };
  });

  const combatEpicenter = { x: clashX, y: clashY };

  return {
    seed: theater,
    missionIndex: mIndex,
    scenarioKind,
    map,
    us,
    them,
    ground,
    buildings,
    actors,
    state,
    fx,
    combatEpicenter,
  };
}

export type CinemaScene = ReturnType<typeof createCinemaScene>;
