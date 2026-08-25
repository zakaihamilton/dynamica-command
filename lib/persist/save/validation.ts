import { BUILDING_KINDS, UNIT_KINDS } from "../../catalog";
import type { BuildingKind, CampaignProgress, Entity, SimState, UnitKind } from "../../types";
import { fogGridHeight, fogGridWidth } from "../../sim/fog";

export const SAVE_CONTENT_VERSION = 1;

type RecordLike = Record<string, unknown>;

const MISSION_KINDS = [
  "harvestQuota", "forceQuota", "structureQuota", "destroyMarked", "razeAll", "decapitate",
  "annihilate", "holdTheLine", "escort", "sabotage", "rescue", "extraction",
] as const;
const BIOMES = [
  "ash plains", "crystal flats", "rust canyons", "salt marshes", "glass desert", "tundra grid",
  "jungle wreckage", "volcanic shelf",
] as const;
const LOSS_REASONS = ["yardDestroyed", "deadline", "objectiveTargetLost"] as const;
const SCENARIO_ROLES = ["convoy", "stranded", "cargo"] as const;
const ORDER_MODES = ["move", "attackMove", "attack"] as const;
const STANCES = ["aggressive", "defensive", "hold"] as const;
const FORMATIONS = ["line", "column", "wedge"] as const;
const ARMOR_TYPES = ["light", "heavy", "structure"] as const;
const WEAPON_TYPES = ["smallArms", "antiArmor", "cannon"] as const;
const SURFACE_KINDS = [0, 1, 2] as const;
const TILE_KINDS = [0, 1, 2, 3] as const;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isUnitKind(value: unknown): value is UnitKind {
  return typeof value === "string" && UNIT_KINDS.includes(value as UnitKind);
}

function isBuildingKind(value: unknown): value is BuildingKind {
  return typeof value === "string" && BUILDING_KINDS.includes(value as BuildingKind);
}

