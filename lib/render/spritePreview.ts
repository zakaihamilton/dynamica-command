import type { SpriteBounds } from "../gen/spriteBounds";

/** CSS dimensions stay compact; the renderer works at 2x before DPR scaling. */
export const SPRITE_PREVIEW_CSS_WIDTH = 80;
export const SPRITE_PREVIEW_CSS_HEIGHT = 56;
export const SPRITE_PREVIEW_RENDER_SCALE = 2;
export const SPRITE_PREVIEW_WIDTH = SPRITE_PREVIEW_CSS_WIDTH * SPRITE_PREVIEW_RENDER_SCALE;
export const SPRITE_PREVIEW_HEIGHT = SPRITE_PREVIEW_CSS_HEIGHT * SPRITE_PREVIEW_RENDER_SCALE;
export const SPRITE_PREVIEW_DPR_CAP = 2;
export const SPRITE_PREVIEW_CONTENT_SCALE = 0.86;

export function spritePreviewDpr(devicePixelRatio: number | undefined): number {
  if (!Number.isFinite(devicePixelRatio) || (devicePixelRatio ?? 0) <= 0) return 1;
  return Math.min(SPRITE_PREVIEW_DPR_CAP, Math.max(1, devicePixelRatio!));
}

export function spritePreviewCanvasSize(dpr: number): { width: number; height: number } {
  const safeDpr = spritePreviewDpr(dpr);
  return {
    width: Math.round(SPRITE_PREVIEW_WIDTH * safeDpr),
    height: Math.round(SPRITE_PREVIEW_HEIGHT * safeDpr),
  };
}

export type SpritePreviewLayout = {
  scale: number;
  width: number;
  height: number;
  x: number;
  y: number;
};

export function spritePreviewLayout(
  bounds: Pick<SpriteBounds, "width" | "height">,
  width = SPRITE_PREVIEW_WIDTH,
  height = SPRITE_PREVIEW_HEIGHT,
): SpritePreviewLayout {
  const sourceWidth = Math.max(1, bounds.width);
  const sourceHeight = Math.max(1, bounds.height);
  const scale = Math.min(width / sourceWidth, height / sourceHeight) * SPRITE_PREVIEW_CONTENT_SCALE;
  const contentWidth = Math.max(1, Math.round(sourceWidth * scale));
  const contentHeight = Math.max(1, Math.round(sourceHeight * scale));
  return {
    scale,
    width: contentWidth,
    height: contentHeight,
    x: Math.round((width - contentWidth) / 2),
    y: Math.round((height - contentHeight) / 2),
  };
}
