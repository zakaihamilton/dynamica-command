import { parseObjModelData } from "../objModel";
import { buildTankModel } from "./tank";
import { buildHarvesterModel } from "./harvester";
import { buildInfantryModel } from "./infantry";
import { buildAntiArmorModel } from "./antiArmor";
import { buildTurretHeadModel } from "./turret";
import type { ModelKind, UnitModel } from "./types";

export type { MeshData, ModelKind, ModelNode, UnitModel } from "./types";
export {
  computeNormal,
  createBoxMesh,
  createTrapezoidMesh,
  createCylinderMesh,
  createCylinderXMesh,
  createPolygonPrismMesh,
  mergeMeshes,
} from "./types";

export { buildTankModel } from "./tank";
export { buildHarvesterModel } from "./harvester";
export { buildInfantryModel } from "./infantry";
export { buildAntiArmorModel } from "./antiArmor";
export { buildTurretHeadModel } from "./turret";

export function buildUnitModel(kind: ModelKind): UnitModel {
  switch (kind) {
    case "tank": return buildTankModel();
    case "harvester": return buildHarvesterModel();
    case "infantry": return buildInfantryModel();
    case "antiArmor": return buildAntiArmorModel();
    case "medic": return { ...buildInfantryModel(), kind: "medic" };
    case "repairTruck": return { ...buildHarvesterModel(), kind: "repairTruck" };
    case "turret":
    case "turretHead": return buildTurretHeadModel();
  }
}

export function parseObjModel(text: string, kind: ModelKind): UnitModel {
  return parseObjModelData(text, kind, buildUnitModel);
}
