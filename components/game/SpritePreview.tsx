"use client";

import { useEffect, useRef } from "react";
import { unitMovementOffset } from "@/lib/render/anim";
import { buildingSprite, unitSprite } from "@/lib/gen/assets";
import { buildTurretHeadModel, type UnitModel } from "@/lib/render/gl/modelLoader";
import { draw3dModel } from "@/lib/render/gl/modelRenderer";
import { rasterize, spriteContentBounds } from "@/lib/render/sprites";
import { drawUnitShadow } from "@/lib/render/unitMotion";
import { cx } from "@/lib/ui/cx";
import type { BuildingKind, FactionVisualProfile, Palette, UnitKind } from "@/lib/types";
import styles from "./SpritePreview.module.css";

let cachedTurretModel: UnitModel | null = null;
function getTurretModel(): UnitModel {
  if (!cachedTurretModel) {
    cachedTurretModel = buildTurretHeadModel();
  }
  return cachedTurretModel;
}

const UNITS: UnitKind[] = ["harvester", "infantry", "antiArmor", "tank"];

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
  const isUnit = UNITS.includes(kind as UnitKind);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;
    let last = 0;
    let disposed = false;
    const paint = (animationFrame: 0 | 1 | 2 | 3) => {
      const spec = isUnit
        ? unitSprite(kind as UnitKind, palette, { facing: 0, animationFrame, profile })
        : buildingSprite(kind as BuildingKind, palette, { profile });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const image = rasterize(spec, () => {
        if (!disposed) paint(animationFrame);
      });
      const bounds = spriteContentBounds(image) ?? { minX: 0, minY: 0, width: image.width, height: image.height };
      const scale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height) * 0.86;
      const dw = Math.max(1, Math.round(bounds.width * scale));
      const dh = Math.max(1, Math.round(bounds.height * scale));
      ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";

      const movement = isUnit ? unitMovementOffset(kind as UnitKind, animationFrame) : null;
      const renderDx = Math.round((canvas.width - dw) / 2);
      const renderDy = Math.round((canvas.height - dh) / 2) - (movement?.bobY ?? 0) * scale;
      const groundX = Math.round(canvas.width / 2);
      const groundY = Math.round((canvas.height + dh) / 2);

      if (isUnit) {
        drawUnitShadow(
          ctx,
          kind as UnitKind,
          groundX,
          groundY,
          scale,
          1,
          true,
        );
      }

      ctx.drawImage(
        image,
        bounds.minX,
        bounds.minY,
        bounds.width,
        bounds.height,
        renderDx,
        renderDy,
        dw,
        dh,
      );

      if (kind === "turret") {
        const model = getTurretModel();
        const modelScale = scale * 1.5;
        const cx = Math.round(canvas.width / 2);
        const cy = Math.round(canvas.height / 2);
        draw3dModel(ctx, model, cx, cy - 3 * modelScale, modelScale, (3 / 8) * Math.PI * 2 - Math.PI / 4, palette);
      }
    };
    paint(0);
    if (!isUnit) return;
    const loop = (now: number) => {
      if (now - last > 140) {
        frame = (frame + 1) & 3;
        last = now;
        paint(frame as 0 | 1 | 2 | 3);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [isUnit, kind, palette, profile]);
  return <canvas ref={ref} width={80} height={56} className={cx(styles.canvas, className)} aria-hidden />;
}
