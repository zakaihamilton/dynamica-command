import type { UnitKind } from "../../types";
import { parseObjModelData } from "./objModel";
import {
  type MeshData,
  createBoxMesh,
  createTrapezoidMesh,
  createCylinderMesh,
  createCylinderXMesh,
  createPolygonPrismMesh,
  mergeMeshes,
} from "./meshPrimitives";

export type { MeshData } from "./meshPrimitives";
export {
  computeNormal,
  createBoxMesh,
  createTrapezoidMesh,
  createCylinderMesh,
  createCylinderXMesh,
  createPolygonPrismMesh,
  mergeMeshes,
} from "./meshPrimitives";

export type ModelKind = UnitKind | "turret" | "turretHead";

export type ModelNode = {
  name: string;
  parent?: string;
  pivot: [number, number, number];
  mesh: MeshData;
};

export type UnitModel = {
  kind: ModelKind;
  nodes: ModelNode[];
};

export function buildTankModel(): UnitModel {
  // Chassis
  const mainHull = createBoxMesh(-0.55, -0.28, 0.15, 0.55, 0.28, 0.55, 1); // primary color
  const frontSlope = createBoxMesh(0.4, -0.26, 0.15, 0.65, 0.26, 0.42, 2); // secondary
  const rearDeck = createBoxMesh(-0.65, -0.26, 0.22, -0.48, 0.26, 0.52, 2);
  const rearExhaust = createBoxMesh(-0.68, -0.18, 0.42, -0.58, 0.18, 0.56, 4);
  const leftTrack = createBoxMesh(-0.6, 0.28, 0.0, 0.6, 0.46, 0.45, 4); // dark tracks
  const rightTrack = createBoxMesh(-0.6, -0.46, 0.0, 0.6, -0.28, 0.45, 4);
  const chassisMesh = mergeMeshes([mainHull, frontSlope, rearDeck, rearExhaust, leftTrack, rightTrack]);

  // Turret
  const turretBase = createBoxMesh(-0.32, -0.26, 0.0, 0.32, 0.26, 0.38, 1);
  const cupola = createBoxMesh(-0.12, -0.18, 0.38, 0.1, 0.05, 0.52, 2);
  const sensorVisor = createBoxMesh(0.18, -0.22, 0.18, 0.34, 0.22, 0.3, 3); // accent cyan
  const antenna = createBoxMesh(-0.25, 0.18, 0.38, -0.22, 0.21, 0.85, 3);
  const turretMesh = mergeMeshes([turretBase, cupola, sensorVisor, antenna]);

  // Barrel
  const mantlet = createBoxMesh(-0.08, -0.12, -0.1, 0.12, 0.12, 0.1, 4);
  const cannon = createBoxMesh(0.12, -0.05, -0.05, 0.85, 0.05, 0.05, 4);
  const muzzle = createBoxMesh(0.85, -0.07, -0.07, 0.98, 0.07, 0.07, 3);
  const barrelMesh = mergeMeshes([mantlet, cannon, muzzle]);

  return {
    kind: "tank",
    nodes: [
      { name: "chassis", pivot: [0, 0, 0], mesh: chassisMesh },
      { name: "turret", parent: "chassis", pivot: [0, 0, 0.55], mesh: turretMesh },
      { name: "barrel", parent: "turret", pivot: [0.32, 0, 0.18], mesh: barrelMesh },
    ],
  };
}

export function buildHarvesterModel(): UnitModel {
  // Chassis
  const mainCab = createBoxMesh(-0.6, -0.32, 0.15, 0.5, 0.32, 0.5, 1);
  const operatorCab = createBoxMesh(0.1, -0.3, 0.48, 0.52, 0.3, 0.95, 1);
  const windshield = createBoxMesh(0.32, -0.26, 0.52, 0.54, 0.26, 0.9, 3); // accent glass
  const hazardBeacon = createBoxMesh(0.18, -0.08, 0.95, 0.32, 0.08, 1.08, 3);
  const sideTanks = createBoxMesh(-0.45, 0.32, 0.48, 0.05, 0.44, 0.75, 2);
  const sideTanksR = createBoxMesh(-0.45, -0.44, 0.48, 0.05, -0.32, 0.75, 2);
  const cargoHopper = createBoxMesh(-0.72, -0.34, 0.35, 0.05, 0.34, 0.85, 4);
  const leftTrack = createBoxMesh(-0.65, 0.32, 0.0, 0.55, 0.48, 0.48, 4);
  const rightTrack = createBoxMesh(-0.65, -0.48, 0.0, 0.55, -0.32, 0.48, 4);
  const chassisMesh = mergeMeshes([
    mainCab, operatorCab, windshield, hazardBeacon, sideTanks, sideTanksR, cargoHopper, leftTrack, rightTrack,
  ]);

  // Scoop
  const scoopArmL = createBoxMesh(0.0, 0.28, -0.08, 0.45, 0.38, 0.1, 2);
  const scoopArmR = createBoxMesh(0.0, -0.38, -0.08, 0.45, -0.28, 0.1, 2);
  const bucket = createBoxMesh(0.45, -0.44, -0.22, 0.82, 0.44, 0.28, 4);
  const teeth = createBoxMesh(0.82, -0.42, -0.22, 0.95, 0.42, -0.08, 3);
  const scoopMesh = mergeMeshes([scoopArmL, scoopArmR, bucket, teeth]);

  return {
    kind: "harvester",
    nodes: [
      { name: "chassis", pivot: [0, 0, 0], mesh: chassisMesh },
      { name: "scoop", parent: "chassis", pivot: [0.48, 0, 0.25], mesh: scoopMesh },
    ],
  };
}

