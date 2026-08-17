import { WIN_KIND_ORDER } from "../catalog";
import { createRng } from "../seed/rng";
import type { BuildingKind, UnitKind, WinCategory, WinCategoryKind } from "../types";
import { minutesToTicks, missionDurationMinutes } from "./pacing";

const BUILDABLE: BuildingKind[] = ["power", "refinery", "barracks", "factory", "turret"];
const COMBAT_ROLES: UnitKind[] = ["infantry", "antiArmor", "tank"];

export function generateWinCategory(
  seed: number,
  missionIndex: number,
  kind: WinCategoryKind,
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
    default:
      return { kind: "decapitate" };
  }
}

export function pickMissionKinds(seed: number): WinCategoryKind[] {
  const rng = createRng(seed, "win-order");
  return rng.shuffle(WIN_KIND_ORDER);
}
