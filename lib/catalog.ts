import type { BuildingKind, UnitKind } from "./types";

export const TICKS_PER_SECOND = 12;

export const UNIT_KINDS: UnitKind[] = ["harvester", "infantry", "antiArmor", "tank"];
export const BUILDING_KINDS: BuildingKind[] = [
  "constructionYard",
  "power",
  "refinery",
  "barracks",
  "factory",
  "turret",
  "objective",
];

export type UnitStats = {
  hp: number;
  speed: number;
  damage: number;
  range: number;
  cooldown: number;
  cost: number;
  buildTicks: number;
  sight: number;
  carryMax: number;
};

export type BuildingStats = {
  hp: number;
  cost: number;
  buildTicks: number;
  power: number;
  sight: number;
};

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  harvester: {
    hp: 160,
    speed: 0.07,
    damage: 0,
    range: 0,
    cooldown: 0,
    cost: 900,
    buildTicks: 216,
    sight: 5,
    carryMax: 100,
  },
  infantry: {
    hp: 70,
    speed: 0.09,
    damage: 5,
    range: 2.4,
    cooldown: 12,
    cost: 150,
    buildTicks: 96,
    sight: 6,
    carryMax: 0,
  },
  antiArmor: {
    hp: 95,
    speed: 0.08,
    damage: 10,
    range: 3.2,
    cooldown: 16,
    cost: 320,
    buildTicks: 144,
    sight: 6,
    carryMax: 0,
  },
  tank: {
    hp: 320,
    speed: 0.065,
    damage: 12,
    range: 3.6,
    cooldown: 16,
    cost: 850,
    buildTicks: 240,
    sight: 7,
    carryMax: 0,
  },
};

export const BUILDING_STATS: Record<BuildingKind, BuildingStats> = {
  constructionYard: { hp: 3200, cost: 0, buildTicks: 0, power: 20, sight: 8 },
  power: { hp: 520, cost: 600, buildTicks: 180, power: 100, sight: 4 },
  refinery: { hp: 1100, cost: 1000, buildTicks: 240, power: -10, sight: 5 },
  barracks: { hp: 900, cost: 750, buildTicks: 216, power: -10, sight: 5 },
  factory: { hp: 1300, cost: 1600, buildTicks: 360, power: -15, sight: 5 },
  turret: { hp: 480, cost: 550, buildTicks: 168, power: -8, sight: 7 },
  objective: { hp: 1800, cost: 0, buildTicks: 0, power: 0, sight: 3 },
};

export const HARVEST_PER_TICK = 2;

export function producerFor(unit: UnitKind): BuildingKind {
  if (unit === "infantry" || unit === "antiArmor") return "barracks";
  return "factory";
}

export function powerOf(kind: BuildingKind): number {
  return BUILDING_STATS[kind].power;
}

export const WIN_KIND_ORDER: import("./types").WinCategoryKind[] = [
  "harvestQuota",
  "forceQuota",
  "structureQuota",
  "destroyMarked",
  "razeAll",
  "decapitate",
  "annihilate",
  "holdTheLine",
];
