"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildingSprite, rubbleSprite, tileSprite, unitSprite, wreckSprite } from "@/lib/gen/assets";
import { listGeneratedAssets } from "@/lib/gen/assetCatalog";
import { generateCampaignVisualProfile, generateVisualProfile } from "@/lib/gen/visualProfile";
import { buildingAnim, unitMovementOffset } from "@/lib/render/anim";
import { drawSprite, rasterize, rotatedSpriteBounds } from "@/lib/render/sprites";
import { paintUnitMovementFx } from "@/lib/render/unitMotion";
import { assetsCommandFromKey, isEditableTarget, SHORTCUT } from "@/lib/ui/shortcuts";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import type {
  AnimFrame,
  BuildingKind,
  Entity,
  Facing,
  FactionVisualProfile,
  Palette,
  UnitKind,
} from "@/lib/types";
import { AssetList } from "./AssetList";
import { AssetPreview } from "./AssetPreview";
import styles from "./AssetsBrowser.module.css";

function fakeBuilding(kind: BuildingKind): Entity {
  return {
    id: 1,
    owner: 0,
    class: "building",
    kind,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    cooldown: 0,
    path: [],
    carry: 0,
    constructing: 0,
    queue: [],
    marked: false,
    idle: true,
  };
}

function paintOverlay(
  ctx: CanvasRenderingContext2D,
  kind: BuildingKind,
  cx: number,
  cy: number,
  scale: number,
  now: number,
): void {
  const anim = buildingAnim(fakeBuilding(kind), 0, now);
  ctx.save();
  if (anim.lightOn && (kind === "power" || kind === "constructionYard" || kind === "objective" || kind === "turret")) {
    ctx.fillStyle = kind === "objective" ? "#f3dc79" : "#c7f0d4";
    ctx.globalAlpha = 0.5 + anim.smoke * 0.3;
    ctx.beginPath();
    ctx.ellipse(cx + 6 * scale, cy - 12 * scale, 3.5 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === "refinery" || kind === "power" || kind === "factory" || anim.damageStage > 0) {
    const puff = anim.smoke;
    for (let i = 0; i < 2; i++) {
      const rise = (12 + puff * 14 + i * 7) * scale;
      ctx.globalAlpha = (0.2 + puff * 0.22) * (1 - i * 0.18);
      ctx.fillStyle = "rgba(190,190,180,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx - (8 - i * 6) * scale, cy - rise, (4 + puff * 4 + i * 2) * scale, (3 + puff * 3 + i) * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if ((kind === "barracks" || kind === "factory") && anim.doorOpen) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffc14a";
    ctx.fillRect(cx - 6 * scale, cy + 4 * scale, 12 * scale, 5 * scale);
  }
  ctx.restore();
}

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
  const [variant, setVariant] = useState(4);
  const [designFamily, setDesignFamily] = useState<FactionVisualProfile["designFamily"]>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profile = useMemo(() => ({ ...generateVisualProfile(421, 0), designFamily }), [designFamily]);
  const campaignProfile = useMemo(() => {
    const base = generateCampaignVisualProfile(421);
    const terrainTreatment = ["modular", "armored", "expeditionary"] as const;
    return { ...base, family: designFamily, terrainTreatment: terrainTreatment[designFamily] };
  }, [designFamily]);

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
      if (command.type === "close") onClose();
      else setPlaying((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selected) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame: AnimFrame = 0;
    let last = 0;
    const paint = (now: number) => {
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
              ? wreckSprite(selected.kind as UnitKind, palette)
              : selected.category === "rubble"
                ? rubbleSprite(selected.kind as BuildingKind, palette)
                : tileSprite(selected.tileKind ?? "clear", 1, {
                    biome: selected.biome ?? "ash plains",
                    variant,
                    contour: selected.tileKind === "water" ? "bank" : "none",
                    campaignProfile,
                  });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const image = rasterize(spec);
      const bounds = rotatedSpriteBounds(spec);
      const scale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height) * 0.86;
      const dw = Math.max(1, Math.round(spec.w * scale));
      const dh = Math.max(1, Math.round(spec.h * scale));
      const dx = Math.round((canvas.width - bounds.width * scale) / 2 - bounds.minX * scale);
      const dy = Math.round((canvas.height - bounds.height * scale) / 2 - bounds.minY * scale);
      const movement = selected.category === "unit"
        ? unitMovementOffset(selected.kind as UnitKind, frame)
        : null;
      const renderDx = dx + (movement?.swayX ?? 0) * scale;
      const renderDy = dy - (movement?.bobY ?? 0) * scale;
      const groundY = dy + dh;
      drawSprite(ctx, spec, image, renderDx, renderDy, dw, dh);
      if (movement && selected.category === "unit") {
        paintUnitMovementFx(ctx, selected.kind as UnitKind, renderDx, renderDy, dw, dh, groundY, scale, frame, 1);
      }
      if (selected.category === "building") {
        paintOverlay(ctx, selected.kind as BuildingKind, canvas.width / 2, canvas.height / 2, Math.max(1, scale), now);
      }
    };
    paint(0);
    const loop = (now: number) => {
      if (playing && now - last > 140) {
        frame = ((frame + 1) & 3) as AnimFrame;
        last = now;
      }
      paint(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [campaignProfile, construction, damage, facing, palette, playing, profile, selected, variant]);

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
          variant={variant}
          designFamily={designFamily}
          onFacing={setFacing}
          onPlaying={() => setPlaying((v) => !v)}
          onConstruction={setConstruction}
          onDamage={setDamage}
          onVariant={setVariant}
          onDesignFamily={setDesignFamily}
        />
      </div>
    </MetalPanel>
  );
}
