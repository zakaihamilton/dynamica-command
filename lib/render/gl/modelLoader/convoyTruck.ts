import { createBoxMesh, mergeMeshes } from "../meshPrimitives";
import type { UnitModel } from "./types";

/** A simple no-weapon preview model for scenario convoy cargo. */
export function buildConvoyTruckModel(): UnitModel {
  const frame = createBoxMesh(-0.72, -0.3, 0.14, 0.68, 0.3, 0.36, 1);
  const leftWheels = createBoxMesh(-0.58, 0.3, 0.0, 0.56, 0.46, 0.38, 4);
  const rightWheels = createBoxMesh(-0.58, -0.46, 0.0, 0.56, -0.3, 0.38, 4);
  const chassisMesh = mergeMeshes([frame, leftWheels, rightWheels]);

  const cabBody = createBoxMesh(0.02, -0.27, 0.32, 0.62, 0.27, 0.82, 1);
  const cabRoof = createBoxMesh(0.08, -0.25, 0.82, 0.58, 0.25, 0.95, 2);
  const windshield = createBoxMesh(0.56, -0.22, 0.46, 0.64, 0.22, 0.75, 3);
  const cabMesh = mergeMeshes([cabBody, cabRoof, windshield]);

  const cargoShell = createBoxMesh(-0.68, -0.28, 0.34, 0.02, 0.28, 1.0, 2);
  const cargoRoof = createBoxMesh(-0.73, -0.31, 0.98, 0.06, 0.31, 1.08, 1);
  const cargoMesh = mergeMeshes([cargoShell, cargoRoof]);

  return {
    kind: "convoyTruck",
    nodes: [
      { name: "chassis", pivot: [0, 0, 0], mesh: chassisMesh },
      { name: "cab", parent: "chassis", pivot: [0.25, 0, 0.36], mesh: cabMesh },
      { name: "cargo", parent: "chassis", pivot: [-0.35, 0, 0.36], mesh: cargoMesh },
    ],
  };
}
