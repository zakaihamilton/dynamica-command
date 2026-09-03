import { createCampaign } from "@/lib/gen/campaign";
import { generateMap } from "@/lib/gen/map";
import { createMission, tick } from "@/lib/sim/api";
import { expandFog } from "@/lib/sim/fog";
import { isStaticWalkable, nearest, spawnUnit } from "@/lib/sim/world";
import { assignAttack } from "@/lib/sim/ai/combat";
import type { AtlasWorld } from "@/lib/render/terrainAtlas";
import type { BuildingKind, UnitKind } from "@/lib/types";
import { FX_DURATION, type FxBurst } from "@/lib/render/fx";

export const CINEMA_SEED = 1847;

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

export function createCinemaScene(seed = CINEMA_SEED, missionIndex = 0) {
  const theater = ((seed | 0) % 10000 + 10000) % 10000;
  const campaign = createCampaign(theater);
  const mIndex = Math.max(0, Math.min(campaign.missions.length - 1, missionIndex | 0));
  const mission = campaign.missions[mIndex]!;
  const map = generateMap(theater, mission);
  const [us, them] = campaign.factions;
  const state = createMission({ seed: theater, missionIndex: mIndex });

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

  // Spawn engaging frontline squads in widescreen horizontal faceoff
  const pUnits = [
    spawnUnit(state, 0, "tank", clashX - 0.9, clashY + 0.6),
    spawnUnit(state, 0, "antiArmor", clashX - 0.8, clashY + 1.1),
    spawnUnit(state, 0, "infantry", clashX - 1.2, clashY + 0.3),
    spawnUnit(state, 0, "infantry", clashX - 1.1, clashY + 0.8),
  ];
  if (mIndex >= 3) {
    pUnits.push(spawnUnit(state, 0, "tank", clashX - 1.3, clashY + 0.6));
  }

  const eUnits = [
    spawnUnit(state, 1, "tank", clashX + 0.9, clashY - 0.6),
    spawnUnit(state, 1, "antiArmor", clashX + 0.8, clashY - 1.1),
    spawnUnit(state, 1, "infantry", clashX + 1.2, clashY - 0.3),
    spawnUnit(state, 1, "infantry", clashX + 1.1, clashY - 0.8),
  ];
  if (mIndex >= 3) {
    eUnits.push(spawnUnit(state, 1, "antiArmor", clashX + 1.3, clashY - 0.6));
  }

  const fx: FxBurst[] = [];

  const assignClashTargets = () => {
    for (const u of pUnits) {
      if (u.hp > 0 && (u.attackTarget === undefined || u.idle)) {
        const target = nearest(state, u, (e) => e.owner === 1 && e.hp > 0 && Math.hypot(e.x - clashX, e.y - clashY) <= 8);
        if (target) assignAttack(state, u, target);
      }
    }
    for (const u of eUnits) {
      if (u.hp > 0 && (u.attackTarget === undefined || u.idle)) {
        const target = nearest(state, u, (e) => e.owner === 0 && e.hp > 0 && Math.hypot(e.x - clashX, e.y - clashY) <= 8);
        if (target) assignAttack(state, u, target);
      }
    }
  };

  // Fast-forward ticks to bring combat into full swing
  for (let t = 0; t < 18; t++) {
    assignClashTargets();
    const { events } = tick(state);
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
          entityClass: "unit",
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
