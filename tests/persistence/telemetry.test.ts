import { describe, expect, it } from "vitest";
import { memoryStorage } from "../../lib/persist/save";
import {
  normalizeTelemetry,
  readTelemetry,
  recordTelemetry,
  summarizeTelemetry,
  TELEMETRY_KEY,
  TELEMETRY_MAX_RECORDS,
} from "../../lib/persist/telemetry";

const record = (index: number) => ({
  missionIndex: index,
  missionKind: "rescue" as const,
  result: "won" as const,
  durationTicks: 100,
  deadlineOutcome: "completed" as const,
  credits: 800,
  unitsProduced: 4,
  casualties: 2,
  commandsIssued: 10,
  commandRejections: 1,
  secondaryObjectivesCompleted: 1,
  secondaryObjectivesTotal: 2,
  recordedAt: index,
});

describe("local telemetry", () => {
  it("normalizes malformed records and retains only the bounded tail", () => {
    const records = normalizeTelemetry([
      record(1),
      { missionIndex: "bad", result: "won" },
      ...Array.from({ length: TELEMETRY_MAX_RECORDS + 4 }, (_, index) => record(index + 2)),
    ]);
    expect(records).toHaveLength(TELEMETRY_MAX_RECORDS);
    expect(records[0]?.missionIndex).toBe(6);
  });

  it("round-trips records and summarizes only aggregate fields", () => {
    const storage = memoryStorage();
    recordTelemetry(storage, record(0));
    recordTelemetry(storage, { ...record(1), result: "lost", deadlineOutcome: "timedOut", casualties: 6 });
    expect(readTelemetry(storage)).toHaveLength(2);
    expect(JSON.parse(storage.getItem(TELEMETRY_KEY)!)).not.toHaveProperty("coordinates");
    expect(summarizeTelemetry(readTelemetry(storage))).toMatchObject({
      missions: 2,
      wins: 1,
      losses: 1,
      timeouts: 1,
      averageCasualties: 4,
    });
  });
});
