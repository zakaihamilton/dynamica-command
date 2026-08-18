import { NEW_MISSION_KINDS, WIN_KIND_ORDER } from "../catalog";
import { createRng } from "../seed/rng";
import type { BuildingKind, MissionKind, UnitKind, WinCategory } from "../types";
import { minutesToTicks, missionDurationMinutes } from "./pacing";

const BUILDABLE: BuildingKind[] = ["power", "refinery", "barracks", "factory", "turret"];
const COMBAT_ROLES: UnitKind[] = ["infantry", "antiArmor", "tank"];

export function generateWinCategory(
  seed: number,
  missionIndex: number,
  kind: MissionKind,
): WinCategory {
  const rng = createRng(seed, `win:${missionIndex}:${kind}`);
  const minutes = missionDurationMinutes(missionIndex, rng.fork("duration"));
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
