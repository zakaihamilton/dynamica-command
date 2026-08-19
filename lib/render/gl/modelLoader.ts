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

export function computeNormal(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
): [number, number, number] {
  const ax = p1[0] - p0[0];
  const ay = p1[1] - p0[1];
  const az = p1[2] - p0[2];
  const bx = p2[0] - p0[0];
  const by = p2[1] - p0[1];
  const bz = p2[2] - p0[2];
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  const len = Math.hypot(cx, cy, cz) || 1;
  return [cx / len, cy / len, cz / len];
}

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

/** Construct a tapered / sloped 6-sided trapezoid box with distinct top and bottom bounds */
export function createTrapezoidMesh(
  bMinX: number,
  bMinY: number,
  tMinX: number,
  tMinY: number,
  bMaxX: number,
  bMaxY: number,
  tMaxX: number,
  tMaxY: number,
  minZ: number,
  maxZ: number,
  mask = 0,
): MeshData {
  const p: number[] = [];
  const n: number[] = [];
  const m: number[] = [];
  const idx: number[] = [];

  function addQuad(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
  ) {
    const baseIdx = p.length / 3;
    const norm = computeNormal(p0, p1, p2);
    p.push(...p0, ...p1, ...p2, ...p3);
    n.push(...norm, ...norm, ...norm, ...norm);
    m.push(mask, mask, mask, mask);
    idx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
  }

  // +Z (top)
  addQuad([tMinX, tMinY, maxZ], [tMaxX, tMinY, maxZ], [tMaxX, tMaxY, maxZ], [tMinX, tMaxY, maxZ]);
  // -Z (bottom)
  addQuad([bMinX, bMaxY, minZ], [bMaxX, bMaxY, minZ], [bMaxX, bMinY, minZ], [bMinX, bMinY, minZ]);
  // +X (front)
  addQuad([bMaxX, bMinY, minZ], [bMaxX, bMaxY, minZ], [tMaxX, tMaxY, maxZ], [tMaxX, tMinY, maxZ]);
  // -X (back)
  addQuad([bMinX, bMinY, minZ], [tMinX, tMinY, maxZ], [tMinX, tMaxY, maxZ], [bMinX, bMaxY, minZ]);
  // +Y (left)
  addQuad([bMinX, bMaxY, minZ], [tMinX, tMaxY, maxZ], [tMaxX, tMaxY, maxZ], [bMaxX, bMaxY, minZ]);
  // -Y (right)
  addQuad([bMinX, bMinY, minZ], [bMaxX, bMinY, minZ], [tMaxX, tMinY, maxZ], [tMinX, tMinY, maxZ]);

  return {
    positions: new Float32Array(p),
    normals: new Float32Array(n),
    masks: new Float32Array(m),
    indices: new Uint16Array(idx),
  };
}

/** Construct a cylinder or truncated cone aligned along Z axis (for azimuth bearings, cupolas, collars) */
export function createCylinderMesh(
  cx: number,
  cy: number,
  minZ: number,
  maxZ: number,
  rBot: number,
  rTop: number,
  segments = 8,
  mask = 0,
  capTop = true,
  capBottom = true,
): MeshData {
  const p: number[] = [];
  const n: number[] = [];
  const m: number[] = [];
  const idx: number[] = [];

  const dz = Math.max(0.0001, maxZ - minZ);
  const dr = rBot - rTop;

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const midA = (a0 + a1) * 0.5;

    const nx = Math.cos(midA);
    const ny = Math.sin(midA);
    const nz = dr / dz;
    const len = Math.hypot(nx, ny, nz) || 1;
    const norm: [number, number, number] = [nx / len, ny / len, nz / len];

    const p0: [number, number, number] = [cx + rBot * Math.cos(a0), cy + rBot * Math.sin(a0), minZ];
    const p1: [number, number, number] = [cx + rBot * Math.cos(a1), cy + rBot * Math.sin(a1), minZ];
    const p2: [number, number, number] = [cx + rTop * Math.cos(a1), cy + rTop * Math.sin(a1), maxZ];
    const p3: [number, number, number] = [cx + rTop * Math.cos(a0), cy + rTop * Math.sin(a0), maxZ];

    const baseIdx = p.length / 3;
    p.push(...p0, ...p1, ...p2, ...p3);
    n.push(...norm, ...norm, ...norm, ...norm);
    m.push(mask, mask, mask, mask);
    idx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
  }

  // Cap Top
  if (capTop) {
    const centerIdx = p.length / 3;
    p.push(cx, cy, maxZ);
    n.push(0, 0, 1);
    m.push(mask);

    const ringStart = p.length / 3;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      p.push(cx + rTop * Math.cos(a), cy + rTop * Math.sin(a), maxZ);
      n.push(0, 0, 1);
      m.push(mask);
    }

    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      idx.push(centerIdx, ringStart + i, ringStart + next);
    }
  }

  // Cap Bottom
  if (capBottom) {
    const centerIdx = p.length / 3;
    p.push(cx, cy, minZ);
    n.push(0, 0, -1);
    m.push(mask);

    const ringStart = p.length / 3;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      p.push(cx + rBot * Math.cos(a), cy + rBot * Math.sin(a), minZ);
      n.push(0, 0, -1);
      m.push(mask);
    }

    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      idx.push(centerIdx, ringStart + next, ringStart + i);
    }
  }

  return {
    positions: new Float32Array(p),
    normals: new Float32Array(n),
    masks: new Float32Array(m),
    indices: new Uint16Array(idx),
  };
}

