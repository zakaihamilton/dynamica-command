import type { UnitKind } from "../../types";

export type ModelKind = UnitKind | "turret" | "turretHead";

export type MeshData = {
  positions: Float32Array;
  normals: Float32Array;
  masks: Float32Array;
  indices: Uint16Array;
};

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

export type GpuMesh = {
  posBuffer: WebGLBuffer;
  normBuffer: WebGLBuffer;
  maskBuffer: WebGLBuffer;
  idxBuffer: WebGLBuffer;
  indexCount: number;
};

export type GpuModelNode = {
  name: string;
  parent?: string;
  pivot: [number, number, number];
  gpuMesh: GpuMesh;
};

export type GpuUnitModel = {
  kind: ModelKind;
  nodes: GpuModelNode[];
};

/** Helper to construct a 3D box mesh with vertex normals and palette mask */
export function createBoxMesh(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  mask = 0,
): MeshData {
  // 6 faces * 4 vertices = 24 vertices
  const p: number[] = [];
  const n: number[] = [];
  const m: number[] = [];
  const idx: number[] = [];

  function addQuad(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    norm: [number, number, number],
  ) {
    const baseIdx = p.length / 3;
    p.push(...p0, ...p1, ...p2, ...p3);
    n.push(...norm, ...norm, ...norm, ...norm);
    m.push(mask, mask, mask, mask);
    idx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
  }

  // +Z (top)
  addQuad([minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ], [0, 0, 1]);
  // -Z (bottom)
  addQuad([minX, maxY, minZ], [maxX, maxY, minZ], [maxX, minY, minZ], [minX, minY, minZ], [0, 0, -1]);
  // +X (front)
  addQuad([maxX, minY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ], [maxX, minY, maxZ], [1, 0, 0]);
  // -X (back)
  addQuad([minX, minY, maxZ], [minX, maxY, maxZ], [minX, maxY, minZ], [minX, minY, minZ], [-1, 0, 0]);
  // +Y (left)
  addQuad([minX, maxY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ], [minX, maxY, maxZ], [0, 1, 0]);
  // -Y (right)
  addQuad([minX, minY, maxZ], [maxX, minY, maxZ], [maxX, minY, minZ], [minX, minY, minZ], [0, -1, 0]);

  return {
    positions: new Float32Array(p),
    normals: new Float32Array(n),
    masks: new Float32Array(m),
    indices: new Uint16Array(idx),
  };
}

export function mergeMeshes(meshes: MeshData[]): MeshData {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const m of meshes) {
    totalVerts += m.positions.length / 3;
    totalIndices += m.indices.length;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const masks = new Float32Array(totalVerts);
  const indices = new Uint16Array(totalIndices);

  let vertOffset = 0;
  let idxOffset = 0;

  for (const m of meshes) {
    positions.set(m.positions, vertOffset * 3);
    normals.set(m.normals, vertOffset * 3);
    masks.set(m.masks, vertOffset);
    for (let i = 0; i < m.indices.length; i++) {
      indices[idxOffset + i] = m.indices[i]! + vertOffset;
    }
    vertOffset += m.positions.length / 3;
    idxOffset += m.indices.length;
  }

  return { positions, normals, masks, indices };
}

// -------------------------------------------------------------
// Built-in Low-Poly 3D Unit Models
// -------------------------------------------------------------

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
  // Main armored housing
  const mainHull = createBoxMesh(-0.35, -0.32, 0.0, 0.35, 0.32, 0.42, 1);
  const sideArmorL = createBoxMesh(-0.28, 0.32, 0.08, 0.28, 0.45, 0.36, 2);
  const sideArmorR = createBoxMesh(-0.28, -0.45, 0.08, 0.28, -0.32, 0.36, 2);
  const sensorVisor = createBoxMesh(0.24, -0.18, 0.20, 0.38, 0.18, 0.34, 3); // accent cyan
  const rearExhaust = createBoxMesh(-0.44, -0.24, 0.10, -0.35, 0.24, 0.36, 4);
  const antenna = createBoxMesh(-0.24, 0.18, 0.42, -0.21, 0.21, 0.88, 3);
  const bearingMount = createBoxMesh(-0.28, -0.28, -0.08, 0.28, 0.28, 0.0, 4);
  const headMesh = mergeMeshes([
    mainHull, sideArmorL, sideArmorR, sensorVisor, rearExhaust, antenna, bearingMount,
  ]);

  // Barrel assembly
  const mantlet = createBoxMesh(0.29, -0.12, 0.10, 0.47, 0.12, 0.30, 4);
  const cannon = createBoxMesh(0.47, -0.07, 0.13, 1.17, 0.07, 0.27, 4);
  const muzzle = createBoxMesh(1.17, -0.10, 0.10, 1.31, 0.10, 0.30, 3);
  const barrelMesh = mergeMeshes([mantlet, cannon, muzzle]);

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
    case "turret":
    case "turretHead": return buildTurretHeadModel();
  }
}

