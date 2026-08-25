import type { MeshData } from "./types";
import { computeNormal } from "./math";

export function createBoxMesh(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
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
