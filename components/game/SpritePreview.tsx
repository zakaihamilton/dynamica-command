"use client";

import { useEffect, useRef } from "react";
import { unitMovementOffset } from "@/lib/render/anim";
import { buildingSprite, unitSprite } from "@/lib/gen/assets";
import { drawSprite, rasterize, spriteContentBounds } from "@/lib/render/sprites";
import { paintBuildingAssetOverlay } from "@/lib/render/previewEffects";
import {
  SPRITE_PREVIEW_HEIGHT,
  SPRITE_PREVIEW_CSS_HEIGHT,
  SPRITE_PREVIEW_CSS_WIDTH,
  SPRITE_PREVIEW_WIDTH,
  spritePreviewCanvasSize,
  spritePreviewDpr,
  spritePreviewLayout,
} from "@/lib/render/spritePreview";
import { drawUnitShadow } from "@/lib/render/unitMotion";
import { isUnitKind, UNIT_STATS } from "@/lib/catalog";
import { cx } from "@/lib/ui/cx";
import type { BuildingKind, FactionVisualProfile, Palette, UnitKind } from "@/lib/types";
import styles from "./SpritePreview.module.css";

export function SpritePreview({
  kind,
  palette,
  profile,
  className,
}: {
  kind: BuildingKind | UnitKind;
  palette: Palette;
  profile?: FactionVisualProfile;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const isUnit = isUnitKind(kind);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = spritePreviewDpr(window.devicePixelRatio);
    const canvasSize = spritePreviewCanvasSize(dpr);
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let disposed = false;
    const paint = (animationFrame: 0 | 1 | 2 | 3) => {
      const spec = isUnitKind(kind)
        ? unitSprite(kind, palette, { facing: 0, animationFrame, profile })
        : buildingSprite(kind, palette, { profile });
      const logicalWidth = SPRITE_PREVIEW_WIDTH;
      const logicalHeight = SPRITE_PREVIEW_HEIGHT;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const image = rasterize(spec, () => {
        if (!disposed) paint(animationFrame);
      });
      const bounds = spriteContentBounds(image) ?? { minX: 0, minY: 0, width: image.width, height: image.height };
      const layout = spritePreviewLayout(bounds, logicalWidth, logicalHeight);
      ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";

      const movement = isUnitKind(kind) && UNIT_STATS[kind].domain !== "human"
        ? unitMovementOffset(kind, animationFrame)
        : null;
      const renderDx = layout.x;
      const renderDy = layout.y + (movement?.bobY ?? 0) * layout.scale;
      const groundX = Math.round(logicalWidth / 2);
      const groundY = Math.round((logicalHeight + layout.height) / 2);

      if (isUnitKind(kind)) {
        drawUnitShadow(
          ctx,
          kind,
          groundX,
          groundY,
          layout.scale,
          1,
          true,
        );
      }

      drawSprite(ctx, spec, image, renderDx, renderDy, layout.width, layout.height, bounds);
      if (!isUnitKind(kind)) {
        const overlayScale = kind === "turret" ? layout.scale * 2 : layout.scale;
        const overlayY = logicalHeight / 2 - (kind === "turret" ? 8 : 0);
        paintBuildingAssetOverlay(ctx, kind, logicalWidth / 2, overlayY, overlayScale, 0, 3, false, palette);
      }
    };
    paint(0);
    if (!isUnit) return;
    const id = window.setInterval(() => {
      frame = (frame + 1) & 3;
      paint(frame as 0 | 1 | 2 | 3);
    }, 140);
    return () => {
      disposed = true;
      window.clearInterval(id);
    };
  }, [isUnit, kind, palette, profile]);
  return (
    <canvas
      ref={ref}
      width={SPRITE_PREVIEW_CSS_WIDTH}
      height={SPRITE_PREVIEW_CSS_HEIGHT}
      className={cx(styles.canvas, className)}
      aria-hidden
    />
  );
}
