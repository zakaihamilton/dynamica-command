import { useEffect, useMemo, useRef, useState } from "react";
import { listGeneratedAssets } from "@/lib/gen/assetCatalog";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { assetsCommandFromKey, isEditableTarget } from "@/lib/ui/shortcuts";
import type { Facing, FactionVisualProfile } from "@/lib/types";

export function useAssetsBrowser(onClose: () => void) {
  const assets = useMemo(() => listGeneratedAssets(), []);
  const [selectedId, setSelectedId] = useState(assets[0]?.id ?? "");
  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0];
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
        setPlaying((value) => !value);
        return;
      }
      const index = assets.findIndex((asset) => asset.id === selectedId);
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

  return {
    assets,
    selected,
    facing,
    playing,
    construction,
    damage,
    designFamily,
    canvasRef,
    profile,
    selectAsset,
    setFacing,
    setPlaying,
    setConstruction,
    setDamage,
    setDesignFamily,
  };
}
