export type BalanceRecord = {
  mission?: number;
  kind: string;
  result: "playing" | "won" | "lost";
  truncated: boolean;
  duration: number;
  credits: number;
  unitsProduced: number;
  aiUnitsProduced: number;
  powerDeficit: boolean;
  casualties: number;
  secondaryCompleted: number;
  mapValid: boolean;
  commandsIssued: number;
  commandRejections: number;
  lossReason?: string;
};

export type BalanceKindSummary = {
  samples: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  averageDuration: number;
  averageCredits: number;
  averageUnitsProduced: number;
  averageCasualties: number;
  averageCommands: number;
  averageCommandRejections: number;
  powerDeficitRate: number;
  commandRejectionRate: number;
  lossReasons: Record<string, number>;
};

export type BalanceSummary = {
  samples: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  timeoutRate: number;
  truncatedRate: number;
  mapFailureRate: number;
  powerDeficitRate: number;
  commandRejectionRate: number;
  averageDuration: number;
  averageCredits: number;
  averageCasualties: number;
  averageUnitsProduced: number;
  averageCommands: number;
  averageCommandRejections: number;
  byMissionKind: Record<string, BalanceKindSummary>;
  byMission: Record<string, BalanceKindSummary>;
};

export type BalanceThresholds = {
  minWinRate: number;
  maxWinRate?: number;
  maxTimeoutRate: number;
  minKindSamples: number;
  minKindWinRate: number;
  maxKindTimeoutRate: number;
  maxTruncatedRate: number;
  maxMapFailureRate: number;
  maxPowerDeficitRate: number;
  maxCommandRejectionRate: number;
  maxAverageCasualties: number;
  targetedKindWinRates?: Record<string, number>;
};

export type BalanceCheck = {
  passed: boolean;
  failures: string[];
};

export const DEFAULT_BALANCE_THRESHOLDS: BalanceThresholds = {
  minWinRate: 0.60,
  // The 80-scenario CI sweep must still contain at least two losses; this
  // keeps the softened campaign from silently becoming an automatic win.
  maxWinRate: 0.975,
  maxTimeoutRate: 0.20,
  minKindSamples: 4,
  minKindWinRate: 0.40,
  maxKindTimeoutRate: 0.20,
  maxTruncatedRate: 0,
  maxMapFailureRate: 0,
  maxPowerDeficitRate: 0,
  maxCommandRejectionRate: 0,
  maxAverageCasualties: 40,
  targetedKindWinRates: {
    rescue: 0.70,
    holdTheLine: 0.70,
  },
};

function average(records: BalanceRecord[], value: (record: BalanceRecord) => number): number {
  return records.length ? records.reduce((sum, record) => sum + value(record), 0) / records.length : 0;
}

function rate(records: BalanceRecord[], predicate: (record: BalanceRecord) => boolean): number {
  return records.length ? records.filter(predicate).length / records.length : 0;
}

function commandRejectionRate(records: BalanceRecord[]): number {
  const commands = records.reduce((sum, record) => sum + record.commandsIssued, 0);
  const rejections = records.reduce((sum, record) => sum + record.commandRejections, 0);
  return commands ? rejections / commands : 0;
}

function lossReasons(records: BalanceRecord[]): Record<string, number> {
  return Object.fromEntries(
    [...new Set(records.map((record) => record.lossReason).filter((reason): reason is string => !!reason))]
      .sort()
      .map((reason) => [reason, records.filter((record) => record.lossReason === reason).length]),
  );
}

function summarizeKind(records: BalanceRecord[]): BalanceKindSummary {
  const wins = records.filter((record) => record.result === "won").length;
  const losses = records.filter((record) => record.result === "lost").length;
  return {
    samples: records.length,
    wins,
    losses,
    timeouts: records.length - wins - losses,
    winRate: rate(records, (record) => record.result === "won"),
    averageDuration: average(records, (record) => record.duration),
    averageCredits: average(records, (record) => record.credits),
    averageUnitsProduced: average(records, (record) => record.unitsProduced),
    averageCasualties: average(records, (record) => record.casualties),
    averageCommands: average(records, (record) => record.commandsIssued),
    averageCommandRejections: average(records, (record) => record.commandRejections),
    powerDeficitRate: rate(records, (record) => record.powerDeficit),
    commandRejectionRate: commandRejectionRate(records),
    lossReasons: lossReasons(records),
  };
}

