import type { ShapeSpec, SpriteSpec } from "../types";
import { paintSvg } from "./svgPaint";

export function paintShapes(ctx: CanvasRenderingContext2D, shapes: ShapeSpec[]): void {
  for (const s of shapes) {
    ctx.save();
    if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
    ctx.fillStyle = s.fill;
    ctx.strokeStyle = s.stroke ?? s.fill;
    ctx.lineWidth = s.strokeWidth ?? 1;
    ctx.beginPath();
    if (s.type === "rect") {
      if (s.fill !== "transparent") ctx.fillRect(s.x, s.y, s.w, s.h);
      if (s.stroke) ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === "ellipse") {
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      if (s.fill !== "transparent") ctx.fill();
      if (s.stroke) ctx.stroke();
    } else if (s.type === "diamond") {
      ctx.moveTo(s.x + s.w / 2, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h / 2);
      ctx.lineTo(s.x + s.w / 2, s.y + s.h);
      ctx.lineTo(s.x, s.y + s.h / 2);
      ctx.closePath();
      if (s.fill !== "transparent") ctx.fill();
      if (s.stroke) ctx.stroke();
    } else if (s.type === "line") {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      ctx.stroke();
    } else if (s.type === "poly" && s.points) {
      ctx.moveTo(s.points[0]!, s.points[1]!);
      for (let i = 2; i < s.points.length; i += 2) {
        ctx.lineTo(s.points[i]!, s.points[i + 1]!);
      }
      ctx.closePath();
      if (s.fill !== "transparent") ctx.fill();
      if (s.stroke) ctx.stroke();
    }
    ctx.restore();
  }
}

const cache = new Map<string, HTMLCanvasElement>();
const imageCache = new Map<string, HTMLImageElement>();
const imageReadyCallbacks = new Map<string, Set<() => void>>();
const SVG_RASTER_SCALE = 2;

export type SpriteBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

const CONTENT_ALPHA_MIN = 12;
const contentBoundsCache = new WeakMap<HTMLCanvasElement, SpriteBounds>();

export function opaquePixelBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
  alphaMin = CONTENT_ALPHA_MIN,
): SpriteBounds | undefined {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) < alphaMin) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return undefined;
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Tight box around painted pixels so sidebar previews can center the graphic, not the battlefield frame. */
export function spriteContentBounds(image: HTMLCanvasElement): SpriteBounds | undefined {
  const hit = contentBoundsCache.get(image);
  if (hit) return hit;
  const ctx = image.getContext("2d");
  if (!ctx || image.width <= 0 || image.height <= 0) return undefined;
  try {
    const bounds = opaquePixelBounds(ctx.getImageData(0, 0, image.width, image.height).data, image.width, image.height);
    if (bounds) contentBoundsCache.set(image, bounds);
    return bounds;
  } catch {
    return undefined;
  }
}

