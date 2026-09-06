import type { BalanceRecord } from "./evaluation";
import type { BalanceStrategy } from "../../types";

export type BalanceRecordWithScenario = BalanceRecord & {
  seed: string;
  mission: number;
  scenarioMs: number;
};

export type BalanceScenario = { seed: number; mission: number };

export type PlaytestManifestEntry = BalanceScenario & {
  seedLabel: string;
  kind: string;
  family: string;
  variant: string;
  name: string;
};

export type BalanceRunOptions = {
  from: number;
  to: number;
  missions: number[];
  maxTicks?: number;
  strategy?: BalanceStrategy;
  /** Monotonic deadline shared by the parent and all simulation workers. */
  deadlineAt?: number;
};

export type BalanceProgress = {
  completed: number;
  total: number;
  record: BalanceRecordWithScenario;
};

export type BalanceRunJob = BalanceRunOptions & {
  scenarios: BalanceScenario[];
};

export type BalanceSweepJob = Omit<BalanceRunOptions, "strategy"> & {
  strategies: readonly BalanceStrategy[];
  scenarios: BalanceScenario[];
};

export class BalanceTimeBudgetExceeded extends Error {
  constructor() {
    super("Balance sweep exceeded its elapsed-time budget");
    this.name = "BalanceTimeBudgetExceeded";
  }
}
