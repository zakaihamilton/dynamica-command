import type { PortraitAsset } from "../gen/portraitCatalog";

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

// Destination-space ellipses used to composite blink/speech frames onto a
// stable idle sheet. Full-frame swaps flicker because generated sheets drift.
export const PORTRAIT_MOUTH_CLIP: PortraitClip = { cx: 0.5, cy: 0.635, rx: 0.18, ry: 0.09 };
export const PORTRAIT_EYE_CLIPS: readonly PortraitClip[] = [
  { cx: 0.36, cy: 0.405, rx: 0.135, ry: 0.075 },
  { cx: 0.64, cy: 0.405, rx: 0.135, ry: 0.075 },
];
export const PORTRAIT_DRIFT_THRESHOLD = 2;

function portraitHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextPortraitRandom(value: number): number {
  let next = value || 0x6d2b79f5;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

export function portraitClipWindow(
  clips: readonly PortraitClip[],
  width: number,
  height: number,
  pad = 8,
): PortraitSearchWindow {
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  for (const clip of clips) {
    x0 = Math.min(x0, width * (clip.cx - clip.rx));
    y0 = Math.min(y0, height * (clip.cy - clip.ry));
    x1 = Math.max(x1, width * (clip.cx + clip.rx));
    y1 = Math.max(y1, height * (clip.cy + clip.ry));
  }
  return {
    x0: Math.max(0, Math.floor(x0) - pad),
    y0: Math.max(0, Math.floor(y0) - pad),
    x1: Math.min(width, Math.ceil(x1) + pad),
    y1: Math.min(height, Math.ceil(y1) + pad),
  };
}

export function scalePortraitOffset(
  offset: PortraitOffset,
  fromWidth: number,
  toWidth: number,
): PortraitOffset {
  if (fromWidth <= 0 || fromWidth === toWidth) return offset;
  const scale = toWidth / fromWidth;
  return { dx: offset.dx * scale, dy: offset.dy * scale };
}

export function portraitHasDrift(offset: PortraitOffset, threshold = PORTRAIT_DRIFT_THRESHOLD): boolean {
  return Math.abs(offset.dx) >= threshold || Math.abs(offset.dy) >= threshold;
}

export function choosePortraitMouthClip(detected: PortraitClip, fallback = PORTRAIT_MOUTH_CLIP): PortraitClip {
  if (Math.abs(detected.cy - fallback.cy) > 0.07 || Math.abs(detected.cx - fallback.cx) > 0.08) {
    return fallback;
  }
  return { ...fallback, cx: detected.cx, cy: detected.cy };
}

export function resolvePortraitAnimation(
  idleRgba: ArrayLike<number>,
  blinkRgba: ArrayLike<number> | null,
  talkRgba: ArrayLike<number> | null,
  width: number,
  height: number,
): { blink: PortraitOffset; talk: PortraitOffset; mouthClip: PortraitClip } {
  const faceWindow: PortraitSearchWindow = {
    x0: Math.floor(width * 0.12),
    y0: Math.floor(height * 0.08),
    x1: Math.ceil(width * 0.88),
    y1: Math.ceil(height * 0.9),
  };
  const blinkDrift = blinkRgba
    ? measurePortraitOffset(idleRgba, blinkRgba, width, height, 16, faceWindow)
    : PORTRAIT_OFFSET_NONE;
  const talkDrift = talkRgba
    ? measurePortraitOffset(idleRgba, talkRgba, width, height, 16, faceWindow)
    : PORTRAIT_OFFSET_NONE;

  if (!portraitHasDrift(blinkDrift) && !portraitHasDrift(talkDrift)) {
    return { blink: PORTRAIT_OFFSET_NONE, talk: PORTRAIT_OFFSET_NONE, mouthClip: PORTRAIT_MOUTH_CLIP };
  }

  const mouthClip = choosePortraitMouthClip(detectPortraitMouthClip(idleRgba, width, height));
  const mouthWindow = portraitClipWindow([mouthClip], width, height, 6);
  const eyeWindow = portraitClipWindow(PORTRAIT_EYE_CLIPS, width, height);
  return {
    blink: blinkRgba
      ? refinePortraitOffset(
          idleRgba,
          blinkRgba,
          width,
          height,
          measurePortraitOffset(idleRgba, blinkRgba, width, height, 16, eyeWindow),
          eyeWindow,
        )
      : PORTRAIT_OFFSET_NONE,
    talk: talkRgba
      ? refinePortraitOffset(
          idleRgba,
          talkRgba,
          width,
          height,
          measurePortraitOffset(idleRgba, talkRgba, width, height, 16, mouthWindow),
          mouthWindow,
        )
      : PORTRAIT_OFFSET_NONE,
    mouthClip,
  };
}

export function detectPortraitMouthClip(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): PortraitClip {
  const luma = lumaBuffer(rgba, width, height);
  const x0 = Math.floor(width * 0.34);
  const x1 = Math.ceil(width * 0.66);
  const y0 = Math.floor(height * 0.54);
  const y1 = Math.ceil(height * 0.74);
  let bestY = Math.round(height * PORTRAIT_MOUTH_CLIP.cy);
  let bestSum = Number.POSITIVE_INFINITY;
  for (let y = y0; y < y1; y += 1) {
    let sum = 0;
    for (let x = x0; x < x1; x += 1) sum += luma[y * width + x];
    if (sum < bestSum) {
      bestSum = sum;
      bestY = y;
    }
  }

  let weightedX = 0;
  let weight = 0;
  const rowStart = Math.max(y0, bestY - 2);
  const rowEnd = Math.min(y1, bestY + 3);
  for (let y = rowStart; y < rowEnd; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const darkness = Math.max(0, 140 - luma[y * width + x]);
      weightedX += x * darkness;
      weight += darkness;
    }
  }

  const cx = weight > 0 ? weightedX / weight / width : PORTRAIT_MOUTH_CLIP.cx;
  return {
    cx: Math.min(0.62, Math.max(0.38, cx)),
    cy: bestY / height,
    rx: 0.15,
    ry: 0.075,
  };
}