function isVec2(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isPalette(value: unknown): boolean {
  return isRecord(value) && ["primary", "secondary", "accent", "outline", "light", "dark"].every((key) => isString(value[key]));
}

function isFaction(value: unknown, owner: number): boolean {
  return isRecord(value) && value.id === owner && isString(value.name) && isString(value.adjective) && isPalette(value.palette);
}

export function isEntity(value: unknown): value is Entity {
  if (!isRecord(value)) return false;
  const classIsUnit = value.class === "unit";
  const classIsBuilding = value.class === "building";
  if (!classIsUnit && !classIsBuilding) return false;
  const kindValid = classIsUnit ? isUnitKind(value.kind) : isBuildingKind(value.kind);
  if (
    !kindValid ||
    !isIntegerInRange(value.id, 0, Number.MAX_SAFE_INTEGER) ||
    (value.owner !== 0 && value.owner !== 1) ||
    !isFiniteNumber(value.x) || !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.hp) || !isFiniteNumber(value.maxHp) ||
    !isNonNegativeNumber(value.cooldown) || !Array.isArray(value.path) || !value.path.every(isVec2) ||
    !isNonNegativeNumber(value.carry) || !isNonNegativeNumber(value.constructing) ||
    !Array.isArray(value.queue) || !value.queue.every(isUnitKind) ||
    typeof value.marked !== "boolean" || typeof value.idle !== "boolean"
  ) return false;
  if (value.attackTarget !== undefined && !isIntegerInRange(value.attackTarget, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (value.producing !== undefined && (!isRecord(value.producing) || !isUnitKind(value.producing.kind) || !isNonNegativeNumber(value.producing.remaining))) return false;
  if (value.gatherX !== undefined && !isFiniteNumber(value.gatherX)) return false;
  if (value.gatherY !== undefined && !isFiniteNumber(value.gatherY)) return false;
  if (value.facing !== undefined && !isIntegerInRange(value.facing, 0, 7)) return false;
  if (value.repairing !== undefined && typeof value.repairing !== "boolean") return false;
  if (value.neutral !== undefined && typeof value.neutral !== "boolean") return false;
  if (value.scenarioRole !== undefined && !isOneOf(value.scenarioRole, SCENARIO_ROLES)) return false;
  if (value.orderMode !== undefined && !isOneOf(value.orderMode, ORDER_MODES)) return false;
  if (value.orderDestination !== undefined && !isVec2(value.orderDestination)) return false;
  if (value.stance !== undefined && !isOneOf(value.stance, STANCES)) return false;
  if (value.suppression !== undefined && !isNonNegativeNumber(value.suppression)) return false;
  if (value.armor !== undefined && !isOneOf(value.armor, ARMOR_TYPES)) return false;
  if (value.weapon !== undefined && !isOneOf(value.weapon, WEAPON_TYPES)) return false;
  if (value.formation !== undefined && !isOneOf(value.formation, FORMATIONS)) return false;
  if (value.blockedTicks !== undefined && !isNonNegativeNumber(value.blockedTicks)) return false;
  if (value.supportTargetId !== undefined && !isIntegerInRange(value.supportTargetId, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (value.supportMode !== undefined && !isOneOf(value.supportMode, ["auto", "assigned", "hold"] as const)) return false;
  return true;
}

export function isWin(value: unknown): boolean {
  if (!isRecord(value) || !isOneOf(value.kind, MISSION_KINDS)) return false;
  if (value.target !== undefined && !isNonNegativeNumber(value.target)) return false;
  if (value.role !== undefined && !isUnitKind(value.role)) return false;
  if (value.building !== undefined && !isBuildingKind(value.building)) return false;
  if (value.targetCount !== undefined && !isNonNegativeNumber(value.targetCount)) return false;
  if (value.targetIds !== undefined && (!Array.isArray(value.targetIds) || !value.targetIds.every((id) => isIntegerInRange(id, 0, Number.MAX_SAFE_INTEGER)))) return false;
  if (value.ticks !== undefined && !isNonNegativeNumber(value.ticks)) return false;
  return true;
}

function isSecondaryObjective(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.id) || !isString(value.label) || !isOneOf(value.kind, ["preserveYard", "destroyTarget", "completeBefore", "keepUnits"] as const)) return false;
  if (value.target !== undefined && !isNonNegativeNumber(value.target)) return false;
  if (value.targetId !== undefined && !isIntegerInRange(value.targetId, 0, Number.MAX_SAFE_INTEGER)) return false;
  return value.completed === undefined || typeof value.completed === "boolean";
}

function isRuntime(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isOneOf(value.kind, MISSION_KINDS) || !isOneOf(value.phase, ["active", "extraction", "complete"] as const)) return false;
  if (!Array.isArray(value.targetIds) || !value.targetIds.every((id) => isIntegerInRange(id, 0, Number.MAX_SAFE_INTEGER))) return false;
  if (!isIntegerInRange(value.rescued, 0, Number.MAX_SAFE_INTEGER) || !isIntegerInRange(value.required, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (!Array.isArray(value.secondary) || !value.secondary.every(isSecondaryObjective)) return false;
  if (value.convoyStartTick !== undefined && !isIntegerInRange(value.convoyStartTick, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (value.zone !== undefined && !isVec2(value.zone)) return false;
  if (value.deadline !== undefined && !isIntegerInRange(value.deadline, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (value.extractedIds !== undefined && (!Array.isArray(value.extractedIds) || !value.extractedIds.every((id) => isIntegerInRange(id, 0, Number.MAX_SAFE_INTEGER)))) return false;
  if (value.director !== undefined) {
    if (!isRecord(value.director) || !isOneOf(value.director.phase, ["opening", "pressure", "finale"] as const)) return false;
    if (!isIntegerInRange(value.director.pressureStart, 0, Number.MAX_SAFE_INTEGER) || !isIntegerInRange(value.director.finaleStart, 0, Number.MAX_SAFE_INTEGER) || !isIntegerInRange(value.director.eventCount, 0, Number.MAX_SAFE_INTEGER)) return false;
  }
  return true;
}

export function isNormalizableStateInput(value: unknown): value is RecordLike {
  if (!isRecord(value)) return false;
  if (!isIntegerInRange(value.seed, 0, 9999) || !isIntegerInRange(value.width, 1, 256) || !isIntegerInRange(value.height, 1, 256)) return false;
  if ((value.width as number) * (value.height as number) > 256 * 256) return false;
  if (!Array.isArray(value.entities) || !value.entities.every(isRecord)) return false;
  if (value.runtime !== undefined && (!isRecord(value.runtime) || (value.runtime.targetIds !== undefined && !Array.isArray(value.runtime.targetIds)))) return false;
  return true;
}

export function isStateShape(value: unknown): value is SimState {
  if (!isRecord(value)) return false;
  const width = value.width;
  const height = value.height;
  if (!isIntegerInRange(width, 1, 256) || !isIntegerInRange(height, 1, 256) || width * height > 256 * 256) return false;
  if (!isIntegerInRange(value.seed, 0, 9999) || !isIntegerInRange(value.missionIndex, 0, 7) || !isIntegerInRange(value.tick, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (!Array.isArray(value.tiles) || value.tiles.length !== width * height || !value.tiles.every((tile) => typeof tile === "number" && TILE_KINDS.includes(tile as typeof TILE_KINDS[number]))) return false;
  if (!Array.isArray(value.heights) || value.heights.length !== width * height || !value.heights.every(isFiniteNumber)) return false;
  if (!Array.isArray(value.surfaces) || value.surfaces.length !== width * height || !value.surfaces.every((surface) => typeof surface === "number" && SURFACE_KINDS.includes(surface as typeof SURFACE_KINDS[number]))) return false;
  if (!Array.isArray(value.resourceAmount) || value.resourceAmount.length !== width * height || !value.resourceAmount.every(isNonNegativeNumber)) return false;
  const fogWidth = fogGridWidth(width);
  const fogHeight = fogGridHeight(height);
  if (!Array.isArray(value.fog) || value.fog.length !== fogWidth * fogHeight || !value.fog.every((cell) => isIntegerInRange(cell, 0, 2))) return false;
  if (!Array.isArray(value.entities) || !value.entities.every(isEntity)) return false;
  if (new Set(value.entities.map((entity) => entity.id)).size !== value.entities.length) return false;
  const nextId = value.nextId;
  if (!isIntegerInRange(nextId, 1, Number.MAX_SAFE_INTEGER) || value.entities.some((entity) => entity.id >= nextId)) return false;
  if (!isNumberPair(value.credits) || !isNumberPair(value.creditsEarned) || !isNumberPair(value.unitsProduced) || !isNumberPair(value.buildingsCompleted)) return false;
  const unitsProducedByRole = value.unitsProducedByRole;
  if (!isRecord(unitsProducedByRole) || !UNIT_KINDS.every((kind) => isNonNegativeNumber(unitsProducedByRole[kind]))) return false;
  if (!isRecord(value.buildingsCompletedByKind) || !Object.values(value.buildingsCompletedByKind).every(isNonNegativeNumber)) return false;
  if (!isRecord(value.losses) || !isNumberPair(value.losses.units) || !isNumberPair(value.losses.buildings)) return false;
  if (!isWin(value.win) || !["playing", "won", "lost"].includes(value.result as string)) return false;
  if (value.lossReason !== undefined && !isOneOf(value.lossReason, LOSS_REASONS)) return false;
  if (!isIntegerInRange(value.rngState, 0, Number.MAX_SAFE_INTEGER) || !isOneOf(value.biome, BIOMES)) return false;
  if (!Array.isArray(value.factions) || value.factions.length !== 2 || !isFaction(value.factions[0], 0) || !isFaction(value.factions[1], 1)) return false;
  if (!isString(value.missionName)) return false;
  if (value.missionKind !== undefined && !isOneOf(value.missionKind, MISSION_KINDS)) return false;
  if (value.runtime !== undefined && !isRuntime(value.runtime)) return false;
  if (value.tutorialStage !== undefined && !isOneOf(value.tutorialStage, ["select", "move", "harvest", "build", "produce", "attack", "repair", "complete"] as const)) return false;
  if (value.aiState !== undefined && !isOneOf(value.aiState, ["economy", "defense", "assault", "retreat", "regroup"] as const)) return false;
  if (value.aiRetreatTick !== undefined && !isIntegerInRange(value.aiRetreatTick, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (value.aiRetreatLocked !== undefined && typeof value.aiRetreatLocked !== "boolean") return false;
  return true;
}

export function isCampaignProgressShape(value: unknown): value is CampaignProgress {
  if (!isRecord(value)) return false;
  if (value.version !== 1 || !Number.isInteger(value.seed) || typeof value.tutorialComplete !== "boolean") return false;
  if (!Number.isInteger(value.unlockedMission)) return false;
  const unlockedMission = value.unlockedMission as number;
  if (unlockedMission < 0 || unlockedMission > 7) return false;
  if (!Array.isArray(value.completedMissions)) return false;
  if (value.completedMissions.some((mission) => !Number.isInteger(mission) || mission < 0 || mission > 7)) return false;
  if (new Set(value.completedMissions).size !== value.completedMissions.length) return false;
  if (value.completedMissions.some((mission) => mission > unlockedMission)) return false;
  if (!isRecord(value.medals) || !isRecord(value.bestScores)) return false;
  const validStats = (stats: RecordLike) => Object.entries(stats).every(([key, score]) =>
    /^[0-7]$/.test(key) && typeof score === "number" && Number.isFinite(score) && score >= 0,
  );
  return validStats(value.medals) && validStats(value.bestScores);
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function assertSupportedContentVersion(contentVersion: unknown): void {
  if (contentVersion !== SAVE_CONTENT_VERSION) throw new Error("Unsupported save content version");
}

export { MISSION_KINDS, BIOMES, LOSS_REASONS, SCENARIO_ROLES, ORDER_MODES, STANCES, FORMATIONS, ARMOR_TYPES, WEAPON_TYPES, SURFACE_KINDS, TILE_KINDS };
