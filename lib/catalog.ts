import type { ArmorType, BuildingKind, UnitKind, WeaponType } from "./types";

export const TICKS_PER_SECOND = 12;
export const MAX_PRODUCTION_QUEUE = 10;
export const STARTING_CREDITS = { player: 2000, enemy: 2000 } as const;

export function productionQueueSize(entity: {
  producing?: { kind: UnitKind; remaining: number };
  queue?: UnitKind[];
}): number {
  return (entity.producing ? 1 : 0) + (entity.queue?.length ?? 0);
}

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
  armor: ArmorType;
  weapon: WeaponType;
  splashRadius: number;
  suppression: number;
};

export type Footprint = { w: number; h: number };

export type BuildingStats = {
  hp: number;
  cost: number;
  buildTicks: number;
  power: number;
  sight: number;
  footprint: Footprint;
  armor: ArmorType;
  weapon?: WeaponType;
};

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  harvester: {
    hp: 160,
    speed: 0.07,
    damage: 0,
    range: 0,
    cooldown: 0,
    cost: 450,
    buildTicks: 108,
    sight: 5,
    carryMax: 250,
    armor: "light",
    weapon: "smallArms",
    splashRadius: 0,
    suppression: 0,
  },
  infantry: {
    hp: 70,
    speed: 0.09,
    damage: 5,
    range: 2.4,
    cooldown: 12,
    cost: 75,
    buildTicks: 48,
    sight: 6,
    carryMax: 0,
    armor: "light",
    weapon: "smallArms",
    splashRadius: 0,
    suppression: 8,
  },
  antiArmor: {
    hp: 95,
    speed: 0.08,
    damage: 10,
    range: 3.2,
    cooldown: 16,
    cost: 160,
    buildTicks: 72,
    sight: 6,
    carryMax: 0,
    armor: "light",
    weapon: "antiArmor",
    splashRadius: 0,
    suppression: 14,
  },
  tank: {
    hp: 320,
    speed: 0.065,
    damage: 12,
    range: 3.6,
    cooldown: 16,
    cost: 425,
    buildTicks: 120,
    sight: 7,
    carryMax: 0,
    armor: "heavy",
    weapon: "cannon",
    splashRadius: 1,
    suppression: 12,
  },
};

export const BUILDING_STATS: Record<BuildingKind, BuildingStats> = {
  constructionYard: { hp: 3200, cost: 0, buildTicks: 0, power: 20, sight: 8, footprint: { w: 2, h: 2 }, armor: "structure" },
  power: { hp: 520, cost: 300, buildTicks: 90, power: 50, sight: 4, footprint: { w: 2, h: 2 }, armor: "structure" },
  refinery: { hp: 1100, cost: 500, buildTicks: 120, power: -10, sight: 5, footprint: { w: 3, h: 2 }, armor: "structure" },
  barracks: { hp: 900, cost: 375, buildTicks: 108, power: -10, sight: 5, footprint: { w: 2, h: 2 }, armor: "structure" },
  factory: { hp: 1300, cost: 800, buildTicks: 180, power: -15, sight: 5, footprint: { w: 3, h: 2 }, armor: "structure" },
  turret: { hp: 480, cost: 275, buildTicks: 84, power: -8, sight: 7, footprint: { w: 1, h: 1 }, armor: "structure", weapon: "cannon" },
  objective: { hp: 1800, cost: 0, buildTicks: 0, power: 0, sight: 3, footprint: { w: 2, h: 2 }, armor: "structure" },
};

export const UNIT_LABELS: Record<UnitKind, string> = {
  harvester: "Harvester",
  infantry: "Infantry",
  antiArmor: "Anti-armor",
  tank: "Tank",
};

export const BUILDING_LABELS: Record<BuildingKind, string> = {
  constructionYard: "Construction Yard",
  power: "Power Plant",
  refinery: "Refinery",
  barracks: "Barracks",
  factory: "War Factory",
  turret: "Gun Turret",
  objective: "Marked Structure",
};