export function rotatedSpriteBounds(spec: Pick<SpriteSpec, "w" | "h" | "rotation" | "anchorX" | "anchorY">): SpriteBounds {
  if (!spec.rotation) return { minX: 0, minY: 0, width: spec.w, height: spec.h };

  const angle = spec.rotation;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const anchorX = spec.anchorX ?? spec.w / 2;
  const anchorY = spec.anchorY ?? spec.h;
  const corners = [
    [0, 0],
    [spec.w, 0],
    [spec.w, spec.h],
    [0, spec.h],
  ].map(([x, y]) => [
    anchorX + (x - anchorX) * cos - (y - anchorY) * sin,
    anchorY + (x - anchorX) * sin + (y - anchorY) * cos,
  ]);
  const xs = corners.map(([x]) => x!);
  const ys = corners.map(([, y]) => y!);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    minX,
    minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

function rasterCacheKey(spec: SpriteSpec): string {
  const crop = spec.imageCrop ? `${spec.imageCrop.x},${spec.imageCrop.y},${spec.imageCrop.w},${spec.imageCrop.h}` : "";
  return `image:${spec.imageSrc}:${spec.imageTint ?? ""}:${crop}:${spec.w}x${spec.h}`;
}

function notifyImageReady(key: string): void {
  const callbacks = imageReadyCallbacks.get(key);
  if (!callbacks) return;
  imageReadyCallbacks.delete(key);
  for (const callback of callbacks) callback();
}

function cachedImage(src: string): HTMLImageElement {
  const existing = imageCache.get(src);
  if (existing) return existing;
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  imageCache.set(src, image);
  return image;
}

function paintTexture(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, spec: SpriteSpec): void {
  if (!spec.imageTextureSrc) return;
  const image = cachedImage(spec.imageTextureSrc);
  const draw = () => {
    const overscan = 1.4;
    const dw = canvas.width * overscan;
    const dh = canvas.height * overscan;
    const offset = spec.imageTextureOffset ?? 0;
    const dx = -((offset >>> 3) % Math.max(1, Math.round(dw - canvas.width)));
    const dy = -((offset >>> 11) % Math.max(1, Math.round(dh - canvas.height)));
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = spec.imageTextureOpacity ?? 0.2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.restore();
  };
  if (image.complete && image.naturalWidth > 0) draw();
  else image.addEventListener("load", draw, { once: true });
}

export function rasterize(spec: SpriteSpec, onReady?: () => void): HTMLCanvasElement {
  const key = spec.imageSrc ? rasterCacheKey(spec) : spec.id;
  const hit = cache.get(key);
  if (spec.imageSrc && onReady) {
    const image = imageCache.get(spec.imageSrc);
    if (!image || !image.complete || image.naturalWidth <= 0) {
      const callbacks = imageReadyCallbacks.get(key) ?? new Set<() => void>();
      callbacks.add(onReady);
      imageReadyCallbacks.set(key, callbacks);
    }
  }
  if (hit) return hit;
  const c = document.createElement("canvas");
  if (spec.imageSrc) {
    // Keep a high-resolution working canvas: the source sprites are raster art
    // and must remain crisp when the battlefield camera zooms in.
    c.width = spec.w * SVG_RASTER_SCALE;
    c.height = spec.h * SVG_RASTER_SCALE;
    const ctx = c.getContext("2d")!;
    const image = imageCache.get(spec.imageSrc) ?? new Image();
    image.decoding = "async";
    const paintImage = () => {
      const inset = Math.max(1, Math.round(Math.min(c.width, c.height) * 0.025));
      const crop = spec.imageCrop ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
      const scale = Math.min((c.width - inset * 2) / crop.w, (c.height - inset * 2) / crop.h);
      const dw = Math.round(crop.w * scale);
      const dh = Math.round(crop.h * scale);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.w,
        crop.h,
        Math.round((c.width - dw) / 2),
        Math.round(c.height - dh - inset * 0.25),
        dw,
        dh,
      );
      if (spec.imageTint) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = spec.imageTint;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.globalCompositeOperation = "source-over";
      }
      notifyImageReady(key);
    };
    if (!imageCache.has(spec.imageSrc)) {
      imageCache.set(spec.imageSrc, image);
      image.src = spec.imageSrc;
    }
    if (image.complete && image.naturalWidth > 0) paintImage();
    else image.addEventListener("load", paintImage, { once: true });
  } else if (spec.svg) {
    c.width = spec.w * SVG_RASTER_SCALE;
    c.height = spec.h * SVG_RASTER_SCALE;
    const ctx = c.getContext("2d")!;
    ctx.scale(SVG_RASTER_SCALE, SVG_RASTER_SCALE);
    paintSvg(ctx, spec.svg);
  } else {
    const scale = spec.imageTextureSrc ? SVG_RASTER_SCALE : 1;
    c.width = spec.w * scale;
    c.height = spec.h * scale;
    const ctx = c.getContext("2d")!;
    if (scale > 1) ctx.scale(scale, scale);
    paintShapes(ctx, spec.shapes);
    if (spec.imageTextureSrc) {
      ctx.scale(1 / scale, 1 / scale);
      paintTexture(ctx, c, spec);
    }
  }
  cache.set(key, c);
  return c;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spec: SpriteSpec,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const smooth = Boolean(spec.svg || spec.imageSrc || spec.imageTextureSrc);
  ctx.imageSmoothingEnabled = smooth;
  if (smooth && "imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  if (spec.rotation) {
    const scaleX = dw / spec.w;
    const scaleY = dh / spec.h;
    const ax = (spec.anchorX ?? spec.w / 2) * scaleX;
    const ay = (spec.anchorY ?? spec.h) * scaleY;
    ctx.save();
    ctx.translate(dx + ax, dy + ay);
    ctx.rotate(spec.rotation);
    ctx.drawImage(img, -ax, -ay, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.imageSmoothingEnabled = false;
}

export function cachedSprite(id: string): HTMLCanvasElement | undefined {
  return cache.get(id);
}

export function clearSpriteCache(): void {
  cache.clear();
  imageCache.clear();
  imageReadyCallbacks.clear();
}
