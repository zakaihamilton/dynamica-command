import type { MeshData } from "./types";
import { computeNormal } from "./math";
import { createBoxMesh } from "./box";

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
