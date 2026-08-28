import { describe, expect, it } from "vitest";
import { checkBalance, summarizeBalance, type BalanceRecord } from "../lib/sim/balance";

function makeRecord(overrides: Partial<BalanceRecord> = {}): BalanceRecord {
  return {
    kind: "escort",
    result: "won",
    truncated: false,
    duration: 100,
    credits: 500,
    unitsProduced: 2,
    aiUnitsProduced: 2,
    powerDeficit: false,
    casualties: 0,
    secondaryCompleted: 0,
    mapValid: true,
    commandsIssued: 3,
    commandRejections: 0,
    ...overrides,
  };
}

describe("summarizeBalance", () => {
  it("groups by mission index when present", () => {
    const records = [
      makeRecord({ mission: 0, result: "won" }),
      makeRecord({ mission: 0, result: "won" }),
      makeRecord({ mission: 1, result: "lost" }),
    ];
    const summary = summarizeBalance(records);
    expect(summary.byMission["0"]?.winRate).toBe(1);
    expect(summary.byMission["1"]?.winRate).toBe(0);
  });

  it("handles empty records", () => {
    const summary = summarizeBalance([]);
    expect(summary.samples).toBe(0);
    expect(summary.byMissionKind).toEqual({});
    expect(summary.byMission).toEqual({});
  });

  it("computes all average and rate fields", () => {
    const records = [
      makeRecord({ result: "won", duration: 100, credits: 200, casualties: 5, unitsProduced: 3, commandsIssued: 10, commandRejections: 1 }),
      makeRecord({ result: "lost", duration: 200, credits: 400, casualties: 10, unitsProduced: 5, commandsIssued: 20, commandRejections: 2 }),
    ];
    const summary = summarizeBalance(records);
    expect(summary.averageDuration).toBeCloseTo(150);
    expect(summary.averageCredits).toBeCloseTo(300);
    expect(summary.averageCasualties).toBeCloseTo(7.5);
    expect(summary.averageUnitsProduced).toBeCloseTo(4);
    expect(summary.averageCommands).toBeCloseTo(15);
    expect(summary.averageCommandRejections).toBeCloseTo(1.5);
    expect(summary.commandRejectionRate).toBeCloseTo(3 / 30);
    expect(summary.powerDeficitRate).toBe(0);
  });
});

