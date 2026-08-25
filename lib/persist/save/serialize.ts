import { formatSeed } from "../../seed/rng";
import { SURFACE_NONE } from "../../types";
import type { CampaignProgress, SimState, UnitKind } from "../../types";
import { generateWorld } from "../../gen/world";
import { expandFog } from "../../sim/fog";
import { isSupportUnit, UNIT_KINDS } from "../../catalog";
import {
  SAVE_CONTENT_VERSION,
  isStateShape,
  isNormalizableStateInput,
  isCampaignProgressShape,
  isNumber,
  assertSupportedContentVersion,
} from "./validation";
export { SAVE_CONTENT_VERSION } from "./validation";

export const SAVE_PREFIX = "genesis-protocol:save:";
export const SAVE_VERSION = 2;
const LEGACY_SAVE_VERSION = 1;
const LEGACY_SAVE_CONTENT_VERSION = 1;

export const SAVE_EXPORT_FORMAT = "genesis-protocol-save" as const;
export const SAVE_EXPORT_VERSION = 1 as const;
export const SAVE_TRANSFER_KEY = "genesis-protocol:save-transfer";

export type SaveEnvelope = {
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

export function decodeSave(raw: string): { state: SimState; savedAt: number } {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
