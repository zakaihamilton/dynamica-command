export type MeshPoint = [number, number, number];
export type MeshBuffers = { p: number[]; n: number[]; m: number[]; idx: number[] };

export function appendQuad(
  buffers: MeshBuffers,
  p0: MeshPoint,
  p1: MeshPoint,
  p2: MeshPoint,
  p3: MeshPoint,
  norm: MeshPoint,
  mask: number,
): void {
  const baseIdx = buffers.p.length / 3;
  buffers.p.push(...p0, ...p1, ...p2, ...p3);
  buffers.n.push(...norm, ...norm, ...norm, ...norm);
  buffers.m.push(mask, mask, mask, mask);
  buffers.idx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
}

export function appendCap(
  buffers: MeshBuffers,
  center: MeshPoint,
  normal: MeshPoint,
  segments: number,
  mask: number,
  pointAt: (index: number) => MeshPoint,
  reverse = false,
): void {
  const centerIdx = buffers.p.length / 3;
  buffers.p.push(...center);
  buffers.n.push(...normal);
  buffers.m.push(mask);

  const ringStart = buffers.p.length / 3;
  for (let i = 0; i < segments; i++) {
    const point = pointAt(i);
    buffers.p.push(...point);
    buffers.n.push(...normal);
    buffers.m.push(mask);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    if (reverse) buffers.idx.push(centerIdx, ringStart + next, ringStart + i);
    else buffers.idx.push(centerIdx, ringStart + i, ringStart + next);
  }
}
