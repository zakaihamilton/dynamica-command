import type { ArmorType, BuildingKind, Entity, WeaponType } from "../types";

export const BUILDING_KINDS: BuildingKind[] = [
  "constructionYard",
  "power",
  "refinery",
  "barracks",
  "factory",
  "turret",
  "objective",
];

/** Buildings that may only have one active instance per owner in a mission. */
export const SINGLE_BUILDING_KINDS: BuildingKind[] = ["barracks", "factory"];

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

export const BUILDING_STATS: Record<BuildingKind, BuildingStats> = {
  constructionYard: { hp: 3200, cost: 0, buildTicks: 0, power: 20, sight: 8, footprint: { w: 2, h: 2 }, armor: "structure" },
  power: { hp: 520, cost: 300, buildTicks: 90, power: 50, sight: 4, footprint: { w: 2, h: 2 }, armor: "structure" },
  refinery: { hp: 1100, cost: 500, buildTicks: 120, power: -10, sight: 5, footprint: { w: 3, h: 2 }, armor: "structure" },
  barracks: { hp: 900, cost: 375, buildTicks: 108, power: -10, sight: 5, footprint: { w: 2, h: 2 }, armor: "structure" },
  factory: { hp: 1300, cost: 800, buildTicks: 180, power: -15, sight: 5, footprint: { w: 3, h: 2 }, armor: "structure" },
  turret: { hp: 480, cost: 275, buildTicks: 84, power: -8, sight: 7, footprint: { w: 1, h: 1 }, armor: "structure", weapon: "cannon" },
  objective: { hp: 1800, cost: 0, buildTicks: 0, power: 0, sight: 3, footprint: { w: 2, h: 2 }, armor: "structure" },
};

export const BUILDING_LABELS: Record<BuildingKind, string> = {
  constructionYard: "Command HQ",
  power: "Power Plant",
  refinery: "Refinery",
  barracks: "Barracks",
  factory: "Vehicle Plant",
  turret: "Gun Turret",
  objective: "Marked Structure",
};

export function footprintOf(kind: BuildingKind): Footprint {
  return BUILDING_STATS[kind].footprint;
}

export function buildingLimitReached(
  entities: ReadonlyArray<Pick<Entity, "hp" | "owner" | "class" | "kind">>,
  owner: number,
  kind: BuildingKind,
): boolean {
  if (!SINGLE_BUILDING_KINDS.includes(kind)) return false;
  return entities.some((entity) => entity.hp > 0 && entity.owner === owner && entity.class === "building" && entity.kind === kind);
}

export const HARVEST_PER_TICK = 2;
export const REPAIR_COST_RATIO = 0.5;
export const SELL_RATIO = 0.5;

export function repairHpPerTick(kind: BuildingKind): number {
  return Math.max(1, Math.ceil(BUILDING_STATS[kind].hp / 720));
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

export function producerFor(unit: import("../types").UnitKind): BuildingKind {
  if (unit === "infantry" || unit === "antiArmor" || unit === "medic") return "barracks";
  return "factory";
}

export function powerOf(kind: BuildingKind): number {
  return BUILDING_STATS[kind].power;
}
