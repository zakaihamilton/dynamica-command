import { safeGetItem, safeSetItem, type StorageAdapter } from "./save";
import type { MissionKind, SimState } from "../types";

export const TELEMETRY_KEY = "genesis-protocol:telemetry";
export const TELEMETRY_VERSION = 1 as const;
export const TELEMETRY_MAX_RECORDS = 128;

export type MissionTelemetry = {
  missionIndex: number;
  missionKind: MissionKind | "unknown";
  result: SimState["result"];
  lossReason?: SimState["lossReason"];
  durationTicks: number;
  deadlineOutcome: "completed" | "timedOut" | "notApplicable";
  credits: number;
  unitsProduced: number;
  casualties: number;
  commandsIssued: number;
  commandRejections: number;
  secondaryObjectivesCompleted: number;
  secondaryObjectivesTotal: number;
  recordedAt: number;
};

type TelemetryEnvelope = {
  version: typeof TELEMETRY_VERSION;
  records: MissionTelemetry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteInteger(value: unknown, min = 0): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= min;
}

function normalizeRecord(value: unknown): MissionTelemetry | null {
  if (!isRecord(value)) return null;
  if (!finiteInteger(value.missionIndex) || typeof value.missionKind !== "string") return null;
  if (value.result !== "playing" && value.result !== "won" && value.result !== "lost") return null;
  const deadlineOutcome = value.deadlineOutcome === "completed" || value.deadlineOutcome === "timedOut"
    ? value.deadlineOutcome
    : "notApplicable";
  const numberOrZero = (candidate: unknown) => typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 ? candidate : 0;
  return {
    missionIndex: value.missionIndex,
    missionKind: value.missionKind as MissionTelemetry["missionKind"],
    result: value.result,
    lossReason: value.lossReason === "yardDestroyed" || value.lossReason === "deadline" || value.lossReason === "objectiveTargetLost"
      ? value.lossReason
      : undefined,
    durationTicks: numberOrZero(value.durationTicks),
    deadlineOutcome,
    credits: numberOrZero(value.credits),
    unitsProduced: numberOrZero(value.unitsProduced),
    casualties: numberOrZero(value.casualties),
    commandsIssued: numberOrZero(value.commandsIssued),
    commandRejections: numberOrZero(value.commandRejections),
    secondaryObjectivesCompleted: numberOrZero(value.secondaryObjectivesCompleted),
    secondaryObjectivesTotal: numberOrZero(value.secondaryObjectivesTotal),
    recordedAt: numberOrZero(value.recordedAt),
  };
}

export function normalizeTelemetry(value: unknown): MissionTelemetry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeRecord)
    .filter((record): record is MissionTelemetry => record !== null)
    .slice(-TELEMETRY_MAX_RECORDS);
}

export function readTelemetry(storage: StorageAdapter): MissionTelemetry[] {
  const raw = safeGetItem(storage, TELEMETRY_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== TELEMETRY_VERSION) return [];
    return normalizeTelemetry(parsed.records);
  } catch {
    return [];
  }
}

export function writeTelemetry(storage: StorageAdapter, records: MissionTelemetry[]): boolean {
  const envelope: TelemetryEnvelope = {
    version: TELEMETRY_VERSION,
    records: normalizeTelemetry(records),
  };
  return safeSetItem(storage, TELEMETRY_KEY, JSON.stringify(envelope));
}

export function recordTelemetry(storage: StorageAdapter, record: MissionTelemetry): boolean {
  return writeTelemetry(storage, [...readTelemetry(storage), record]);
}

export function telemetryFromMission(
  state: SimState,
  stats: Pick<MissionTelemetry, "commandsIssued" | "commandRejections"> = { commandsIssued: 0, commandRejections: 0 },
): MissionTelemetry {
  const secondary = state.runtime?.secondary ?? [];
  const deadlineOutcome = state.result === "lost" && state.lossReason === "deadline"
    ? "timedOut"
    : state.runtime?.deadline === undefined ? "notApplicable" : "completed";
  return {
    missionIndex: state.missionIndex,
    missionKind: state.missionKind ?? state.runtime?.kind ?? "unknown",
    result: state.result,
    lossReason: state.lossReason,
    durationTicks: state.tick,
    deadlineOutcome,
    credits: state.credits[0],
    unitsProduced: state.unitsProduced[0],
    casualties: state.losses.units[0],
    commandsIssued: stats.commandsIssued,
    commandRejections: stats.commandRejections,
    secondaryObjectivesCompleted: secondary.filter((objective) => objective.completed === true).length,
    secondaryObjectivesTotal: secondary.length,
    recordedAt: Date.now(),
  };
}

export function summarizeTelemetry(records: MissionTelemetry[] = []): {
  missions: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  averageCasualties: number;
  commandRejectionRate: number;
} {
  const normalized = normalizeTelemetry(records);
  const commands = normalized.reduce((sum, record) => sum + record.commandsIssued, 0);
  return {
    missions: normalized.length,
    wins: normalized.filter((record) => record.result === "won").length,
    losses: normalized.filter((record) => record.result === "lost").length,
    timeouts: normalized.filter((record) => record.deadlineOutcome === "timedOut").length,
    winRate: normalized.length ? normalized.filter((record) => record.result === "won").length / normalized.length : 0,
    averageCasualties: normalized.length ? normalized.reduce((sum, record) => sum + record.casualties, 0) / normalized.length : 0,
    commandRejectionRate: commands ? normalized.reduce((sum, record) => sum + record.commandRejections, 0) / commands : 0,
  };
}