export function buildInfantryModel(): UnitModel {
  // Torso / Head / Arms / Rifle
  const torso = createBoxMesh(-0.14, -0.18, 0.0, 0.14, 0.18, 0.45, 1);
  const pauldrons = createBoxMesh(-0.16, -0.22, 0.25, 0.16, 0.22, 0.45, 2);
  const head = createBoxMesh(-0.12, -0.12, 0.45, 0.12, 0.12, 0.72, 2);
  const visor = createBoxMesh(0.06, -0.1, 0.52, 0.14, 0.1, 0.65, 3);
  const backpack = createBoxMesh(-0.24, -0.14, 0.12, -0.14, 0.14, 0.55, 4);
  const rifle = createBoxMesh(0.08, -0.08, 0.15, 0.55, 0.08, 0.28, 4);
  const muzzle = createBoxMesh(0.55, -0.04, 0.18, 0.62, 0.04, 0.25, 3);
  const torsoMesh = mergeMeshes([torso, pauldrons, head, visor, backpack, rifle, muzzle]);

  // Left Leg
  const legL = createBoxMesh(-0.1, -0.08, -0.42, 0.1, 0.08, 0.0, 4);
  const bootL = createBoxMesh(-0.11, -0.09, -0.7, 0.15, 0.09, -0.42, 2);
  const legLMesh = mergeMeshes([legL, bootL]);

  // Right Leg
  const legR = createBoxMesh(-0.1, -0.08, -0.42, 0.1, 0.08, 0.0, 4);
  const bootR = createBoxMesh(-0.11, -0.09, -0.7, 0.15, 0.09, -0.42, 2);
  const legRMesh = mergeMeshes([legR, bootR]);

  return {
    kind: "infantry",
    nodes: [
      { name: "torso", pivot: [0, 0, 0.7], mesh: torsoMesh },
      { name: "legL", parent: "torso", pivot: [0, 0.12, 0.0], mesh: legLMesh },
      { name: "legR", parent: "torso", pivot: [0, -0.12, 0.0], mesh: legRMesh },
    ],
  };
}

export function buildAntiArmorModel(): UnitModel {
  // Heavy Exo-Torso / Helmet
  const torso = createBoxMesh(-0.18, -0.24, 0.0, 0.18, 0.24, 0.55, 1);
  const pauldrons = createBoxMesh(-0.16, -0.32, 0.25, 0.16, 0.32, 0.55, 2);
  const head = createBoxMesh(-0.14, -0.14, 0.55, 0.14, 0.14, 0.85, 2);
  const heavyVisor = createBoxMesh(0.08, -0.12, 0.62, 0.16, 0.12, 0.75, 3);
  const missilePack = createBoxMesh(-0.28, -0.22, 0.18, -0.18, 0.22, 0.65, 4);
  const launcherTubes = createBoxMesh(-0.28, 0.16, 0.48, 0.32, 0.36, 0.82, 4);
  const rocketTips = createBoxMesh(0.32, 0.18, 0.52, 0.38, 0.34, 0.78, 3);
  const torsoMesh = mergeMeshes([
    torso, pauldrons, head, heavyVisor, missilePack, launcherTubes, rocketTips,
  ]);

  // Heavy Left Leg
  const legL = createBoxMesh(-0.12, -0.1, -0.45, 0.12, 0.1, 0.0, 4);
  const armorPlateL = createBoxMesh(0.04, -0.11, -0.35, 0.15, 0.11, -0.12, 1);
  const bootL = createBoxMesh(-0.13, -0.11, -0.75, 0.18, 0.11, -0.45, 2);
  const legLMesh = mergeMeshes([legL, armorPlateL, bootL]);

  // Heavy Right Leg
  const legR = createBoxMesh(-0.12, -0.1, -0.45, 0.12, 0.1, 0.0, 4);
  const armorPlateR = createBoxMesh(0.04, -0.11, -0.35, 0.15, 0.11, -0.12, 1);
  const bootR = createBoxMesh(-0.13, -0.11, -0.75, 0.18, 0.11, -0.45, 2);
  const legRMesh = mergeMeshes([legR, armorPlateR, bootR]);

  return {
    kind: "antiArmor",
    nodes: [
      { name: "torso", pivot: [0, 0, 0.75], mesh: torsoMesh },
      { name: "legL", parent: "torso", pivot: [0, 0.16, 0.0], mesh: legLMesh },
      { name: "legR", parent: "torso", pivot: [0, -0.16, 0.0], mesh: legRMesh },
    ],
  };
}

