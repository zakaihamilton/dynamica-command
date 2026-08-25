import type { MeshData } from "./types";

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
