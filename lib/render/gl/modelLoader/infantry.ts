import { createBoxMesh, mergeMeshes } from "../meshPrimitives";
import type { UnitModel } from "./types";

export function buildInfantryModel(): UnitModel {
  const torso = createBoxMesh(-0.14, -0.18, 0.0, 0.14, 0.18, 0.45, 1);
  const pauldrons = createBoxMesh(-0.16, -0.22, 0.25, 0.16, 0.22, 0.45, 2);
  const head = createBoxMesh(-0.12, -0.12, 0.45, 0.12, 0.12, 0.72, 2);
  const visor = createBoxMesh(0.06, -0.1, 0.52, 0.14, 0.1, 0.65, 3);
  const backpack = createBoxMesh(-0.24, -0.14, 0.12, -0.14, 0.14, 0.55, 4);
  const rifle = createBoxMesh(0.08, -0.08, 0.15, 0.55, 0.08, 0.28, 4);
  const muzzle = createBoxMesh(0.55, -0.04, 0.18, 0.62, 0.04, 0.25, 3);
  const torsoMesh = mergeMeshes([torso, pauldrons, head, visor, backpack, rifle, muzzle]);

  const legL = createBoxMesh(-0.1, -0.08, -0.42, 0.1, 0.08, 0.0, 4);
  const bootL = createBoxMesh(-0.11, -0.09, -0.7, 0.15, 0.09, -0.42, 2);
  const legLMesh = mergeMeshes([legL, bootL]);

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
