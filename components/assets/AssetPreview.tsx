import type { Ref } from "react";
import type { CatalogAsset } from "@/lib/gen/assetCatalog";
import type { Facing, FactionVisualProfile } from "@/lib/types";
import { AssetPreviewControls } from "./AssetPreviewControls";
import styles from "./AssetPreview.module.css";

export function AssetPreview({
  selected,
  canvasRef,
  facing,
  playing,
  construction,
  damage,
  designFamily,
  onFacing,
  onPlaying,
  onConstruction,
  onDamage,
  onDesignFamily,
}: {
  selected: CatalogAsset;
  canvasRef: Ref<HTMLCanvasElement>;
  facing: Facing;
  playing: boolean;
  construction: 0 | 1 | 2 | 3;
  damage: 0 | 1 | 2;
  designFamily: FactionVisualProfile["designFamily"];
  onFacing: (dir: Facing) => void;
  onPlaying: () => void;
  onConstruction: (stage: 0 | 1 | 2 | 3) => void;
  onDamage: (stage: 0 | 1 | 2) => void;
  onDesignFamily: (value: FactionVisualProfile["designFamily"]) => void;
}) {
  return (
    <div className={styles.pane}>
      <div className={styles.stage}>
        <canvas ref={canvasRef} width={420} height={280} className={styles.canvas} aria-label={`${selected.label} preview`} />
      </div>
      <AssetPreviewControls
        selected={selected}
        facing={facing}
        playing={playing}
        construction={construction}
        damage={damage}
        designFamily={designFamily}
        onFacing={onFacing}
        onPlaying={onPlaying}
        onConstruction={onConstruction}
        onDamage={onDamage}
        onDesignFamily={onDesignFamily}
      />
    </div>
  );
}
