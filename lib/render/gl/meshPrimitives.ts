export type MeshData = {
  positions: Float32Array;
  normals: Float32Array;
  masks: Float32Array;
  indices: Uint16Array;
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