export function footprintOf(kind: BuildingKind): Footprint {
  return BUILDING_STATS[kind].footprint;
}

export function labelFor(kind: UnitKind | BuildingKind): string {
  if (kind in UNIT_LABELS) return UNIT_LABELS[kind as UnitKind];
  return BUILDING_LABELS[kind as BuildingKind];
}

export const HARVEST_PER_TICK = 2;
export const REPAIR_COST_RATIO = 0.5;
export const SELL_RATIO = 0.5;

export function repairHpPerTick(kind: BuildingKind): number {
  return Math.max(2, Math.ceil(BUILDING_STATS[kind].hp / 360));
}

export function repairValue(kind: BuildingKind): number {
  const stats = BUILDING_STATS[kind];
  return stats.cost > 0 ? stats.cost : Math.max(200, Math.round(stats.hp / 4));
}

export function repairCostFor(kind: BuildingKind, hp: number): number {
  if (hp <= 0) return 0;
  const raw = (hp / BUILDING_STATS[kind].hp) * repairValue(kind) * REPAIR_COST_RATIO;
  return Math.max(1, Math.round(raw));
}

export function sellRefundFor(kind: BuildingKind, hp: number): number {
  if (hp <= 0) return 0;
  const raw = (hp / BUILDING_STATS[kind].hp) * repairValue(kind) * SELL_RATIO;
  return Math.max(1, Math.round(raw));
}

export function producerFor(unit: UnitKind): BuildingKind {
  if (unit === "infantry" || unit === "antiArmor") return "barracks";
  return "factory";
}

export function powerOf(kind: BuildingKind): number {
  return BUILDING_STATS[kind].power;
}

export type CameoPhase = "idle" | "progress" | "waiting";

export type CameoStatus = {
  ratio: number;
  queued: number;
  phase: CameoPhase;
};

type CameoEntity = {
  hp: number;
  owner: number;
  class: string;
  kind: string;
  constructing: number;
  producing?: { kind: UnitKind; remaining: number };
  queue?: UnitKind[];
};

export function buildingCameoStatus(
  entities: ReadonlyArray<CameoEntity>,
  owner: number,
  kind: BuildingKind,
): CameoStatus {
  let queued = 0;
  let bestRatio = 0;
  for (const e of entities) {
    if (e.hp <= 0 || e.owner !== owner || e.class !== "building" || e.kind !== kind) continue;
    if (e.constructing <= 0) continue;
    queued += 1;
    const total = BUILDING_STATS[kind].buildTicks || 1;
    const ratio = Math.max(0, Math.min(1, 1 - e.constructing / total));
    if (ratio > bestRatio) bestRatio = ratio;
  }
  if (queued === 0) return { ratio: 0, queued: 0, phase: "idle" };
  return { ratio: bestRatio, queued, phase: "progress" };
}

export function unitCameoStatus(
  entities: ReadonlyArray<CameoEntity>,
  owner: number,
  kind: UnitKind,
): CameoStatus {
  let queued = 0;
  let bestRatio = 0;
  let producing = false;
  for (const e of entities) {
    if (e.hp <= 0 || e.owner !== owner || e.class !== "building" || e.constructing > 0) continue;
    if (e.producing?.kind === kind) {
      queued += 1;
      producing = true;
      const total = UNIT_STATS[kind].buildTicks || 1;
      const ratio = Math.max(0, Math.min(1, 1 - e.producing.remaining / total));
      if (ratio > bestRatio) bestRatio = ratio;
    }
    if (e.queue) {
      for (const item of e.queue) {
        if (item === kind) queued += 1;
      }
    }
  }
  if (queued === 0) return { ratio: 0, queued: 0, phase: "idle" };
  if (producing) return { ratio: bestRatio, queued, phase: "progress" };
  return { ratio: 0, queued, phase: "waiting" };
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

export const NEW_MISSION_KINDS: import("./types").MissionKind[] = [
  "escort",
  "sabotage",
  "rescue",
  "extraction",
];