export function uploadGpuModel(gl: WebGLRenderingContext, model: UnitModel): GpuUnitModel {
  const gpuNodes: GpuModelNode[] = [];
  for (const node of model.nodes) {
    const posBuffer = gl.createBuffer();
    if (!posBuffer) throw new Error("Failed to create WebGL position buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, node.mesh.positions, gl.STATIC_DRAW);

    const normBuffer = gl.createBuffer();
    if (!normBuffer) throw new Error("Failed to create WebGL normal buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, node.mesh.normals, gl.STATIC_DRAW);

    const maskBuffer = gl.createBuffer();
    if (!maskBuffer) throw new Error("Failed to create WebGL mask buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, maskBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, node.mesh.masks, gl.STATIC_DRAW);

    const idxBuffer = gl.createBuffer();
    if (!idxBuffer) throw new Error("Failed to create WebGL index buffer");
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, node.mesh.indices, gl.STATIC_DRAW);

    gpuNodes.push({
      name: node.name,
      parent: node.parent,
      pivot: node.pivot,
      gpuMesh: {
        posBuffer,
        normBuffer,
        maskBuffer,
        idxBuffer,
        indexCount: node.mesh.indices.length,
      },
    });
  }

  return { kind: model.kind, nodes: gpuNodes };
}

/** Wavefront OBJ parser supporting named objects/groups ('o' or 'g') with positions and normals */
export function parseObjModel(text: string, kind: ModelKind): UnitModel {
  const lines = text.split(/\r?\n/);
  const globalPositions: [number, number, number][] = [];
  const globalNormals: [number, number, number][] = [];

  type RawGroup = {
    name: string;
    pos: number[];
    norm: number[];
    mask: number[];
    indices: number[];
  };

  const groups: RawGroup[] = [];
  let currentGroup: RawGroup = {
    name: "main",
    pos: [],
    norm: [],
    mask: [],
    indices: [],
  };

  let currentMask = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    const tag = parts[0];

    if (tag === "v" && parts.length >= 4) {
      globalPositions.push([
        parseFloat(parts[1]!),
        parseFloat(parts[2]!),
        parseFloat(parts[3]!),
      ]);
    } else if (tag === "vn" && parts.length >= 4) {
      globalNormals.push([
        parseFloat(parts[1]!),
        parseFloat(parts[2]!),
        parseFloat(parts[3]!),
      ]);
    } else if (tag === "o" || tag === "g") {
      if (currentGroup.indices.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = {
        name: parts[1] || `node_${groups.length}`,
        pos: [],
        norm: [],
        mask: [],
        indices: [],
      };
    } else if (tag === "usemtl") {
      const mat = parts[1]?.toLowerCase() || "";
      if (mat.includes("primary") || mat.includes("team")) currentMask = 1;
      else if (mat.includes("secondary")) currentMask = 2;
      else if (mat.includes("accent") || mat.includes("glass") || mat.includes("glow")) currentMask = 3;
      else if (mat.includes("dark") || mat.includes("track")) currentMask = 4;
      else currentMask = 0;
    } else if (tag === "f" && parts.length >= 4) {
      // Triangulate faces
      const faceVerts: { p: [number, number, number]; n: [number, number, number] }[] = [];
      for (let i = 1; i < parts.length; i++) {
        const segs = parts[i]!.split("/");
        const pi = parseInt(segs[0]!, 10) - 1;
        const ni = segs.length >= 3 && segs[2] ? parseInt(segs[2]!, 10) - 1 : -1;
        const p = globalPositions[pi] || ([0, 0, 0] as [number, number, number]);
        const n = ni >= 0 && globalNormals[ni] ? globalNormals[ni]! : ([0, 0, 1] as [number, number, number]);
        faceVerts.push({ p, n });
      }
      for (let i = 1; i < faceVerts.length - 1; i++) {
        const v0 = faceVerts[0]!;
        const v1 = faceVerts[i]!;
        const v2 = faceVerts[i + 1]!;
        const baseIdx = currentGroup.pos.length / 3;
        currentGroup.pos.push(...v0.p, ...v1.p, ...v2.p);
        currentGroup.norm.push(...v0.n, ...v1.n, ...v2.n);
        currentGroup.mask.push(currentMask, currentMask, currentMask);
        currentGroup.indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      }
    }
  }

  if (currentGroup.indices.length > 0) {
    groups.push(currentGroup);
  }

  if (groups.length === 0) {
    return buildUnitModel(kind);
  }

  const nodes: ModelNode[] = groups.map((g) => ({
    name: g.name,
    pivot: [0, 0, 0],
    mesh: {
      positions: new Float32Array(g.pos),
      normals: new Float32Array(g.norm),
      masks: new Float32Array(g.mask),
      indices: new Uint16Array(g.indices),
    },
  }));

  return { kind, nodes };
}

export async function loadObjModelAsync(gl: WebGLRenderingContext, kind: ModelKind): Promise<GpuUnitModel> {
  const filename = kind === "antiArmor" ? "anti-armor.obj" : kind === "turretHead" ? "turret-head.obj" : `${kind}.obj`;
  try {
    const res = await fetch(`/art/models/${filename}`);
    if (res.ok) {
      const text = await res.text();
      const model = parseObjModel(text, kind);
      return uploadGpuModel(gl, model);
    }
  } catch {
    // Fallback to built-in procedural model
  }
  return uploadGpuModel(gl, buildUnitModel(kind));
}
