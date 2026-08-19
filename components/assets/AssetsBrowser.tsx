"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildingSprite, rubbleSprite, unitSprite, wreckSprite } from "@/lib/gen/assets";
import { listGeneratedAssets } from "@/lib/gen/assetCatalog";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { unitMovementOffset } from "@/lib/render/anim";
import { drawSprite, rasterize, rotatedSpriteBounds } from "@/lib/render/sprites";
import { drawUnitShadow } from "@/lib/render/unitMotion";
import { assetsCommandFromKey, isEditableTarget, SHORTCUT } from "@/lib/ui/shortcuts";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import type {
  AnimFrame,
  BuildingKind,
  Facing,
  FactionVisualProfile,
  Palette,
  UnitKind,
} from "@/lib/types";
import { AssetList } from "./AssetList";
import { AssetPreview } from "./AssetPreview";
import { paintBuildingAssetOverlay } from "./assetOverlayPaint";
import styles from "./AssetsBrowser.module.css";

export function AssetsBrowser({
  palette,
  onClose,
}: {
  palette: Palette;
  onClose: () => void;
}) {
  const assets = useMemo(() => listGeneratedAssets(), []);
  const [selectedId, setSelectedId] = useState(assets[0]?.id ?? "");
  const selected = assets.find((a) => a.id === selectedId) ?? assets[0];
  const [facing, setFacing] = useState<Facing>(0);
  const [playing, setPlaying] = useState(true);
  const [construction, setConstruction] = useState<0 | 1 | 2 | 3>(3);
  const [damage, setDamage] = useState<0 | 1 | 2>(0);
  const [designFamily, setDesignFamily] = useState<FactionVisualProfile["designFamily"]>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profile = useMemo(() => ({ ...generateVisualProfile(421, 0), designFamily }), [designFamily]);

  const selectAsset = (id: string) => {
    setSelectedId(id);
    setFacing(0);
    setConstruction(3);
    setDamage(0);
    setPlaying(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = assetsCommandFromKey(e, { typing: isEditableTarget(e.target) });
      if (!command) return;
      e.preventDefault();
      if (command.type === "close") {
        onClose();
        return;
      }
      if (command.type === "togglePlay") {
        setPlaying((v) => !v);
        return;
      }
      const index = assets.findIndex((a) => a.id === selectedId);
      const from = index < 0 ? 0 : index;
      const next = from + (command.type === "nextAsset" ? 1 : -1);
      const nextId = assets[Math.min(assets.length - 1, Math.max(0, next))]?.id;
      if (!nextId || nextId === selectedId) return;
      setSelectedId(nextId);
      setFacing(0);
      setConstruction(3);
      setDamage(0);
      setPlaying(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assets, onClose, selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selected) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame: AnimFrame = 0;
    let lastFrameTime = 0;
    let animTime = 0;
    let lastNow = 0;

    const paint = (timeMs: number) => {
      const spec =
        selected.category === "unit"
          ? unitSprite(selected.kind as UnitKind, palette, { facing, animationFrame: frame, variant: 11, profile })
          : selected.category === "building"
            ? buildingSprite(selected.kind as BuildingKind, palette, {
                constructionStage: construction,
                damageStage: damage,
                variant: 13,
                profile,
              })
            : selected.category === "wreck"
              ? wreckSprite(selected.kind as UnitKind, palette, { profile })
              : rubbleSprite(selected.kind as BuildingKind, palette, { profile });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const image = rasterize(spec);
      const bounds = rotatedSpriteBounds(spec);
      const scale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height) * 0.86;
      const dw = Math.max(1, Math.round(spec.w * scale));
      const dh = Math.max(1, Math.round(spec.h * scale));
      const dx = Math.round((canvas.width - bounds.width * scale) / 2 - bounds.minX * scale);
      const dy = Math.round((canvas.height - bounds.height * scale) / 2 - bounds.minY * scale);

      const isWalker = selected.kind === "infantry" || selected.kind === "antiArmor";
      const isHeavy = selected.kind === "antiArmor";
      const period = isHeavy ? 105 : isWalker ? 80 : 90;
      const strideCycleMs = period * 4;
      const stridePhase = playing ? ((animTime % strideCycleMs) / strideCycleMs) * Math.PI * 2 : 0;
      const movement = selected.category === "unit"
        ? unitMovementOffset(selected.kind as UnitKind, frame, stridePhase)
        : null;

      const bob = playing ? (movement?.bobY ?? 0) * scale : 0;
      const renderDx = dx;
      const renderDy = dy - bob;
      const groundX = dx + dw * 0.5;
      const groundY = dy + dh;

      if (selected.category === "unit") {
        drawUnitShadow(
          ctx,
          selected.kind as UnitKind,
          groundX,
          groundY,
          scale,
          1,
          playing,
        );
      }

      drawSprite(ctx, spec, image, renderDx, renderDy, dw, dh);
      if (selected.category === "building") {
        paintBuildingAssetOverlay(
          ctx,
          selected.kind as BuildingKind,
          canvas.width / 2,
          canvas.height / 2,
          Math.max(1, scale),
          timeMs,
          facing,
          playing,
          palette,
        );
      }
    };
    paint(0);
    const loop = (now: number) => {
      if (lastNow === 0) lastNow = now;
      const dt = now - lastNow;
      lastNow = now;

      if (playing) {
        animTime += dt;
        if (now - lastFrameTime > 140) {
          frame = ((frame + 1) & 3) as AnimFrame;
          lastFrameTime = now;
        }
      }
      paint(animTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [construction, damage, facing, palette, playing, profile, selected]);

  if (!selected) return null;

  return (
    <MetalPanel className={styles.browser} data-testid="assets-browser" role="dialog" aria-labelledby="assets-title">
      <div className={styles.header}>
        <div>
          <ConsoleLabel>Genesis Command</ConsoleLabel>
          <h2 id="assets-title" className={styles.title}>
            Asset bay
          </h2>
        </div>
        <ConsoleButton muted tooltip="Close asset bay" shortcut={SHORTCUT.close} onClick={onClose}>
          Close
        </ConsoleButton>
      </div>

      <div className={styles.body}>
        <AssetList assets={assets} selectedId={selected.id} onSelect={selectAsset} />
        <AssetPreview
          selected={selected}
          canvasRef={canvasRef}
          facing={facing}
          playing={playing}
          construction={construction}
          damage={damage}
          designFamily={designFamily}
          onFacing={setFacing}
          onPlaying={() => setPlaying((v) => !v)}
          onConstruction={setConstruction}
          onDamage={setDamage}
          onDesignFamily={setDesignFamily}
        />
      </div>
    </MetalPanel>
  );
}
