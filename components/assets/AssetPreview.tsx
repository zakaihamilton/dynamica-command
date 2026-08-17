import type { Ref } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { CatalogAsset } from "@/lib/gen/assetCatalog";
import type { Facing } from "@/lib/types";
import { AssetChip } from "./AssetChip";
import styles from "./AssetPreview.module.css";

const FACINGS: Facing[] = [0, 1, 2, 3, 4, 5, 6, 7];
const FACING_LABELS = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
const CONSTRUCTION = [0, 1, 2, 3] as const;
const DAMAGE = [0, 1, 2] as const;

export function AssetPreview({
  selected,
  canvasRef,
  facing,
  playing,
  construction,
  damage,
  variant,
  onFacing,
  onPlaying,
  onConstruction,
  onDamage,
  onVariant,
}: {
  selected: CatalogAsset;
  canvasRef: Ref<HTMLCanvasElement>;
  facing: Facing;
  playing: boolean;
  construction: 0 | 1 | 2 | 3;
  damage: 0 | 1 | 2;
  variant: number;
  onFacing: (dir: Facing) => void;
  onPlaying: () => void;
  onConstruction: (stage: 0 | 1 | 2 | 3) => void;
  onDamage: (stage: 0 | 1 | 2) => void;
  onVariant: (value: number) => void;
}) {
  const showFacing = selected.category === "unit";
  const showAnim = selected.category === "unit" || selected.category === "building";
  return (
    <div className={styles.pane}>
      <div className={styles.stage}>
        <canvas ref={canvasRef} width={420} height={280} className={styles.canvas} aria-label={`${selected.label} preview`} />
      </div>
      <div className={styles.controls}>
        <p className={styles.meta}>
          {selected.label}
          {showFacing ? ` · facing ${FACING_LABELS[facing]}` : ""}
          {showAnim && playing ? " · animating" : ""}
        </p>

        {showFacing ? (
          <div className={styles.group}>
            <ConsoleLabel>Facing</ConsoleLabel>
            <div className={styles.compass}>
              {FACINGS.map((dir) => (
                <AssetChip
                  key={dir}
                  active={facing === dir}
                  tooltip={`Face ${FACING_LABELS[dir]}`}
                  onClick={() => onFacing(dir)}
                >
                  {FACING_LABELS[dir]}
                </AssetChip>
              ))}
            </div>
          </div>
        ) : null}

        {showAnim ? (
          <ConsoleButton
            className={styles.play}
            tooltip={playing ? "Pause sprite animation" : "Play sprite animation"}
            shortcut={SHORTCUT.play}
            onClick={onPlaying}
          >
            {playing ? "Pause animation" : "Play animation"}
          </ConsoleButton>
        ) : null}

        {selected.category === "building" ? (
          <>
            <ConsoleLabel className={styles.group}>Construction</ConsoleLabel>
            <div className={styles.chips}>
              {CONSTRUCTION.map((stage) => (
                <AssetChip
                  key={stage}
                  active={construction === stage}
                  tooltip={`Construction stage ${stage}`}
                  onClick={() => onConstruction(stage)}
                >
                  {`Stage ${stage}`}
                </AssetChip>
              ))}
            </div>
            <ConsoleLabel className={styles.group}>Damage</ConsoleLabel>
            <div className={styles.chips}>
              {DAMAGE.map((stage) => (
                <AssetChip
                  key={stage}
                  active={damage === stage}
                  tooltip={`Damage stage ${stage}`}
                  onClick={() => onDamage(stage)}
                >
                  {`Dmg ${stage}`}
                </AssetChip>
              ))}
            </div>
          </>
        ) : null}

        {selected.category === "tile" ? (
          <div className={styles.group}>
            <ConsoleLabel>Variant</ConsoleLabel>
            <div className={styles.chips}>
              {[0, 2, 4, 7, 11].map((v) => (
                <AssetChip
                  key={v}
                  active={variant === v}
                  tooltip={`Terrain variant ${v}`}
                  onClick={() => onVariant(v)}
                >
                  {String(v)}
                </AssetChip>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