export function summarizeBalance(records: BalanceRecord[]): BalanceSummary {
  const wins = records.filter((record) => record.result === "won").length;
  const losses = records.filter((record) => record.result === "lost").length;
  const byMissionKind = Object.fromEntries(
    [...new Set(records.map((record) => record.kind))].sort().map((kind) => [
      kind,
      summarizeKind(records.filter((record) => record.kind === kind)),
    ]),
  );
  const missionIndexes = [...new Set(records.map((record) => record.mission).filter((mission): mission is number => mission !== undefined))].sort((a, b) => a - b);
  const byMission = Object.fromEntries(missionIndexes.map((mission) => [
    String(mission),
    summarizeKind(records.filter((record) => record.mission === mission)),
  ]));
  return {
    samples: records.length,
    wins,
    losses,
    timeouts: records.length - wins - losses,
    winRate: rate(records, (record) => record.result === "won"),
    timeoutRate: rate(records, (record) => record.result === "playing"),
    truncatedRate: rate(records, (record) => record.truncated),
    mapFailureRate: rate(records, (record) => !record.mapValid),
    powerDeficitRate: rate(records, (record) => record.powerDeficit),
    commandRejectionRate: commandRejectionRate(records),
    averageDuration: average(records, (record) => record.duration),
    averageCredits: average(records, (record) => record.credits),
    averageCasualties: average(records, (record) => record.casualties),
    averageUnitsProduced: average(records, (record) => record.unitsProduced),
    averageCommands: average(records, (record) => record.commandsIssued),
    averageCommandRejections: average(records, (record) => record.commandRejections),
    byMissionKind,
    byMission,
  };
}

export function checkBalance(summary: BalanceSummary, thresholds: BalanceThresholds): BalanceCheck {
  const failures: string[] = [];
  if (summary.winRate < thresholds.minWinRate) {
    failures.push(`win rate ${(summary.winRate * 100).toFixed(1)}% is below ${(thresholds.minWinRate * 100).toFixed(1)}%`);
  }
  if (thresholds.maxWinRate !== undefined && summary.winRate > thresholds.maxWinRate) {
    failures.push(`win rate ${(summary.winRate * 100).toFixed(1)}% exceeds ${(thresholds.maxWinRate * 100).toFixed(1)}%`);
  }
  if (summary.timeoutRate > thresholds.maxTimeoutRate) {
    failures.push(`timeout rate ${(summary.timeoutRate * 100).toFixed(1)}% exceeds ${(thresholds.maxTimeoutRate * 100).toFixed(1)}%`);
  }
  if (summary.truncatedRate > thresholds.maxTruncatedRate) {
    failures.push(`truncated run rate ${(summary.truncatedRate * 100).toFixed(1)}% exceeds ${(thresholds.maxTruncatedRate * 100).toFixed(1)}%`);
  }
  for (const [kind, kindSummary] of Object.entries(summary.byMissionKind)) {
    if (kindSummary.samples < thresholds.minKindSamples) continue;
    if (kindSummary.winRate < thresholds.minKindWinRate) {
      failures.push(`${kind} win rate ${(kindSummary.winRate * 100).toFixed(1)}% is below ${(thresholds.minKindWinRate * 100).toFixed(1)}%`);
    }
    if (kindSummary.timeouts / kindSummary.samples > thresholds.maxKindTimeoutRate) {
      failures.push(`${kind} timeout rate ${((kindSummary.timeouts / kindSummary.samples) * 100).toFixed(1)}% exceeds ${(thresholds.maxKindTimeoutRate * 100).toFixed(1)}%`);
    }
  }
  for (const [kind, minimum] of Object.entries(thresholds.targetedKindWinRates ?? {})) {
    const kindSummary = summary.byMissionKind[kind];
    if (!kindSummary || kindSummary.samples < thresholds.minKindSamples) continue;
    if (kindSummary.winRate < minimum) {
      failures.push(`${kind} targeted win rate ${(kindSummary.winRate * 100).toFixed(1)}% is below ${(minimum * 100).toFixed(1)}%`);
    }
  }
  for (const [mission, missionSummary] of Object.entries(summary.byMission)) {
    if (missionSummary.samples < thresholds.minKindSamples) continue;
    if (missionSummary.winRate < thresholds.minKindWinRate) {
      failures.push(`mission ${Number(mission) + 1} win rate ${(missionSummary.winRate * 100).toFixed(1)}% is below ${(thresholds.minKindWinRate * 100).toFixed(1)}%`);
    }
  }
  if (summary.mapFailureRate > thresholds.maxMapFailureRate) {
    failures.push(`map failure rate ${(summary.mapFailureRate * 100).toFixed(1)}% exceeds ${(thresholds.maxMapFailureRate * 100).toFixed(1)}%`);
  }
  if (summary.powerDeficitRate > thresholds.maxPowerDeficitRate) {
    failures.push(`power deficit rate ${(summary.powerDeficitRate * 100).toFixed(1)}% exceeds ${(thresholds.maxPowerDeficitRate * 100).toFixed(1)}%`);
  }
  if (summary.commandRejectionRate > thresholds.maxCommandRejectionRate) {
    failures.push(`command rejection rate ${(summary.commandRejectionRate * 100).toFixed(1)}% exceeds ${(thresholds.maxCommandRejectionRate * 100).toFixed(1)}%`);
  }
  if (summary.averageCasualties > thresholds.maxAverageCasualties) {
    failures.push(`average casualties ${summary.averageCasualties.toFixed(1)} exceeds ${thresholds.maxAverageCasualties}`);
  }
  return { passed: failures.length === 0, failures };
}
