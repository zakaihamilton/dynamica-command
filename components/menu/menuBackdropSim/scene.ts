import {
  generateFactions,
} from "@/lib/gen/factions";
import { generateMap } from "@/lib/gen/map";
import { generateWorld } from "@/lib/gen/world";
import { generateCampaignVisualProfile } from "@/lib/gen/visualProfile";
import type { BuildingKind, UnitKind } from "@/lib/types";

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

export function createCinemaScene(seed = CINEMA_SEED) {
  const theater = ((seed | 0) % 10000 + 10000) % 10000;

  const map = generateMap(theater, {
    index: 0,
    win: { kind: "razeAll" },
    mapSize: 28,
    biome: generateWorld(theater).biome,
  });
  const [us, them] = generateFactions(theater);
  const campaignProfile = generateCampaignVisualProfile(theater);

  const p0 = map.playerStart;
  const e0 = map.enemyStart;
  const buildings: { x: number; y: number; kind: BuildingKind; owner: 0 | 1 }[] = [
    { x: p0.x, y: p0.y, kind: "constructionYard", owner: 0 },
    { x: p0.x + 3, y: p0.y, kind: "power", owner: 0 },
    { x: p0.x, y: p0.y + 3, kind: "refinery", owner: 0 },
    { x: p0.x + 4, y: p0.y + 3, kind: "factory", owner: 0 },
    { x: p0.x + 7, y: p0.y + 1, kind: "turret", owner: 0 },
    { x: e0.x, y: e0.y, kind: "constructionYard", owner: 1 },
    { x: e0.x - 3, y: e0.y, kind: "power", owner: 1 },
    { x: e0.x - 5, y: e0.y - 3, kind: "barracks", owner: 1 },
    { x: e0.x, y: e0.y - 6, kind: "factory", owner: 1 },
    { x: e0.x - 5, y: e0.y, kind: "turret", owner: 1 },
  ];

  const p = map.playerStart;
  const e = map.enemyStart;
  const actors: Actor[] = [
    {
      x: p.x + 1,
      y: p.y + 3,
      kind: "harvester",
      owner: 0,
      waypoints: [
        { x: p.x + 4, y: p.y + 5 },
        { x: p.x + 1, y: p.y + 2 },
      ],
      wi: 0,
      speed: 0.018,
    },
    {
      x: p.x + 4,
      y: p.y,
      kind: "tank",
      owner: 0,
      waypoints: [
        { x: (p.x + e.x) / 2, y: (p.y + e.y) / 2 - 2 },
        { x: p.x + 5, y: p.y + 1 },
      ],
      wi: 0,
      speed: 0.014,
    },
    {
      x: p.x + 5,
      y: p.y + 2,
      kind: "infantry",
      owner: 0,
      waypoints: [
        { x: p.x + 8, y: p.y + 4 },
        { x: p.x + 5, y: p.y + 2 },
      ],
      wi: 0,
      speed: 0.022,
    },
    {
      x: e.x - 4,
      y: e.y,
      kind: "tank",
      owner: 1,
      waypoints: [
        { x: (p.x + e.x) / 2 + 1, y: (p.y + e.y) / 2 },
        { x: e.x - 3, y: e.y - 1 },
      ],
      wi: 0,
      speed: 0.013,
    },
    {
      x: e.x - 1,
      y: e.y - 3,
      kind: "antiArmor",
      owner: 1,
      waypoints: [
        { x: e.x - 6, y: e.y - 4 },
        { x: e.x - 1, y: e.y - 3 },
      ],
      wi: 0,
      speed: 0.02,
    },
    {
      x: e.x - 2,
      y: e.y + 1,
      kind: "harvester",
      owner: 1,
      waypoints: [
        { x: e.x - 5, y: e.y - 5 },
        { x: e.x, y: e.y - 2 },
      ],
      wi: 0,
      speed: 0.016,
    },
  ];

  return { seed: theater, map, us, them, campaignProfile, buildings, actors };
}

export type CinemaScene = ReturnType<typeof createCinemaScene>;