export function refinePortraitOffset(
  idleRgba: ArrayLike<number>,
  otherRgba: ArrayLike<number>,
  width: number,
  height: number,
  coarse: PortraitOffset,
  window?: PortraitSearchWindow,
  step = 0.25,
): PortraitOffset {
  const idle = lumaBuffer(idleRgba, width, height);
  const other = lumaBuffer(otherRgba, width, height);
  let best = coarse;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let iy = -4; iy <= 4; iy += 1) {
    for (let ix = -4; ix <= 4; ix += 1) {
      const dx = coarse.dx + ix * step;
      const dy = coarse.dy + iy * step;
      const score = lumaSadSubpixel(idle, other, width, height, dx, dy, window);
      if (score < bestScore) {
        bestScore = score;
        best = { dx, dy };
      }
    }
  }
  return best;
}

export function measurePortraitOffset(
  idleRgba: ArrayLike<number>,
  otherRgba: ArrayLike<number>,
  width: number,
  height: number,
  radius = 16,
  window?: PortraitSearchWindow,
): PortraitOffset {
  // Find the canvas translation that lands `other` on `idle`.
  // idle[x, y] ≈ other[x - dx, y - dy], so draw with ctx.translate(dx, dy).
  const idle = lumaBuffer(idleRgba, width, height);
  const other = lumaBuffer(otherRgba, width, height);
  let bestDx = 0;
  let bestDy = 0;
  let best = Number.POSITIVE_INFINITY;
  const maxRadius = Math.max(0, Math.min(radius, width - 1, height - 1));

  for (let dy = -maxRadius; dy <= maxRadius; dy += 1) {
    for (let dx = -maxRadius; dx <= maxRadius; dx += 1) {
      const score = lumaSad(idle, other, width, height, dx, dy, window);
      if (score < best) {
        best = score;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  return { dx: bestDx, dy: bestDy };
}

function lumaBuffer(rgba: ArrayLike<number>, width: number, height: number): Uint8Array {
  const pixels = width * height;
  const out = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const channel = index * 4;
    out[index] = (rgba[channel] * 77 + rgba[channel + 1] * 150 + rgba[channel + 2] * 29) >> 8;
  }
  return out;
}

function lumaSad(
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

function lumaSadSubpixel(
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

export function portraitBlinking(time: number, portraitId: string): boolean {
  const hash = portraitHash(portraitId);
  const interval = 150 + (hash % 180);
  const phase = (hash >>> 8) % interval;
  const position = (Math.floor(time) + phase) % interval;
  return position < 9;
}

function drawPortraitBooth(ctx: CanvasRenderingContext2D, tone: FaceTone): void {
  const booth = tone === "enemy" ? "#1c1210" : tone === "command" ? "#12160f" : "#10140c";
  const glow = tone === "enemy" ? "rgba(110, 38, 28, 0.34)" : "rgba(52, 72, 38, 0.28)";
  const rim = tone === "enemy" ? "#6a3428" : "#3d4633";

  ctx.fillStyle = booth;
  ctx.fillRect(-58, -74, 116, 152);
  const wash = ctx.createRadialGradient(-8, -18, 8, 0, 4, 70);
  wash.addColorStop(0, glow);
  wash.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(-58, -74, 116, 152);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  ctx.strokeRect(-55, -71, 110, 146);
  ctx.fillStyle = rim;
  for (const [x, y] of [[-52, -68], [48, -68], [-52, 70], [48, 70]]) {
    ctx.fillRect(x, y, 4, 4);
  }
  ctx.fillStyle = "rgba(8, 10, 8, 0.55)";
  ctx.beginPath();
  ctx.ellipse(0, 70, 44, 11, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPortraitBackdrop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  tone: FaceTone,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100);
  drawPortraitBooth(ctx, tone);
  ctx.restore();
}

export function portraitSpeechFrame(time: number, portraitId: string, frameCount: number): number {
  if (frameCount <= 1) return 0;

  // Hold each viseme long enough to read at briefing size. One chunk is ~80ms
  // at a 60fps clock; open holds under two chunks look like flicker, not speech.
  const targetChunk = Math.max(0, Math.floor(time / 5));
  let cursor = 0;
  let mouthOpen = false;
  let random = portraitHash(`${portraitId}:speech`);

  for (let segment = 0; segment < 2048; segment += 1) {
    random = nextPortraitRandom(random);
    const duration = mouthOpen ? 3 + (random % 4) : 3 + (random % 5);
    if (targetChunk < cursor + duration) return mouthOpen ? 2 : 0;
    cursor += duration;
    random = nextPortraitRandom(random);
    mouthOpen = mouthOpen ? false : random % 5 !== 0;
  }

  return mouthOpen ? 2 : 0;
}

export function portraitFrameIndex(
  time: number,
  talking: boolean,
  frameCount: number,
  portraitId = "default",
): number {
  if (frameCount <= 1) return 0;
  if (talking && frameCount >= 3) {
    return portraitSpeechFrame(time, portraitId, frameCount);
  }
  if (frameCount >= 2 && portraitBlinking(time, portraitId)) return 1;
  return 0;
}

export function portraitFrameRect(
  imageWidth: number,
  imageHeight: number,
  frameCount: number,
  frame: number,
  destinationWidth?: number,
  destinationHeight?: number,
): PortraitFrameRect {
  const safeFrame = Math.max(0, Math.min(frameCount - 1, frame));
  const frameWidth = imageWidth / frameCount;
  let sourceWidth = frameWidth;
  let sourceHeight = imageHeight;
  let sourceY = 0;

  if (destinationWidth && destinationHeight && destinationWidth > 0 && destinationHeight > 0) {
    const sourceAspect = frameWidth / imageHeight;
    const destinationAspect = destinationWidth / destinationHeight;

    if (sourceAspect < destinationAspect) {
      // Generated sheets are taller than the card slot. Use a stable vertical
      // crop so the head and shoulders keep their natural proportions.
      sourceHeight = frameWidth / destinationAspect;
      sourceY = Math.max(0, Math.min(imageHeight - sourceHeight, imageHeight * 0.04));
    } else if (sourceAspect > destinationAspect) {
      sourceWidth = imageHeight * destinationAspect;
    }
  }

  return {
    sx: safeFrame * frameWidth + (frameWidth - sourceWidth) / 2,
    sy: sourceY,
    sw: sourceWidth,
    sh: sourceHeight,
  };
}

export function drawPortraitFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  asset: PortraitAsset,
  frame: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const source = portraitFrameRect(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    asset.frameCount,
    frame,
    width,
    height,
  );
  ctx.drawImage(
    image,
    Math.round(source.sx),
    Math.round(source.sy),
    Math.round(source.sw),
    Math.round(source.sh),
    x,
    y,
    width,
    height,
  );
}

export function drawPortraitClippedFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  asset: PortraitAsset,
  frame: number,
  x: number,
  y: number,
  width: number,
  height: number,
  clips: readonly PortraitClip[],
  offset: PortraitOffset = PORTRAIT_OFFSET_NONE,
  overlay?: HTMLCanvasElement | null,
): void {
  if (clips.length === 0) return;
  if (!overlay) {
    ctx.save();
    ctx.beginPath();
    for (const clip of clips) {
      const cx = x + width * clip.cx;
      const cy = y + height * clip.cy;
      const rx = width * clip.rx;
      const ry = height * clip.ry;
      ctx.moveTo(cx + rx, cy);
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.closePath();
    }
    ctx.clip();
    ctx.translate(offset.dx, offset.dy);
    drawPortraitFrame(ctx, image, asset, frame, x, y, width, height);
    ctx.restore();
    return;
  }

  if (overlay.width !== width) overlay.width = width;
  if (overlay.height !== height) overlay.height = height;
  const off = overlay.getContext("2d");
  if (!off) return;
  off.setTransform(1, 0, 0, 1, 0, 0);
  off.clearRect(0, 0, width, height);
  off.translate(offset.dx, offset.dy);
  drawPortraitFrame(off, image, asset, frame, 0, 0, width, height);
  off.setTransform(1, 0, 0, 1, 0, 0);
  off.globalCompositeOperation = "destination-in";
  for (const clip of clips) {
    const cx = width * clip.cx;
    const cy = height * clip.cy;
    const rx = width * clip.rx;
    const ry = height * clip.ry;
    off.save();
    off.translate(cx, cy);
    off.scale(rx, ry);
    const fade = off.createRadialGradient(0, 0, 0, 0, 0, 1);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(0.62, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    off.fillStyle = fade;
    off.beginPath();
    off.arc(0, 0, 1, 0, Math.PI * 2);
    off.fill();
    off.restore();
  }
  off.globalCompositeOperation = "source-over";
  ctx.drawImage(overlay, x, y);
}
