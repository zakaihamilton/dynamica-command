import type { PortraitSearchWindow } from "./types";

export function lumaBuffer(rgba: ArrayLike<number>, width: number, height: number): Uint8Array {
  const pixels = width * height;
  const out = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const channel = index * 4;
    out[index] = (rgba[channel] * 77 + rgba[channel + 1] * 150 + rgba[channel + 2] * 29) >> 8;
  }
  return out;
}

export function lumaSad(
  idle: Uint8Array,
  other: Uint8Array,
  width: number,
  height: number,
  dx: number,
  dy: number,
  window?: PortraitSearchWindow,
): number {
  const x0 = Math.max(window?.x0 ?? 0, dx, 0);
  const x1 = Math.min(window?.x1 ?? width, width + dx, width);
  const y0 = Math.max(window?.y0 ?? 0, dy, 0);
  const y1 = Math.min(window?.y1 ?? height, height + dy, height);
  if (x1 <= x0 || y1 <= y0) return Number.POSITIVE_INFINITY;
  let total = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    const idleRow = y * width;
    const otherRow = (y - dy) * width - dx;
    for (let x = x0; x < x1; x += 1) {
      total += Math.abs(idle[idleRow + x] - other[otherRow + x]);
      count += 1;
    }
  }
  return count === 0 ? Number.POSITIVE_INFINITY : total / count;
}

function sampleLuma(luma: Uint8Array, width: number, height: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) {
    const ix = Math.max(0, Math.min(width - 1, Math.round(x)));
    const iy = Math.max(0, Math.min(height - 1, Math.round(y)));
    return luma[iy * width + ix];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = luma[y0 * width + x0];
  const b = luma[y0 * width + x1];
  const c = luma[y1 * width + x0];
  const d = luma[y1 * width + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

export function lumaSadSubpixel(
  idle: Uint8Array,
  other: Uint8Array,
  width: number,
  height: number,
  dx: number,
  dy: number,
  window?: PortraitSearchWindow,
): number {
  const x0 = Math.max(window?.x0 ?? 0, 0);
  const x1 = Math.min(window?.x1 ?? width, width);
  const y0 = Math.max(window?.y0 ?? 0, 0);
  const y1 = Math.min(window?.y1 ?? height, height);
  if (x1 <= x0 || y1 <= y0) return Number.POSITIVE_INFINITY;
  let total = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    const idleRow = y * width;
    for (let x = x0; x < x1; x += 1) {
      total += Math.abs(idle[idleRow + x] - sampleLuma(other, width, height, x - dx, y - dy));
      count += 1;
    }
  }
  return count === 0 ? Number.POSITIVE_INFINITY : total / count;
}
