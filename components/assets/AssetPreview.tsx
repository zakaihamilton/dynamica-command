import type { Ref } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import type { CatalogAsset } from "@/lib/gen/assetCatalog";
import type { Facing, FactionVisualProfile } from "@/lib/types";
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

        {selected.category === "unit" || selected.category === "building" ? (
          <div className={styles.group}>
            <ConsoleLabel>Faction design</ConsoleLabel>
            <div className={styles.chips}>
              {([0, 1, 2] as const).map((family) => (
                <AssetChip
                  key={family}
                  active={designFamily === family}
                  tooltip={["Angular vanguard", "Heavy fortress", "Industrial utility"][family]!}
                  onClick={() => onDesignFamily(family)}
                >
                  {`Family ${family + 1}`}
                </AssetChip>
              ))}
            </div>
          </div>
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
      </div>
    </div>
  );
}