/** Construct a cylinder or truncated cone aligned along X axis (for cannon barrels, muzzles, recoil pistons) */
export function createCylinderXMesh(
  minX: number,
  maxX: number,
  cy: number,
  cz: number,
  rBack: number,
  rFront: number,
  segments = 8,
  mask = 0,
  capFront = true,
  capBack = true,
): MeshData {
  const p: number[] = [];
  const n: number[] = [];
  const m: number[] = [];
  const idx: number[] = [];

  const dx = Math.max(0.0001, maxX - minX);
  const dr = rBack - rFront;

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const midA = (a0 + a1) * 0.5;

    const nx = dr / dx;
    const ny = Math.cos(midA);
    const nz = Math.sin(midA);
    const len = Math.hypot(nx, ny, nz) || 1;
    const norm: [number, number, number] = [nx / len, ny / len, nz / len];

    const p0: [number, number, number] = [minX, cy + rBack * Math.cos(a0), cz + rBack * Math.sin(a0)];
    const p1: [number, number, number] = [minX, cy + rBack * Math.cos(a1), cz + rBack * Math.sin(a1)];
    const p2: [number, number, number] = [maxX, cy + rFront * Math.cos(a1), cz + rFront * Math.sin(a1)];
    const p3: [number, number, number] = [maxX, cy + rFront * Math.cos(a0), cz + rFront * Math.sin(a0)];

    const baseIdx = p.length / 3;
    p.push(...p0, ...p1, ...p2, ...p3);
    n.push(...norm, ...norm, ...norm, ...norm);
    m.push(mask, mask, mask, mask);
    idx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
  }

  // Cap Front (+X)
  if (capFront) {
    const centerIdx = p.length / 3;
    p.push(maxX, cy, cz);
    n.push(1, 0, 0);
    m.push(mask);

    const ringStart = p.length / 3;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      p.push(maxX, cy + rFront * Math.cos(a), cz + rFront * Math.sin(a));
      n.push(1, 0, 0);
      m.push(mask);
    }

    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      idx.push(centerIdx, ringStart + i, ringStart + next);
    }
  }

  // Cap Back (-X)
  if (capBack) {
    const centerIdx = p.length / 3;
    p.push(minX, cy, cz);
    n.push(-1, 0, 0);
    m.push(mask);

    const ringStart = p.length / 3;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      p.push(minX, cy + rBack * Math.cos(a), cz + rBack * Math.sin(a));
      n.push(-1, 0, 0);
      m.push(mask);
    }

    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      idx.push(centerIdx, ringStart + next, ringStart + i);
    }
  }

  return {
    positions: new Float32Array(p),
    normals: new Float32Array(n),
    masks: new Float32Array(m),
    indices: new Uint16Array(idx),
  };
}

/** Construct an extruded polygon prism along Z axis (for faceted hulls and sloped armor deflectors) */
export function createPolygonPrismMesh(
  pointsXY: [number, number][],
  minZ: number,
  maxZ: number,
  mask = 0,
): MeshData {
  const p: number[] = [];
  const n: number[] = [];
  const m: number[] = [];
  const idx: number[] = [];
  const count = pointsXY.length;
  if (count < 3) return createBoxMesh(0, 0, minZ, 0, 0, maxZ, mask);

  let sumX = 0;
  let sumY = 0;
  for (const pt of pointsXY) {
    sumX += pt[0];
    sumY += pt[1];
  }
  const avgX = sumX / count;
  const avgY = sumY / count;

  // Side quads
  for (let i = 0; i < count; i++) {
    const pA = pointsXY[i]!;
    const pB = pointsXY[(i + 1) % count]!;

    const p0: [number, number, number] = [pA[0], pA[1], minZ];
    const p1: [number, number, number] = [pB[0], pB[1], minZ];
    const p2: [number, number, number] = [pB[0], pB[1], maxZ];
    const p3: [number, number, number] = [pA[0], pA[1], maxZ];

    const norm = computeNormal(p0, p1, p2);
    const baseIdx = p.length / 3;
    p.push(...p0, ...p1, ...p2, ...p3);
    n.push(...norm, ...norm, ...norm, ...norm);
    m.push(mask, mask, mask, mask);
    idx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
  }

  // Top cap (+Z)
  const topCenterIdx = p.length / 3;
  p.push(avgX, avgY, maxZ);
  n.push(0, 0, 1);
  m.push(mask);

  const topRingStart = p.length / 3;
  for (let i = 0; i < count; i++) {
    p.push(pointsXY[i]![0], pointsXY[i]![1], maxZ);
    n.push(0, 0, 1);
    m.push(mask);
  }
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    idx.push(topCenterIdx, topRingStart + i, topRingStart + next);
  }

  // Bottom cap (-Z)
  const botCenterIdx = p.length / 3;
  p.push(avgX, avgY, minZ);
  n.push(0, 0, -1);
  m.push(mask);

  const botRingStart = p.length / 3;
  for (let i = 0; i < count; i++) {
    p.push(pointsXY[i]![0], pointsXY[i]![1], minZ);
    n.push(0, 0, -1);
    m.push(mask);
  }
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    idx.push(botCenterIdx, botRingStart + next, botRingStart + i);
  }

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
      else if (mat.includes("bronze") || mat.includes("heat")) currentMask = 5;
      else if (mat.includes("hazard") || mat.includes("yellow")) currentMask = 6;
      else if (mat.includes("chrome") || mat.includes("piston")) currentMask = 7;
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
