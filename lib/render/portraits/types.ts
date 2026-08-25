export type FaceTone = "ally" | "enemy" | "command";

export type PortraitFrameRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export type PortraitClip = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export type PortraitOffset = {
  dx: number;
  dy: number;
};

export type PortraitSearchWindow = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export const PORTRAIT_OFFSET_NONE: PortraitOffset = { dx: 0, dy: 0 };
export const PORTRAIT_MEASURE_WIDTH = 200;
export const PORTRAIT_MEASURE_HEIGHT = 240;

export const PORTRAIT_MOUTH_CLIP: PortraitClip = { cx: 0.5, cy: 0.58, rx: 0.16, ry: 0.06 };
export const PORTRAIT_EYE_CLIPS: readonly PortraitClip[] = [
  { cx: 0.36, cy: 0.405, rx: 0.135, ry: 0.075 },
  { cx: 0.64, cy: 0.405, rx: 0.135, ry: 0.075 },
];
export const PORTRAIT_DRIFT_THRESHOLD = 2;

export function portraitHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextPortraitRandom(value: number): number {
  let next = value || 0x6d2b79f5;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}
