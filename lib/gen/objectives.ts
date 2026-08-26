import { NEW_MISSION_KINDS, WIN_KIND_ORDER } from "../catalog";
import { createRng, type Rng } from "../seed/rng";
import type { BuildingKind, MissionDef, MissionKind, SecondaryObjective, UnitKind, WinCategory } from "../types";
import { CONVOY_STAGING_MINUTES, minutesToTicks, missionDurationMinutes } from "./pacing";

// Structure quotas may ask for several copies, so do not generate a quota for
// the producer buildings that are capped at one per mission.
const BUILDABLE: BuildingKind[] = ["power", "refinery", "turret"];
const COMBAT_ROLES: UnitKind[] = ["infantry", "antiArmor", "tank"];
const SCENARIO_KINDS: MissionKind[] = ["escort", "sabotage", "rescue", "extraction"];

function baseMissionDurationMinutes(seed: number, missionIndex: number, kind: MissionKind): number {
  const rng = createRng(seed, `win:${missionIndex}:${kind}`);
  return missionDurationMinutes(missionIndex, rng.fork("duration"));
}

/** Returns the expected operation window in minutes, including escort staging. */
export function missionDurationMinutesFor(
  seed: number,
  missionIndex: number,
  kind: MissionKind,
): number {
  const minutes = baseMissionDurationMinutes(seed, missionIndex, kind);
  if (kind === "escort") return Math.max(6, minutes - 1) + CONVOY_STAGING_MINUTES;
  if (kind === "rescue") return Math.max(6, minutes - 1);
  if (kind === "sabotage" || kind === "extraction") return Math.max(5, minutes - 1);
  return minutes;
}

export function secondaryObjectivesForMission(mission: Pick<MissionDef, "win">, rng: Rng): SecondaryObjective[] {
  const yard: SecondaryObjective = {
    id: "yard",
    kind: "preserveYard",
    label: "Keep the construction yard standing",
  };
  if (SCENARIO_KINDS.includes(mission.win.kind)) {
    return [
      yard,
      {
        id: "time",
        kind: "completeBefore",
        label: "Complete the operation before the deadline",
        target: mission.win.ticks ?? 3600,
      },
    ];
  }

  const secondary: SecondaryObjective = rng.chance(0.5)
    ? { id: "survivors", kind: "keepUnits", label: "Keep at least one combat unit alive", target: 1 }
    : { id: "tempo", kind: "completeBefore", label: "Complete the operation before the final push", target: (mission.win.ticks ?? 3600) + 1 };
  return [yard, secondary];
}

/** Generates the same secondary objectives used when the mission runtime is created. */
export function secondaryObjectivesForMissionSeed(
  seed: number,
  mission: Pick<MissionDef, "index" | "win">,
): SecondaryObjective[] {
  const rng = createRng(seed, `mission-spawn:${mission.index}`);
  if (mission.win.kind === "destroyMarked") {
    for (let i = 0; i < (mission.win.targetCount ?? 1); i++) rng.next();
  }
  return secondaryObjectivesForMission(mission, rng);
}

export function generateWinCategory(
  seed: number,
  missionIndex: number,
  kind: MissionKind,
): WinCategory {
  const rng = createRng(seed, `win:${missionIndex}:${kind}`);
  const minutes = baseMissionDurationMinutes(seed, missionIndex, kind);
  switch (kind) {
    case "harvestQuota":
      return {
        kind,
        target: Math.round((2800 + minutes * 420 + rng.int(600)) / 500) * 500,
      };
    case "forceQuota": {
      const role = rng.chance(0.55) ? rng.pick(COMBAT_ROLES) : undefined;
      if (role === "tank") {
        return { kind, role, target: 6 + missionIndex + rng.int(4) };
      }
      if (role === "antiArmor") {
        return { kind, role, target: 8 + missionIndex * 2 + rng.int(4) };
      }
      return {
        kind,
        role,
        target: 12 + missionIndex * 3 + rng.int(6),
      };
    }
    case "structureQuota": {
      const building = rng.chance(0.4) ? rng.pick(BUILDABLE) : undefined;
      const target = building === "turret" || building === "power"
        ? 4 + Math.floor(missionIndex / 2) + rng.int(3)
        : 5 + Math.floor(missionIndex / 2) + rng.int(3);
      return { kind, target, building };
    }
    case "destroyMarked":
      return { kind, targetCount: 2 + (missionIndex >= 4 ? 1 : 0) };
    case "razeAll":
      return { kind };
    case "decapitate":
      return { kind };
    case "annihilate":
      return { kind };
    case "holdTheLine":
      return { kind, ticks: minutesToTicks(minutes) };
    case "escort":
      return { kind, targetCount: 2 + rng.int(2), ticks: minutesToTicks(Math.max(6, minutes - 1)) };
    case "sabotage":
      return { kind, targetCount: 2 + (missionIndex >= 4 ? 1 : 0), ticks: minutesToTicks(Math.max(5, minutes - 1)) };
    case "rescue":
      return { kind, targetCount: 2 + rng.int(2), ticks: minutesToTicks(Math.max(6, minutes - 1)) };
    case "extraction":
      return { kind, targetCount: 2 + rng.int(3), ticks: minutesToTicks(Math.max(5, minutes - 1)) };
    default:
      return { kind: "decapitate" };
  }
}

export function pickMissionKinds(seed: number): MissionKind[] {
  const rng = createRng(seed, "win-order");
  const classic = rng.shuffle(WIN_KIND_ORDER).slice(0, 4);
  return rng.shuffle([...NEW_MISSION_KINDS, ...classic]);
}
