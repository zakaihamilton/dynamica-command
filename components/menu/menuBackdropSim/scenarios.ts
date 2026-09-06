import { assignAttack } from "@/lib/sim/ai/combat";
import { spawnBuilding, spawnUnit } from "@/lib/sim/world";
import type { BuildingKind } from "@/lib/types";
import { canPlaceBuilding } from "@/lib/sim/world";
import { BUILDING_STATS } from "@/lib/catalog";
import type { createMission } from "@/lib/sim/api";

export const CINEMA_SEED = 1847;

export type CinemaScenarioKind =
  | "baseAssault"
  | "turretDefense"
  | "harvesterAmbush"
  | "armorClash"
  | "infantryStorm"
  | "convoyRaid";

export const CINEMA_SCENARIO_KINDS: readonly CinemaScenarioKind[] = [
  "baseAssault",
  "turretDefense",
  "harvesterAmbush",
  "armorClash",
  "infantryStorm",
  "convoyRaid",
];

const CINEMA_BUILDING_SEARCH_RADIUS = 8;

export const CINEMA_STRUCTURE_KINDS: Record<CinemaScenarioKind, { player: BuildingKind; enemy: BuildingKind }> = {
  baseAssault: { player: "barracks", enemy: "turret" },
  turretDefense: { player: "turret", enemy: "factory" },
  harvesterAmbush: { player: "power", enemy: "refinery" },
  armorClash: { player: "factory", enemy: "factory" },
  infantryStorm: { player: "barracks", enemy: "barracks" },
  convoyRaid: { player: "turret", enemy: "refinery" },
};

export function spawnCinemaBuilding(
  state: ReturnType<typeof createMission>,
  owner: 0 | 1,
  kind: BuildingKind,
  preferred: { x: number; y: number },
  anchor: { x: number; y: number },
) {
  const candidates: { x: number; y: number }[] = [];
  for (let dy = -CINEMA_BUILDING_SEARCH_RADIUS; dy <= CINEMA_BUILDING_SEARCH_RADIUS; dy++) {
    for (let dx = -CINEMA_BUILDING_SEARCH_RADIUS; dx <= CINEMA_BUILDING_SEARCH_RADIUS; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > CINEMA_BUILDING_SEARCH_RADIUS) continue;
      const x = preferred.x + dx;
      const y = preferred.y + dy;
      if (!canPlaceBuilding(state, kind, x, y, owner, false)) continue;
      const footprint = BUILDING_STATS[kind].footprint;
      const overlapsUnit = state.entities.some(
        (entity) => entity.class === "unit" && entity.hp > 0
          && Math.round(entity.x) < x + footprint.w
          && Math.round(entity.x) >= x
          && Math.round(entity.y) < y + footprint.h
          && Math.round(entity.y) >= y,
      );
      if (!overlapsUnit) candidates.push({ x, y });
    }
  }
  const anchorIso = anchor.x - anchor.y;
  const anchorSum = anchor.x + anchor.y;
  candidates.sort((a, b) => {
    const anchorDistance = Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y);
    if (anchorDistance !== 0) return anchorDistance;
    const sumDelta = Math.abs((a.x + a.y) - anchorSum) - Math.abs((b.x + b.y) - anchorSum);
    if (sumDelta !== 0) return sumDelta;
    const isoDelta = Math.abs((a.x - a.y) - anchorIso) - Math.abs((b.x - b.y) - anchorIso);
    if (isoDelta !== 0) return isoDelta;
    const preferredDelta = Math.hypot(a.x - preferred.x, a.y - preferred.y) - Math.hypot(b.x - preferred.x, b.y - preferred.y);
    if (preferredDelta !== 0) return preferredDelta;
    return a.x - b.x || a.y - b.y;
  });
  const spot = candidates[0];
  if (!spot) throw new Error(`No valid cinema building site for ${kind}`);
  return spawnBuilding(state, owner, kind, spot.x, spot.y);
}

