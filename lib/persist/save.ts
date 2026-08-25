import { formatSeed } from "../seed/rng";
import { generateWorld } from "../gen/world";
import { expandFog, fogGridHeight, fogGridWidth } from "../sim/fog";
import { BUILDING_KINDS, UNIT_KINDS, isSupportUnit } from "../catalog";
import type { BuildingKind, CampaignProgress, Entity, SimState, UnitKind } from "../types";
import { SURFACE_NONE } from "../types";

export type StorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  keys: () => string[];
};

/** Storage can fail in browsers with disabled privacy storage or an exhausted quota. */
export function safeGetItem(storage: StorageAdapter, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(storage: StorageAdapter, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(storage: StorageAdapter, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeKeys(storage: StorageAdapter): string[] {
  try {
    return storage.keys();
  } catch {
    return [];
  }
}

export const SAVE_PREFIX = "genesis-protocol:save:";
export const SAVE_VERSION = 2;
/** Bump when deterministic generation or simulation semantics change incompatibly. */
export const SAVE_CONTENT_VERSION = 1;
const LEGACY_SAVE_VERSION = 1;
const LEGACY_SAVE_CONTENT_VERSION = 1;

export const SAVE_EXPORT_FORMAT = "genesis-protocol-save" as const;
export const SAVE_EXPORT_VERSION = 1 as const;
export const SAVE_TRANSFER_KEY = "genesis-protocol:save-transfer";

type SaveEnvelope = {
  version: typeof SAVE_VERSION;
  contentVersion: typeof SAVE_CONTENT_VERSION;
  savedAt: number;
  state: unknown;
};

export type SaveExportEnvelope = {
  format: typeof SAVE_EXPORT_FORMAT;
  version: typeof SAVE_EXPORT_VERSION;
  contentVersion: typeof SAVE_CONTENT_VERSION;
  exportedAt: number;
  state: SimState;
  campaign: CampaignProgress;
};

export type ParsedSaveExport = {
  state: SimState;
  campaign: CampaignProgress;
  exportedAt: number;
};

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

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

function isFiniteNumber(value: unknown): value is number {
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

function isEntity(value: unknown): value is Entity {
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

function isWin(value: unknown): boolean {
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

function isNormalizableStateInput(value: unknown): value is RecordLike {
  if (!isRecord(value)) return false;
  if (!isIntegerInRange(value.seed, 0, 9999) || !isIntegerInRange(value.width, 1, 256) || !isIntegerInRange(value.height, 1, 256)) return false;
  if ((value.width as number) * (value.height as number) > 256 * 256) return false;
  if (!Array.isArray(value.entities) || !value.entities.every(isRecord)) return false;
  if (value.runtime !== undefined && (!isRecord(value.runtime) || (value.runtime.targetIds !== undefined && !Array.isArray(value.runtime.targetIds)))) return false;
  return true;
}

function isStateShape(value: unknown): value is SimState {
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

function decodeSave(raw: string): { state: SimState; savedAt: number } {
  const parsed: unknown = JSON.parse(raw);
  let value = parsed;
  let savedAt = 0;
  if (isRecord(parsed) && "state" in parsed) {
    if ((parsed.version !== SAVE_VERSION && parsed.version !== LEGACY_SAVE_VERSION) || !isNumber(parsed.savedAt)) {
      throw new Error("Unsupported save version");
    }
    const contentVersion = parsed.contentVersion ?? LEGACY_SAVE_CONTENT_VERSION;
    assertSupportedContentVersion(contentVersion);
    value = parsed.state;
    savedAt = parsed.savedAt;
  } else if (isRecord(parsed) && isNumber(parsed.savedAt)) {
    // Legacy saves stored SimState and savedAt at the same level.
    assertSupportedContentVersion(LEGACY_SAVE_CONTENT_VERSION);
    savedAt = parsed.savedAt;
  }
  const state = normalizeState(value);
  if (!isStateShape(state)) throw new Error("Invalid save state");
  return { state, savedAt };
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertSupportedContentVersion(contentVersion: unknown): void {
  if (contentVersion !== SAVE_CONTENT_VERSION) throw new Error("Unsupported save content version");
}

function isCampaignProgressShape(value: unknown): value is CampaignProgress {
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

export function serializeSaveExport(
  state: SimState,
  campaign: CampaignProgress,
  exportedAt = Date.now(),
): string {
  if (!isCampaignProgressShape(campaign)) throw new Error("Invalid campaign progress");
  if (!isStateShape(state)) throw new Error("Invalid save state");
  if (state.seed !== campaign.seed) throw new Error("Save and campaign seeds must match");
  const envelope: SaveExportEnvelope = {
    format: SAVE_EXPORT_FORMAT,
    version: SAVE_EXPORT_VERSION,
    contentVersion: SAVE_CONTENT_VERSION,
    exportedAt,
    state,
    campaign,
  };
  return JSON.stringify(envelope);
}

export function parseSaveExport(raw: string): ParsedSaveExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Save file is not valid JSON");
  }
  if (!isRecord(parsed) || parsed.format !== SAVE_EXPORT_FORMAT || parsed.version !== SAVE_EXPORT_VERSION) {
    throw new Error("Unsupported save file format or version");
  }
  if (parsed.contentVersion !== SAVE_CONTENT_VERSION || !isNumber(parsed.exportedAt)) {
    throw new Error("Unsupported save content version");
  }
  if (!isCampaignProgressShape(parsed.campaign)) throw new Error("Invalid campaign progress");
  if (!isNormalizableStateInput(parsed.state)) throw new Error("Invalid save state");
  const state = normalizeState(parsed.state);
  if (!isStateShape(state)) throw new Error("Invalid save state");
  if (state.seed !== parsed.campaign.seed) throw new Error("Save and campaign seeds do not match");
  return { state, campaign: parsed.campaign, exportedAt: parsed.exportedAt };
}

export function saveExportFilename(seed: number): string {
  return `genesis-protocol-${formatSeed(seed)}-save.json`;
}

export function saveKey(seed: number): string {
  return `${SAVE_PREFIX}${formatSeed(seed)}`;
}

export type SaveMeta = {
  seed: string;
  campaignName: string;
  missionIndex: number;
  tick: number;
  result: SimState["result"];
  missionName: string;
  savedAt: number;
};

export function serializeState(state: SimState): string {
  return JSON.stringify(state);
}

export function deserializeState(raw: string): SimState {
  return decodeSave(raw).state;
}

function normalizeState(value: unknown): SimState {
  if (!isRecord(value)) throw new Error("Invalid save state");
  if (
    typeof value.width !== "number" || !Number.isInteger(value.width) || value.width <= 0 ||
    typeof value.height !== "number" || !Number.isInteger(value.height) || value.height <= 0
  ) {
    throw new Error("Invalid save state");
  }
  const s = value as unknown as SimState;
  if (!s.heights || s.heights.length !== s.width * s.height) {
    s.heights = new Array(s.width * s.height).fill(1);
  }
  if (!s.surfaces || s.surfaces.length !== s.width * s.height) {
    s.surfaces = new Array(s.width * s.height).fill(SURFACE_NONE);
  }
  if (!s.biome) s.biome = generateWorld(s.seed).biome;
  if (!Array.isArray(s.fog)) s.fog = [];
  s.fog = expandFog(s.fog, s.width, s.height);
  if (!s.losses || !Array.isArray(s.losses.units) || !Array.isArray(s.losses.buildings)) {
    s.losses = { units: [0, 0], buildings: [0, 0] };
  }
  if (!s.unitsProducedByRole || typeof s.unitsProducedByRole !== "object") {
    s.unitsProducedByRole = Object.fromEntries(UNIT_KINDS.map((kind) => [kind, 0])) as SimState["unitsProducedByRole"];
  } else {
    for (const kind of UNIT_KINDS) {
      if (typeof s.unitsProducedByRole[kind] !== "number") s.unitsProducedByRole[kind] = 0;
    }
  }
  if (!s.buildingsCompletedByKind || typeof s.buildingsCompletedByKind !== "object") {
    s.buildingsCompletedByKind = {};
  }
  if (!Array.isArray(s.entities)) s.entities = [];
  const scenarioRole =
    s.runtime?.kind === "escort" ? "convoy" :
    s.runtime?.kind === "rescue" ? "stranded" :
    s.runtime?.kind === "extraction" ? "cargo" :
    undefined;
  const scenarioTargetIds = new Set(s.runtime?.targetIds ?? []);
  for (const e of s.entities) {
    if (!e.queue) e.queue = [];
    if (e.facing === undefined) e.facing = e.owner === 0 ? 0 : 4;
    if (e.repairing === undefined) e.repairing = false;
    if (e.stance === undefined) e.stance = "aggressive";
    if (e.suppression === undefined) e.suppression = 0;
    if (e.class === "unit" && isSupportUnit(e.kind as UnitKind)) {
      if (e.supportMode !== "auto" && e.supportMode !== "assigned" && e.supportMode !== "hold") e.supportMode = "auto";
    } else {
      delete e.supportTargetId;
      delete e.supportMode;
    }
    if (e.scenarioRole === undefined && e.class === "unit" && scenarioRole && scenarioTargetIds.has(e.id)) {
      e.scenarioRole = scenarioRole;
    }
  }
  if (!s.aiState) s.aiState = "economy";
  if (typeof s.aiRetreatTick !== "number" || !Number.isInteger(s.aiRetreatTick)) {
    delete s.aiRetreatTick;
  }
  if (s.aiRetreatLocked !== true) delete s.aiRetreatLocked;
  delete (s as { appliedUpgrades?: unknown }).appliedUpgrades;
  return s;
}

export function writeSave(storage: StorageAdapter, state: SimState): boolean {
  const payload: SaveEnvelope = {
    version: SAVE_VERSION,
    contentVersion: SAVE_CONTENT_VERSION,
    savedAt: Date.now(),
    state,
  };
  return safeSetItem(storage, saveKey(state.seed), JSON.stringify(payload));
}

export function readPendingSaveTransfer(storage: StorageAdapter): ParsedSaveExport | null {
  const raw = safeGetItem(storage, SAVE_TRANSFER_KEY);
  if (!raw) return null;
  try {
    return parseSaveExport(raw);
  } catch {
    return null;
  }
}

export function writePendingSaveTransfer(
  storage: StorageAdapter,
  state: SimState,
  campaign: CampaignProgress,
): boolean {
  try {
    return safeSetItem(storage, SAVE_TRANSFER_KEY, serializeSaveExport(state, campaign));
  } catch {
    return false;
  }
}

export function clearPendingSaveTransfer(storage: StorageAdapter): boolean {
  return safeRemoveItem(storage, SAVE_TRANSFER_KEY);
}

export function hasSaveForSeed(storage: StorageAdapter, seed: number): boolean {
  return readPendingSaveTransfer(storage)?.state.seed === seed || safeGetItem(storage, saveKey(seed)) !== null;
}

export function readSave(storage: StorageAdapter, seed: number): SimState | null {
  const pending = readPendingSaveTransfer(storage);
  if (pending?.state.seed === seed) return pending.state;
  const raw = safeGetItem(storage, saveKey(seed));
  if (!raw) return null;
  try {
    const { state } = decodeSave(raw);
    return state.seed === seed ? state : null;
  } catch {
    return null;
  }
}

export function removeSave(storage: StorageAdapter, seed: number): void {
  safeRemoveItem(storage, saveKey(seed));
  const pending = readPendingSaveTransfer(storage);
  if (pending?.state.seed === seed) safeRemoveItem(storage, SAVE_TRANSFER_KEY);
}

/** Save keys whose payload cannot be migrated into a playable state. */
export function listUnreadableSaves(storage: StorageAdapter): string[] {
  const unreadable: string[] = [];
  const pending = readPendingSaveTransfer(storage);
  for (const key of safeKeys(storage)) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    const seed = key.slice(SAVE_PREFIX.length);
    if (!/^\d{4}$/.test(seed)) continue;
    if (pending?.state.seed === Number(seed)) continue;
    try {
      const { state } = decodeSave(safeGetItem(storage, key) ?? "");
      if (state.seed !== Number(seed)) unreadable.push(seed);
    } catch {
      unreadable.push(seed);
    }
  }
  return unreadable.sort();
}

export function listSaves(storage: StorageAdapter): SaveMeta[] {
  const out: SaveMeta[] = [];
  const pending = readPendingSaveTransfer(storage);
  const pendingSeed = pending ? saveKey(pending.state.seed) : null;
  if (pending) {
    out.push({
      seed: formatSeed(pending.state.seed),
      campaignName: generateWorld(pending.state.seed).name,
      missionIndex: pending.state.missionIndex,
      tick: pending.state.tick,
      result: pending.state.result,
      missionName: pending.state.missionName,
      savedAt: pending.exportedAt,
    });
  }
  for (const key of safeKeys(storage)) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    if (key === pendingSeed) continue;
    const raw = safeGetItem(storage, key);
    if (!raw) continue;
    try {
      const { state: s, savedAt } = decodeSave(raw);
      if (key !== saveKey(s.seed)) continue;
      out.push({
        seed: formatSeed(s.seed),
        campaignName: generateWorld(s.seed).name,
        missionIndex: s.missionIndex,
        tick: s.tick,
        result: s.result,
        missionName: s.missionName,
        savedAt,
      });
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt || a.seed.localeCompare(b.seed));
}

export function memoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()],
  };
}

export function localStorageAdapter(): StorageAdapter {
  return {
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
    removeItem: (k) => window.localStorage.removeItem(k),
    keys: () => Object.keys(window.localStorage),
  };
}