export function buildTurretHeadModel(): UnitModel {
  // 1. Azimuth Turntable Collar & Bearing Base
  const bearingMount = createCylinderMesh(0, 0, -0.10, 0.02, 0.38, 0.35, 12, 4);
  const bearingTeeth = createCylinderMesh(0, 0, -0.04, 0.04, 0.36, 0.33, 8, 2);

  // 2. Main Armored Hull (Faceted 8-sided hull with sloped glacis)
  const hullFaceted = createPolygonPrismMesh(
    [
      [-0.38, -0.26],
      [0.15, -0.32],
      [0.38, -0.16],
      [0.38, 0.16],
      [0.15, 0.32],
      [-0.38, 0.26],
      [-0.42, 0.16],
      [-0.42, -0.16],
    ],
    0.0,
    0.32,
    1,
  );

  // Sloped upper superstructure deck
  const upperDeck = createTrapezoidMesh(
    -0.32, -0.22,
    -0.26, -0.18,
    0.28, 0.22,
    0.22, 0.18,
    0.30, 0.42,
    1,
  );

  // Sloped front cheek deflectors
  const frontCheekL = createTrapezoidMesh(
    0.12, 0.20,
    0.15, 0.16,
    0.36, 0.28,
    0.32, 0.18,
    0.06, 0.34,
    2,
  );
  const frontCheekR = createTrapezoidMesh(
    0.12, -0.28,
    0.15, -0.18,
    0.36, -0.20,
    0.32, -0.16,
    0.06, 0.34,
    2,
  );

  // Side composite armor pods
  const sideArmorL = createTrapezoidMesh(
    -0.30, 0.26,
    -0.26, 0.24,
    0.16, 0.36,
    0.12, 0.32,
    0.06, 0.32,
    2,
  );
  const sideArmorR = createTrapezoidMesh(
    -0.30, -0.36,
    -0.26, -0.32,
    0.16, -0.26,
    0.12, -0.24,
    0.06, 0.32,
    2,
  );

  // Side energy conduits with glowing cyan strips
  const sideConduitL = createBoxMesh(-0.08, 0.32, 0.16, 0.08, 0.37, 0.22, 3);
  const sideConduitR = createBoxMesh(-0.08, -0.37, 0.16, 0.08, -0.32, 0.22, 3);

  // Commander observation cupola dome
  const cupolaBase = createCylinderMesh(-0.10, 0.10, 0.40, 0.50, 0.11, 0.08, 8, 1);
  const cupolaVisor = createCylinderMesh(-0.10, 0.10, 0.44, 0.48, 0.115, 0.115, 8, 4);
  const cupolaOptic = createBoxMesh(-0.05, 0.06, 0.44, 0.02, 0.14, 0.48, 3);

  // Rear bustle ammo magazine & thermal radiator grilles
  const rearAmmoBustle = createTrapezoidMesh(
    -0.46, -0.20,
    -0.42, -0.18,
    -0.34, 0.20,
    -0.32, 0.18,
    0.08, 0.36,
    4,
  );
  const rearRadiatorGrille = createBoxMesh(-0.47, -0.14, 0.18, -0.45, 0.14, 0.30, 5);

  // Tactical optical targeting sensors
  const mainTargetVisor = createBoxMesh(0.32, -0.14, 0.18, 0.40, 0.14, 0.28, 3);
  const topRangefinderVisor = createBoxMesh(0.18, -0.10, 0.38, 0.26, 0.10, 0.44, 3);

  // Comms antenna mast with illuminated beacon
  const antennaBase = createCylinderMesh(-0.24, -0.14, 0.38, 0.46, 0.035, 0.025, 6, 4);
  const antennaMast = createCylinderMesh(-0.24, -0.14, 0.46, 0.88, 0.018, 0.010, 4, 4);
  const antennaTip = createBoxMesh(-0.255, -0.155, 0.88, -0.225, -0.125, 0.94, 3);

  const headMesh = mergeMeshes([
    bearingMount,
    bearingTeeth,
    hullFaceted,
    upperDeck,
    frontCheekL,
    frontCheekR,
    sideArmorL,
    sideArmorR,
    sideConduitL,
    sideConduitR,
    cupolaBase,
    cupolaVisor,
    cupolaOptic,
    rearAmmoBustle,
    rearRadiatorGrille,
    mainTargetVisor,
    topRangefinderVisor,
    antennaBase,
    antennaMast,
    antennaTip,
  ]);

  // 3. Heavy Twin Autocannon Weapon Assembly
  // Mantlet & recoil cradle
  const mantletBase = createTrapezoidMesh(
    0.28, -0.18,
    0.30, -0.16,
    0.48, 0.18,
    0.46, 0.16,
    0.08, 0.32,
    4,
  );
  const mantletPlate = createTrapezoidMesh(
    0.36, -0.16,
    0.38, -0.14,
    0.49, 0.16,
    0.47, 0.14,
    0.14, 0.30,
    2,
  );

  // Recoil hydraulic damper pistons
  const pistonL = createCylinderXMesh(0.24, 0.48, 0.13, 0.14, 0.025, 0.025, 6, 7);
  const pistonR = createCylinderXMesh(0.24, 0.48, -0.13, 0.14, 0.025, 0.025, 6, 7);

  // Twin Cannon Barrels (Left: y = +0.09, Right: y = -0.09, z = 0.20)
  // Left Barrel
  const barrelSleeveL = createCylinderXMesh(0.46, 0.80, 0.09, 0.20, 0.062, 0.056, 8, 4);
  const barrelTubeL = createCylinderXMesh(0.80, 1.20, 0.09, 0.20, 0.046, 0.042, 8, 4);
  const gasPortL = createCylinderXMesh(0.92, 0.98, 0.09, 0.20, 0.054, 0.054, 8, 5);
  const muzzleBrakeL = createCylinderXMesh(1.20, 1.36, 0.09, 0.20, 0.064, 0.058, 8, 4);
  const muzzleVentsL = createCylinderXMesh(1.24, 1.32, 0.09, 0.20, 0.068, 0.068, 8, 5);
  const boreL = createCylinderXMesh(1.35, 1.37, 0.09, 0.20, 0.032, 0.032, 8, 4, true, false);

  // Right Barrel
  const barrelSleeveR = createCylinderXMesh(0.46, 0.80, -0.09, 0.20, 0.062, 0.056, 8, 4);
  const barrelTubeR = createCylinderXMesh(0.80, 1.20, -0.09, 0.20, 0.046, 0.042, 8, 4);
  const gasPortR = createCylinderXMesh(0.92, 0.98, -0.09, 0.20, 0.054, 0.054, 8, 5);
  const muzzleBrakeR = createCylinderXMesh(1.20, 1.36, -0.09, 0.20, 0.064, 0.058, 8, 4);
  const muzzleVentsR = createCylinderXMesh(1.24, 1.32, -0.09, 0.20, 0.068, 0.068, 8, 5);
  const boreR = createCylinderXMesh(1.35, 1.37, -0.09, 0.20, 0.032, 0.032, 8, 4, true, false);

  // Central Barrel Brace & Laser Rangefinder Optic
  const barrelBrace = createBoxMesh(0.52, -0.04, 0.17, 0.82, 0.04, 0.23, 4);
  const rangefinderOptic = createCylinderXMesh(0.82, 0.94, 0.0, 0.20, 0.030, 0.030, 6, 3);

  const barrelMesh = mergeMeshes([
    mantletBase,
    mantletPlate,
    pistonL,
    pistonR,
    barrelSleeveL,
    barrelTubeL,
    gasPortL,
    muzzleBrakeL,
    muzzleVentsL,
    boreL,
    barrelSleeveR,
    barrelTubeR,
    gasPortR,
    muzzleBrakeR,
    muzzleVentsR,
    boreR,
    barrelBrace,
    rangefinderOptic,
  ]);

  return {
    kind: "turret",
    nodes: [
      { name: "turretHead", pivot: [0, 0, 0], mesh: headMesh },
      { name: "barrel", parent: "turretHead", pivot: [0.35, 0, 0.20], mesh: barrelMesh },
    ],
  };
}

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

/** Wavefront OBJ parser supporting named objects/groups ('o' or 'g') with positions and normals. */
export function parseObjModel(text: string, kind: ModelKind): UnitModel {
  return parseObjModelData(text, kind, buildUnitModel);
}
