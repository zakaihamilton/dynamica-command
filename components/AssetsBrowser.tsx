"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildingSprite, rubbleSprite, tileSprite, unitSprite, wreckSprite } from "@/lib/gen/assets";
import { listGeneratedAssets, type CatalogAsset } from "@/lib/gen/assetCatalog";
import { buildingAnim } from "@/lib/render/anim";
import { drawSprite, rasterize } from "@/lib/render/sprites";
import { assetsCommandFromKey, isEditableTarget, SHORTCUT } from "@/lib/ui/shortcuts";
import type {
  AnimFrame,
  BuildingKind,
  Entity,
  Facing,
  Palette,
  UnitKind,
} from "@/lib/types";

const FACINGS: Facing[] = [0, 1, 2, 3, 4, 5, 6, 7];
const FACING_LABELS = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
const CONSTRUCTION = [0, 1, 2, 3] as const;
const DAMAGE = [0, 1, 2] as const;

const CATEGORY_LABEL: Record<CatalogAsset["category"], string> = {
  unit: "Units",
  building: "Buildings",
  tile: "Ground",
  wreck: "Wrecks",
  rubble: "Rubble",
};

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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setFacing(0);
    setConstruction(3);
    setDamage(0);
    setPlaying(true);
  }, [selectedId]);

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
          ? unitSprite(selected.kind as UnitKind, palette, { facing, animationFrame: frame, variant: 11 })
          : selected.category === "building"
            ? buildingSprite(selected.kind as BuildingKind, palette, {
                constructionStage: construction,
                damageStage: damage,
                variant: 13,
              })
            : selected.category === "wreck"
              ? wreckSprite(selected.kind as UnitKind, palette)
              : selected.category === "rubble"
                ? rubbleSprite(selected.kind as BuildingKind, palette)
                : tileSprite(selected.tileKind ?? "clear", 1, {
                    biome: selected.biome ?? "ash plains",
                    variant,
                    contour: selected.tileKind === "water" ? "bank" : "none",
                  });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const image = rasterize(spec);
      const scale = Math.min(canvas.width / spec.w, canvas.height / spec.h) * 0.86;
      const dw = Math.max(1, Math.round(spec.w * scale));
      const dh = Math.max(1, Math.round(spec.h * scale));
      const dx = Math.round((canvas.width - dw) / 2);
      const dy = Math.round((canvas.height - dh) / 2);
      drawSprite(ctx, spec, image, dx, dy, dw, dh);
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
  }, [construction, damage, facing, palette, playing, selected, variant]);

  if (!selected) return null;
  const showFacing = selected.category === "unit";
  const showAnim = selected.category === "unit" || selected.category === "building";

  return (
    <div className="metal-panel assets-browser p-4" data-testid="assets-browser" role="dialog" aria-labelledby="assets-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="console-label">Genesis Command</p>
          <h2 id="assets-title" className="mt-1 text-2xl font-black uppercase tracking-[0.12em] text-[var(--chrome-text)]">
            Asset bay
          </h2>
        </div>
        <button type="button" className="console-button console-button-muted has-tooltip" data-tooltip="Close asset bay" data-shortcut={SHORTCUT.close} onClick={onClose}>
          Close
        </button>
      </div>

      <div className="assets-browser-body mt-4 min-h-0">
        <div className="assets-list-pane">
          <p className="console-label mb-2">All generated assets</p>
          <div className="assets-list" role="listbox" aria-label="Generated assets">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              role="option"
              aria-selected={asset.id === selected.id}
              className={`assets-list-item has-tooltip ${asset.id === selected.id ? "assets-list-item-active" : ""}`}
              data-tooltip={`${CATEGORY_LABEL[asset.category]} · ${asset.label}`}
              data-tooltip-pos="right"
              onClick={() => setSelectedId(asset.id)}
            >
              <span className="assets-list-cat">{CATEGORY_LABEL[asset.category]}</span>
              <span className="assets-list-name">{asset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="assets-preview-pane">
        <div className="assets-preview-stage">
          <canvas ref={canvasRef} width={420} height={280} className="pixel-canvas h-full w-full" aria-label={`${selected.label} preview`} />
        </div>
        <div className="assets-controls">
        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--chrome-muted)]">
          {selected.label}
          {showFacing ? ` · facing ${FACING_LABELS[facing]}` : ""}
          {showAnim && playing ? " · animating" : ""}
        </p>

        {showFacing ? (
          <div className="mt-3">
            <p className="console-label">Facing</p>
            <div className="assets-compass mt-2">
              {FACINGS.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className={`assets-chip has-tooltip ${facing === dir ? "assets-chip-active" : ""}`}
                  data-tooltip={`Face ${FACING_LABELS[dir]}`}
                  onClick={() => setFacing(dir)}
                >
                  {FACING_LABELS[dir]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showAnim ? (
          <button
            type="button"
            className="console-button mt-3 has-tooltip w-full"
            data-tooltip={playing ? "Pause sprite animation" : "Play sprite animation"}
            data-shortcut={SHORTCUT.play}
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? "Pause animation" : "Play animation"}
          </button>
        ) : null}

        {selected.category === "building" ? (
          <>
            <p className="console-label mt-3">Construction</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CONSTRUCTION.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className={`assets-chip has-tooltip ${construction === stage ? "assets-chip-active" : ""}`}
                  data-tooltip={`Construction stage ${stage}`}
                  onClick={() => setConstruction(stage)}
                >
                  Stage {stage}
                </button>
              ))}
            </div>
            <p className="console-label mt-3">Damage</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAMAGE.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className={`assets-chip has-tooltip ${damage === stage ? "assets-chip-active" : ""}`}
                  data-tooltip={`Damage stage ${stage}`}
                  onClick={() => setDamage(stage)}
                >
                  Dmg {stage}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {selected.category === "tile" ? (
          <div className="mt-3">
            <p className="console-label">Variant</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 2, 4, 7, 11].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`assets-chip has-tooltip ${variant === v ? "assets-chip-active" : ""}`}
                  data-tooltip={`Terrain variant ${v}`}
                  onClick={() => setVariant(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}