describe("checkBalance", () => {
  it("enforces targeted mission-kind win-rate floors", () => {
    const records = Array.from({ length: 4 }, (_, index) => makeRecord({
      kind: "rescue",
      result: index < 2 ? "won" : "lost",
    }));
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0,
      maxTimeoutRate: 1,
      minKindSamples: 4,
      minKindWinRate: 0,
      maxKindTimeoutRate: 1,
      maxTruncatedRate: 1,
      maxMapFailureRate: 1,
      maxPowerDeficitRate: 1,
      maxCommandRejectionRate: 1,
      maxAverageCasualties: 40,
      targetedKindWinRates: { rescue: 0.7 },
    });

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("rescue targeted win rate");
  });

  it("passes with reasonable thresholds", () => {
    const records = Array.from({ length: 10 }, (_, i) => makeRecord({ result: i < 8 ? "won" : "lost" }));
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0.5,
      maxWinRate: 0.95,
      maxTimeoutRate: 0.2,
      minKindSamples: 4,
      minKindWinRate: 0.4,
      maxKindTimeoutRate: 0.2,
      maxTruncatedRate: 0,
      maxMapFailureRate: 0,
      maxPowerDeficitRate: 0,
      maxCommandRejectionRate: 0,
      maxAverageCasualties: 40,
    });
    expect(result.passed).toBe(true);
  });

  it("fails when win rate exceeds maxWinRate", () => {
    const records = Array.from({ length: 10 }, () => makeRecord({ result: "won" }));
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0.5,
      maxWinRate: 0.8,
      maxTimeoutRate: 0.2,
      minKindSamples: 4,
      minKindWinRate: 0.4,
      maxKindTimeoutRate: 0.2,
      maxTruncatedRate: 0,
      maxMapFailureRate: 0,
      maxPowerDeficitRate: 0,
      maxCommandRejectionRate: 0,
      maxAverageCasualties: 40,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("win rate");
    expect(result.failures.join(" ")).toContain("exceeds");
  });

  it("skips kind-level checks when below minKindSamples", () => {
    const records = [makeRecord({ kind: "escort", result: "lost" })];
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0,
      maxTimeoutRate: 1,
      minKindSamples: 4,
      minKindWinRate: 1.0,
      maxKindTimeoutRate: 0,
      maxTruncatedRate: 1,
      maxMapFailureRate: 1,
      maxPowerDeficitRate: 1,
      maxCommandRejectionRate: 1,
      maxAverageCasualties: 40,
    });
    expect(result.passed).toBe(true);
  });

  it("fails when mission-level win rate is below threshold", () => {
    const records = [
      makeRecord({ mission: 0, result: "lost" }),
      makeRecord({ mission: 0, result: "lost" }),
      makeRecord({ mission: 0, result: "lost" }),
      makeRecord({ mission: 0, result: "lost" }),
    ];
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0,
      maxTimeoutRate: 1,
      minKindSamples: 4,
      minKindWinRate: 0.5,
      maxKindTimeoutRate: 1,
      maxTruncatedRate: 1,
      maxMapFailureRate: 1,
      maxPowerDeficitRate: 1,
      maxCommandRejectionRate: 1,
      maxAverageCasualties: 40,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("mission 1 win rate");
  });

  it("skips mission-level checks when below minKindSamples", () => {
    const records = [makeRecord({ mission: 0, result: "lost" })];
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0,
      maxTimeoutRate: 1,
      minKindSamples: 4,
      minKindWinRate: 1.0,
      maxKindTimeoutRate: 1,
      maxTruncatedRate: 1,
      maxMapFailureRate: 1,
      maxPowerDeficitRate: 1,
      maxCommandRejectionRate: 1,
      maxAverageCasualties: 40,
    });
    expect(result.passed).toBe(true);
  });

  it("reports power deficit, map failure, and rejection rates", () => {
    const records = [
      makeRecord({ powerDeficit: true, mapValid: false, commandRejections: 5, commandsIssued: 10 }),
    ];
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0,
      maxTimeoutRate: 1,
      minKindSamples: 4,
      minKindWinRate: 0,
      maxKindTimeoutRate: 1,
      maxTruncatedRate: 1,
      maxMapFailureRate: 0,
      maxPowerDeficitRate: 0,
      maxCommandRejectionRate: 0,
      maxAverageCasualties: 40,
    });
    expect(result.failures.join(" ")).toContain("power deficit");
    expect(result.failures.join(" ")).toContain("map failure");
    expect(result.failures.join(" ")).toContain("command rejection");
  });

  it("reports average casualties exceeding threshold", () => {
    const records = [makeRecord({ casualties: 50 })];
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0,
      maxTimeoutRate: 1,
      minKindSamples: 4,
      minKindWinRate: 0,
      maxKindTimeoutRate: 1,
      maxTruncatedRate: 1,
      maxMapFailureRate: 1,
      maxPowerDeficitRate: 1,
      maxCommandRejectionRate: 1,
      maxAverageCasualties: 10,
    });
    expect(result.failures.join(" ")).toContain("average casualties");
  });

  it("reports truncated run rate exceeding threshold", () => {
    const records = [makeRecord({ truncated: true })];
    const result = checkBalance(summarizeBalance(records), {
      minWinRate: 0,
      maxTimeoutRate: 1,
      minKindSamples: 4,
      minKindWinRate: 0,
      maxKindTimeoutRate: 1,
      maxTruncatedRate: 0,
      maxMapFailureRate: 1,
      maxPowerDeficitRate: 1,
      maxCommandRejectionRate: 1,
      maxAverageCasualties: 40,
    });
    expect(result.failures.join(" ")).toContain("truncated");
  });
});
