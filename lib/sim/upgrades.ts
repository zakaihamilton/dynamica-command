import { BUILDING_STATS, HARVEST_PER_TICK, UNIT_STATS, UPGRADE_COST } from "../catalog";
import type { BuildingKind, SimState, UnitKind, UpgradeId } from "../types";

export function hasUpgrade(state: SimState, id: UpgradeId): boolean {
  return state.appliedUpgrades?.includes(id) ?? false;
}

function playerUpgrade(state: SimState, owner: number): boolean {
  return owner === 0;
}

export function unitMaxHp(state: SimState, owner: number, kind: UnitKind): number {
  return Math.round(UNIT_STATS[kind].hp * (playerUpgrade(state, owner) && hasUpgrade(state, "arsenal-plating") ? 1.1 : 1));
}

export function unitDamage(state: SimState, owner: number, kind: UnitKind): number {
  return UNIT_STATS[kind].damage * (playerUpgrade(state, owner) && hasUpgrade(state, "arsenal-barrels") ? 1.05 : 1);
}

export function unitSight(state: SimState, owner: number, kind: UnitKind): number {
  return UNIT_STATS[kind].sight + (playerUpgrade(state, owner) && hasUpgrade(state, "arsenal-targeting") ? 1 : 0);
}

export function unitBuildTicks(state: SimState, owner: number, kind: UnitKind): number {
  return Math.max(1, Math.round(UNIT_STATS[kind].buildTicks * (playerUpgrade(state, owner) && hasUpgrade(state, "engineering-frames") ? 0.9 : 1)));
}

export function buildingBuildTicks(state: SimState, owner: number, kind: BuildingKind): number {
  return Math.max(1, Math.round(BUILDING_STATS[kind].buildTicks * (playerUpgrade(state, owner) && hasUpgrade(state, "engineering-frames") ? 0.9 : 1)));
}

export function buildingCost(state: SimState, owner: number, kind: BuildingKind): number {
  return Math.max(0, Math.round(BUILDING_STATS[kind].cost * (playerUpgrade(state, owner) && hasUpgrade(state, "engineering-fabrication") ? 0.9 : 1)));
}

export function powerProduction(state: SimState, owner: number, kind: BuildingKind): number {
  const power = BUILDING_STATS[kind].power;
  return power > 0 && playerUpgrade(state, owner) && hasUpgrade(state, "engineering-grid") ? Math.round(power * 1.15) : power;
}

export function harvesterCapacity(state: SimState, owner: number): number {
  return Math.round(UNIT_STATS.harvester.carryMax * (playerUpgrade(state, owner) && hasUpgrade(state, "logistics-cargo") ? 1.2 : 1));
}

export function harvestAmount(state: SimState, owner: number): number {
  return HARVEST_PER_TICK * (playerUpgrade(state, owner) && hasUpgrade(state, "logistics-drills") ? 1.1 : 1);
}

export function suppressionApplied(state: SimState, owner: number, amount: number): number {
  return Math.round(amount * (playerUpgrade(state, owner) && hasUpgrade(state, "arsenal-shock") ? 0.9 : 1));
}

export function repairCostMultiplier(state: SimState, owner: number): number {
  return playerUpgrade(state, owner) && hasUpgrade(state, "engineering-repair") ? 0.9 : 1;
}

export function upgradeCost(id: UpgradeId): number {
  return UPGRADE_COST[id];
}

export function applyUpgradeSnapshot(state: SimState, upgrades: UpgradeId[]): void {
  state.appliedUpgrades = [...upgrades];
  if (upgrades.includes("logistics-cache")) state.credits[0] += 250;
  for (const entity of state.entities) {
    if (entity.owner !== 0 || entity.class !== "unit") continue;
    const nextMax = unitMaxHp(state, entity.owner, entity.kind as UnitKind);
    const ratio = entity.maxHp > 0 ? entity.hp / entity.maxHp : 1;
    entity.maxHp = nextMax;
    entity.hp = Math.min(nextMax, Math.max(0, Math.round(nextMax * ratio)));
  }
}
