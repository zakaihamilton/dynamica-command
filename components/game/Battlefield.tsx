import type { CSSProperties, PointerEventHandler, ReactNode, Ref } from "react";
import type { PanAvailability, PanDir } from "@/lib/render/camera";
import { formatSeed } from "@/lib/seed/rng";
import { biomeArt } from "@/lib/gen/visualAssets";
import type { BiomeName } from "@/lib/types";
import { ScrollArrow } from "./ScrollArrow";
import styles from "./Battlefield.module.css";

export function Battlefield({
  hostRef,
  canvasRef,
  width,
  height,
  panAvail,
  hotPan,
  seed,
  levelNumber,
  levelCount,
  missionName,
  objective,
  biome,
  children,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onPointerUp,
}: {
  hostRef: Ref<HTMLDivElement>;
  canvasRef: Ref<HTMLCanvasElement>;
  width: number;
  height: number;
  panAvail: PanAvailability;
  hotPan: PanDir | null;
  seed: number;
  levelNumber: number;
  levelCount: number;
  missionName: string;
  objective: string;
  biome: BiomeName;
  children?: ReactNode;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerLeave: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
}) {
  return (
    <div
      ref={hostRef}
      className={styles.root}
      style={{ "--scene-art": `url("${biomeArt(biome)}")` } as CSSProperties}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerUp={onPointerUp}
      />
      <ScrollArrow dir="left" available={panAvail.left} hot={hotPan === "left"} />
      <ScrollArrow dir="right" available={panAvail.right} hot={hotPan === "right"} />
      <ScrollArrow dir="up" available={panAvail.up} hot={hotPan === "up"} />
      <ScrollArrow dir="down" available={panAvail.down} hot={hotPan === "down"} />
      <div className={styles.status}>
        <div>
          <div className={styles.missionMeta}>
            <div className={styles.seed} data-testid="seed">Seed {formatSeed(seed)}</div>
            <div className={styles.level} data-testid="level-progress">
              Level {levelNumber} of {levelCount}
            </div>
          </div>
          <div className={styles.mission}>{missionName}</div>
        </div>
        <div className={styles.objective} data-testid="objective">
          {objective}
        </div>
      </div>
      {children}
    </div>
  );
}
