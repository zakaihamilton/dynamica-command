"use client";

import { useEffect, useRef } from "react";
import { buildingSprite, unitSprite } from "@/lib/gen/assets";
import { drawSprite, rasterize } from "@/lib/render/sprites";
import { cx } from "@/lib/ui/cx";
import type { BuildingKind, Palette, UnitKind } from "@/lib/types";
import styles from "./SpritePreview.module.css";

const UNITS: UnitKind[] = ["harvester", "infantry", "antiArmor", "tank"];

export function SpritePreview({
  kind,
  palette,
  className,
}: {
  kind: BuildingKind | UnitKind;
  palette: Palette;
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
    const paint = (animationFrame: 0 | 1 | 2 | 3) => {
      const spec = isUnit
        ? unitSprite(kind as UnitKind, palette, { facing: 0, animationFrame })
        : buildingSprite(kind as BuildingKind, palette);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const image = rasterize(spec);
      const scale = Math.min(canvas.width / spec.w, canvas.height / spec.h) * 0.9;
      const dw = Math.max(1, Math.round(spec.w * scale));
      const dh = Math.max(1, Math.round(spec.h * scale));
      drawSprite(ctx, spec, image, Math.round((canvas.width - dw) / 2), Math.round((canvas.height - dh) / 2), dw, dh);
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
    return () => cancelAnimationFrame(raf);
  }, [isUnit, kind, palette]);
  return <canvas ref={ref} width={80} height={56} className={cx(styles.canvas, className)} aria-hidden />;
}
