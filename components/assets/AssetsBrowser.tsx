"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listGeneratedAssets } from "@/lib/gen/assetCatalog";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { assetsCommandFromKey, isEditableTarget } from "@/lib/ui/shortcuts";
import { MetalPanel } from "@/components/ui/MetalPanel";
import type { Facing, FactionVisualProfile, Palette } from "@/lib/types";
import { AssetList } from "./AssetList";
import { AssetPreview } from "./AssetPreview";
import { AssetsBayHeader } from "./AssetsBayHeader";
import { useAssetBayPreview } from "./useAssetBayPreview";
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

  useAssetBayPreview({
    canvasRef,
    selected,
    palette,
    profile,
    facing,
    playing,
    construction,
    damage,
  });

  if (!selected) return null;

  return (
    <MetalPanel className={styles.browser} data-testid="assets-browser" role="dialog" aria-labelledby="assets-title">
      <AssetsBayHeader onClose={onClose} />

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
