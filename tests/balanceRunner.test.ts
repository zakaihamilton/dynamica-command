import { describe, expect, it } from "vitest";
import { runBalanceScenarios, stableBalanceRecords } from "../lib/sim/balanceRunner";

describe("balance runner", () => {
  it("keeps serial and worker-thread results deterministic and identically ordered", async () => {
    const options = { from: 0, to: 3, missions: [0], maxTicks: 24, strategy: "competent" as const };
    const serial = await runBalanceScenarios({ ...options, jobs: 1 });
    const parallel = await runBalanceScenarios({ ...options, jobs: 2 });
    expect(JSON.stringify(stableBalanceRecords(parallel))).toBe(JSON.stringify(stableBalanceRecords(serial)));
    expect(parallel.map((record) => `${record.seed}:${record.mission}`)).toEqual(["0000:0", "0001:0", "0002:0", "0003:0"]);
  });

  it("reports progress while scenarios complete", async () => {
    const progress: Array<{ completed: number; total: number }> = [];
    await runBalanceScenarios({
      from: 0,
      to: 1,
      missions: [0],
      maxTicks: 12,
      jobs: 2,
      strategy: "competent",
      onProgress: ({ completed, total }) => progress.push({ completed, total }),
    });
    expect(progress).toHaveLength(2);
    expect(progress.map((entry) => entry.total)).toEqual([2, 2]);
    expect(progress.at(-1)?.completed).toBe(2);
  });
});
