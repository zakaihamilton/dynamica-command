import { describe, expect, it } from "vitest";
import { defaultBalanceJobs, balanceScenarios, runBalanceJob, sortBalanceRecords, stableBalanceRecords } from "../lib/sim/balanceRunner";

describe("defaultBalanceJobs", () => {
  it("returns at least 1", () => {
    expect(defaultBalanceJobs(0)).toBeGreaterThanOrEqual(1);
  });

  it("returns a value between 1 and min(cpus, 8, scenarioCount)", () => {
    const result = defaultBalanceJobs(100);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(8);
  });
});

describe("balanceScenarios", () => {
  it("generates scenarios for the given seed range and missions", () => {
    const scenarios = balanceScenarios({ from: 0, to: 2, missions: [0, 1] });
    expect(scenarios).toEqual([
      { seed: 0, mission: 0 },
      { seed: 0, mission: 1 },
      { seed: 1, mission: 0 },
      { seed: 1, mission: 1 },
      { seed: 2, mission: 0 },
      { seed: 2, mission: 1 },
    ]);
  });

  it("returns empty array when to < from", () => {
    expect(balanceScenarios({ from: 5, to: 2, missions: [0] })).toEqual([]);
  });

  it("deduplicates missions", () => {
    const scenarios = balanceScenarios({ from: 0, to: 0, missions: [0, 0, 0] });
    expect(scenarios).toEqual([{ seed: 0, mission: 0 }]);
  });

  it("filters out invalid mission indices", () => {
    const scenarios = balanceScenarios({ from: 0, to: 0, missions: [-1, 8, 99] });
    expect(scenarios).toEqual([]);
  });

  it("clamps from/to to 0-9999 range", () => {
    const scenarios = balanceScenarios({ from: -5, to: 10005, missions: [0] });
    expect(scenarios.length).toBe(10000);
  });
});

describe("runBalanceJob", () => {
  it("runs a small job and returns records", () => {
    const job = {
      from: 0, to: 0, missions: [0], maxTicks: 12,
      strategy: "competent" as const,
      scenarios: [{ seed: 0, mission: 0 }],
    };
    const records = runBalanceJob(job);
    expect(records).toHaveLength(1);
    expect(records[0]!.seed).toBe("0000");
    expect(records[0]!.mission).toBe(0);
    expect(records[0]!.scenarioMs).toBeGreaterThanOrEqual(0);
  });

  it("calls onRecord for each scenario", () => {
    const job = {
      from: 0, to: 1, missions: [0], maxTicks: 12,
      strategy: "competent" as const,
      scenarios: [{ seed: 0, mission: 0 }, { seed: 1, mission: 0 }],
    };
    const seen: string[] = [];
    runBalanceJob(job, (record) => seen.push(record.seed));
    expect(seen).toEqual(["0000", "0001"]);
  });

  it("throws for invalid mission index", () => {
    const job = {
      from: 0, to: 0, missions: [0], maxTicks: 12,
      strategy: "competent" as const,
      scenarios: [{ seed: 0, mission: 99 }],
    };
    expect(() => runBalanceJob(job)).toThrow("No mission 99");
  });

  it("runs with baseline strategy", () => {
    const job = {
      from: 0, to: 0, missions: [0], maxTicks: 12,
      strategy: "baseline" as const,
      scenarios: [{ seed: 0, mission: 0 }],
    };
    const records = runBalanceJob(job);
    expect(records).toHaveLength(1);
  });
});

describe("sortBalanceRecords", () => {
  it("sorts by seed then mission", () => {
    const records = [
      { seed: "0002", mission: 1 } as never,
      { seed: "0001", mission: 0 } as never,
      { seed: "0001", mission: 1 } as never,
    ];
    const sorted = sortBalanceRecords(records);
    expect(sorted.map((r) => `${r.seed}:${r.mission}`)).toEqual([
      "0001:0", "0001:1", "0002:1",
    ]);
  });
});

describe("stableBalanceRecords", () => {
  it("strips scenarioMs and sorts", () => {
    const records = [
      { seed: "0002", mission: 0, scenarioMs: 100 } as never,
      { seed: "0001", mission: 0, scenarioMs: 200 } as never,
    ];
    const stable = stableBalanceRecords(records);
    expect(stable.map((r) => r.seed)).toEqual(["0001", "0002"]);
    expect(stable[0]).not.toHaveProperty("scenarioMs");
  });
});
