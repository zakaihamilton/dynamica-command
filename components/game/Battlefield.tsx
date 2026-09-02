import type { CSSProperties, PointerEventHandler, ReactNode, Ref } from "react";
import type { PanAvailability, PanDir } from "@/lib/render/camera";
import { biomeArt } from "@/lib/gen/visualAssets";
import type { MissionObjective } from "@/lib/gen/story";
import type { BiomeName } from "@/lib/types";
import { BattlefieldHud } from "./BattlefieldHud";
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
  timeRemaining,
  convoyDeparture,
  briefingObjectives,
  showHud = true,
  biome,
  children,
  onPointerDown,
  onPointerMove,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
  onPointerCancel,
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
  timeRemaining?: string;
  convoyDeparture?: string;
  briefingObjectives?: MissionObjective[];
  showHud?: boolean;
  biome: BiomeName;
  children?: ReactNode;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerEnter: PointerEventHandler<HTMLCanvasElement>;
  onPointerLeave: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>;
}) {
  return (
    <div
      ref={hostRef}
      className={styles.root}
      style={{ "--scene-art": `url("${biomeArt(biome)}")` } as CSSProperties}
    >
      <canvas
        ref={canvasRef}
        data-testid="battlefield-canvas"
        width={width}
        height={height}
        className={styles.canvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
      <ScrollArrow dir="left" available={panAvail.left} hot={hotPan === "left"} />
      <ScrollArrow dir="right" available={panAvail.right} hot={hotPan === "right"} />
      <ScrollArrow dir="up" available={panAvail.up} hot={hotPan === "up"} />
      <ScrollArrow dir="down" available={panAvail.down} hot={hotPan === "down"} />
      {showHud ? (
        <BattlefieldHud
          seed={seed}
          levelNumber={levelNumber}
          levelCount={levelCount}
          missionName={missionName}
          objective={objective}
          timeRemaining={timeRemaining}
          convoyDeparture={convoyDeparture}
          briefingObjectives={briefingObjectives}
        />
      ) : null}
      {children}
    </div>
  );
}