export interface ScenarioSpawnResult {
  pUnits: ReturnType<typeof spawnUnit>[];
  eUnits: ReturnType<typeof spawnUnit>[];
  playerStructure: ReturnType<typeof spawnBuilding>;
  enemyStructure: ReturnType<typeof spawnBuilding>;
}

export function populateScenarioForces(
  state: ReturnType<typeof createMission>,
  scenarioKind: CinemaScenarioKind,
  pSlots: { x: number; y: number }[],
  eSlots: { x: number; y: number }[],
  clashX: number,
  clashY: number,
): ScenarioSpawnResult {
  const pUnits: ReturnType<typeof spawnUnit>[] = [];
  const eUnits: ReturnType<typeof spawnUnit>[] = [];
  const structureKinds = CINEMA_STRUCTURE_KINDS[scenarioKind];

  if (scenarioKind === "baseAssault") {
    // Player assault breaching enemy forward fortification
    pUnits.push(
      spawnUnit(state, 0, "tank", pSlots[0]!.x, pSlots[0]!.y),
      spawnUnit(state, 0, "tank", pSlots[1]!.x, pSlots[1]!.y),
      spawnUnit(state, 0, "antiArmor", pSlots[2]!.x, pSlots[2]!.y),
      spawnUnit(state, 0, "repairTruck", pSlots[3]!.x, pSlots[3]!.y),
    );
    eUnits.push(
      spawnUnit(state, 1, "tank", eSlots[0]!.x, eSlots[0]!.y),
      spawnUnit(state, 1, "antiArmor", eSlots[1]!.x, eSlots[1]!.y),
      spawnUnit(state, 1, "infantry", eSlots[3]!.x, eSlots[3]!.y),
    );
  } else if (scenarioKind === "turretDefense") {
    // Player defending forward gun turret outpost against armored assault
    pUnits.push(
      spawnUnit(state, 0, "tank", pSlots[0]!.x, pSlots[0]!.y),
      spawnUnit(state, 0, "infantry", pSlots[2]!.x, pSlots[2]!.y),
      spawnUnit(state, 0, "medic", pSlots[3]!.x, pSlots[3]!.y),
    );
    eUnits.push(
      spawnUnit(state, 1, "tank", eSlots[0]!.x, eSlots[0]!.y),
      spawnUnit(state, 1, "tank", eSlots[1]!.x, eSlots[1]!.y),
      spawnUnit(state, 1, "antiArmor", eSlots[2]!.x, eSlots[2]!.y),
      spawnUnit(state, 1, "infantry", eSlots[3]!.x, eSlots[3]!.y),
    );
  } else if (scenarioKind === "harvesterAmbush") {
    // Ambush on enemy ore harvester and escort
    const harvester = spawnUnit(state, 1, "harvester", eSlots[1]!.x, eSlots[1]!.y);
    eUnits.push(
      harvester,
      spawnUnit(state, 1, "tank", eSlots[0]!.x, eSlots[0]!.y),
      spawnUnit(state, 1, "antiArmor", eSlots[2]!.x, eSlots[2]!.y),
      spawnUnit(state, 1, "infantry", eSlots[3]!.x, eSlots[3]!.y),
    );
    pUnits.push(
      spawnUnit(state, 0, "antiArmor", pSlots[0]!.x, pSlots[0]!.y),
      spawnUnit(state, 0, "antiArmor", pSlots[1]!.x, pSlots[1]!.y),
      spawnUnit(state, 0, "tank", pSlots[2]!.x, pSlots[2]!.y),
      spawnUnit(state, 0, "infantry", pSlots[3]!.x, pSlots[3]!.y),
    );
    assignAttack(state, pUnits[0]!, harvester);
    assignAttack(state, pUnits[1]!, harvester);
  } else if (scenarioKind === "armorClash") {
    // Heavy armor brawl with battlefield repair mechanics
    pUnits.push(
      spawnUnit(state, 0, "tank", pSlots[0]!.x, pSlots[0]!.y),
      spawnUnit(state, 0, "tank", pSlots[1]!.x, pSlots[1]!.y),
      spawnUnit(state, 0, "tank", pSlots[2]!.x, pSlots[2]!.y),
      spawnUnit(state, 0, "repairTruck", pSlots[3]!.x, pSlots[3]!.y),
    );
    eUnits.push(
      spawnUnit(state, 1, "tank", eSlots[0]!.x, eSlots[0]!.y),
      spawnUnit(state, 1, "tank", eSlots[1]!.x, eSlots[1]!.y),
      spawnUnit(state, 1, "tank", eSlots[2]!.x, eSlots[2]!.y),
      spawnUnit(state, 1, "repairTruck", eSlots[3]!.x, eSlots[3]!.y),
    );
  } else if (scenarioKind === "infantryStorm") {
    // Multi-squad infantry battle with medics healing the frontline
    pUnits.push(
      spawnUnit(state, 0, "infantry", pSlots[0]!.x, pSlots[0]!.y),
      spawnUnit(state, 0, "infantry", pSlots[1]!.x, pSlots[1]!.y),
      spawnUnit(state, 0, "antiArmor", pSlots[2]!.x, pSlots[2]!.y),
      spawnUnit(state, 0, "medic", pSlots[3]!.x, pSlots[3]!.y),
    );
    eUnits.push(
      spawnUnit(state, 1, "infantry", eSlots[0]!.x, eSlots[0]!.y),
      spawnUnit(state, 1, "infantry", eSlots[1]!.x, eSlots[1]!.y),
      spawnUnit(state, 1, "antiArmor", eSlots[2]!.x, eSlots[2]!.y),
      spawnUnit(state, 1, "medic", eSlots[3]!.x, eSlots[3]!.y),
    );
  } else {
    // convoyRaid: armored logistics interception
    const convoyTruck = spawnUnit(state, 1, "convoyTruck", eSlots[1]!.x, eSlots[1]!.y);
    eUnits.push(
      convoyTruck,
      spawnUnit(state, 1, "tank", eSlots[0]!.x, eSlots[0]!.y),
      spawnUnit(state, 1, "antiArmor", eSlots[2]!.x, eSlots[2]!.y),
      spawnUnit(state, 1, "infantry", eSlots[3]!.x, eSlots[3]!.y),
    );
    pUnits.push(
      spawnUnit(state, 0, "tank", pSlots[0]!.x, pSlots[0]!.y),
      spawnUnit(state, 0, "antiArmor", pSlots[1]!.x, pSlots[1]!.y),
      spawnUnit(state, 0, "antiArmor", pSlots[2]!.x, pSlots[2]!.y),
      spawnUnit(state, 0, "infantry", pSlots[3]!.x, pSlots[3]!.y),
    );
    assignAttack(state, pUnits[1]!, convoyTruck);
  }

  const pBuildingSlot = { x: clashX, y: clashY + 2 };
  const eBuildingSlot = { x: clashX + 2, y: clashY + 1 };

  let playerStructure: ReturnType<typeof spawnBuilding>;
  let enemyStructure: ReturnType<typeof spawnBuilding>;
  if (scenarioKind === "baseAssault") {
    enemyStructure = spawnCinemaBuilding(state, 1, structureKinds.enemy, eBuildingSlot, { x: clashX, y: clashY });
    playerStructure = spawnCinemaBuilding(state, 0, structureKinds.player, pBuildingSlot, { x: clashX, y: clashY });
  } else {
    playerStructure = spawnCinemaBuilding(state, 0, structureKinds.player, pBuildingSlot, { x: clashX, y: clashY });
    enemyStructure = spawnCinemaBuilding(state, 1, structureKinds.enemy, eBuildingSlot, { x: clashX, y: clashY });
  }
  if (scenarioKind === "baseAssault") {
    assignAttack(state, pUnits[0]!, enemyStructure);
    assignAttack(state, pUnits[1]!, enemyStructure);
  } else if (scenarioKind === "turretDefense") {
    assignAttack(state, eUnits[0]!, playerStructure);
    assignAttack(state, eUnits[1]!, playerStructure);
  }

  return { pUnits, eUnits, playerStructure, enemyStructure };
}
