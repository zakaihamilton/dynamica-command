import { describe, expect, it } from "vitest";
import {
  buildAntiArmorModel,
  buildHarvesterModel,
  buildInfantryModel,
  buildTankModel,
  buildTurretHeadModel,
  buildUnitModel,
  createBoxMesh,
  mergeMeshes,
  parseObjModel,
} from "../lib/render/gl/modelLoader";

describe("modelLoader 3D meshes and parser", () => {
  it("creates box meshes with proper vertex and index counts", () => {
    const box = createBoxMesh(-1, -1, -1, 1, 1, 1, 1);
    // 6 faces * 4 vertices = 24 vertices
    expect(box.positions.length).toBe(24 * 3);
    expect(box.normals.length).toBe(24 * 3);
    expect(box.masks.length).toBe(24);
    // 6 faces * 2 triangles * 3 indices = 36 indices
    expect(box.indices.length).toBe(36);
  });

  it("merges multiple meshes into a unified buffer", () => {
    const boxA = createBoxMesh(0, 0, 0, 1, 1, 1, 1);
    const boxB = createBoxMesh(2, 2, 2, 3, 3, 3, 2);
    const merged = mergeMeshes([boxA, boxB]);

    expect(merged.positions.length).toBe(48 * 3);
    expect(merged.indices.length).toBe(72);
  });

  it("builds all models with distinct hierarchical nodes", () => {
    const tank = buildTankModel();
    expect(tank.kind).toBe("tank");
    expect(tank.nodes.map((n) => n.name)).toEqual(["chassis", "turret", "barrel"]);

    const harvester = buildHarvesterModel();
    expect(harvester.kind).toBe("harvester");
    expect(harvester.nodes.map((n) => n.name)).toEqual(["chassis", "scoop"]);

    const infantry = buildInfantryModel();
    expect(infantry.kind).toBe("infantry");
    expect(infantry.nodes.map((n) => n.name)).toEqual(["torso", "legL", "legR"]);

    const antiArmor = buildAntiArmorModel();
    expect(antiArmor.kind).toBe("antiArmor");
    expect(antiArmor.nodes.map((n) => n.name)).toEqual(["torso", "legL", "legR"]);

    const turret = buildTurretHeadModel();
    expect(turret.kind).toBe("turret");
    expect(turret.nodes.map((n) => n.name)).toEqual(["turretHead", "barrel"]);
  });

  it("parses Wavefront OBJ models with object groups and material mapping", () => {
    const objText = `
      o body
      usemtl primary
      v 0 0 0
      v 1 0 0
      v 1 1 0
      v 0 1 0
      vn 0 0 1
      f 1//1 2//1 3//1
      f 1//1 3//1 4//1
    `;
    const parsed = parseObjModel(objText, "tank");
    expect(parsed.kind).toBe("tank");
    expect(parsed.nodes.length).toBe(1);
    expect(parsed.nodes[0]!.name).toBe("body");
    expect(parsed.nodes[0]!.mesh.positions.length).toBe(6 * 3);
    expect(parsed.nodes[0]!.mesh.masks[0]).toBe(1); // primary material
  });

  it("dispatches kind to correct model builder", () => {
    expect(buildUnitModel("tank").nodes.length).toBeGreaterThan(1);
    expect(buildUnitModel("harvester").nodes.length).toBeGreaterThan(1);
    expect(buildUnitModel("infantry").nodes.length).toBeGreaterThan(1);
    expect(buildUnitModel("antiArmor").nodes.length).toBeGreaterThan(1);
    expect(buildUnitModel("turret").nodes.length).toBeGreaterThan(1);
  });
});
