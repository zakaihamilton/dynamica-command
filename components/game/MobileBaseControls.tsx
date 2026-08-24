import type { PointerEventHandler, Ref } from "react";
import { MinimapFrame } from "./MinimapFrame";
import { ResourceDock } from "./ResourceDock";
import styles from "./MobileCommandTray.module.css";

export function MobileBaseControls({
  repairMode,
  sellMode,
  credits,
  produced,
  used,
  surplus,
  miniRef,
  onMinimapPointerDown,
  onMinimapPointerMove,
  onMinimapPointerUp,
  isMinimapDragging,
}: {
  repairMode: boolean;
  sellMode: boolean;
  credits: number;
  produced: number;
  used: number;
  surplus: number;
  miniRef: Ref<HTMLCanvasElement>;
  onMinimapPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onMinimapPointerUp: PointerEventHandler<HTMLCanvasElement>;
  isMinimapDragging: boolean;
}) {
  return (
    <section className={styles.section} data-testid="mobile-base-controls">
      <div className={styles.sectionHeader}>
        <span className={styles.eyebrow}>Theater systems</span>
        <span className={styles.activeCommand}>{repairMode ? "Repair mode" : sellMode ? "Sell mode" : "Base overview"}</span>
      </div>
      <div className={styles.resources}>
        <ResourceDock credits={credits} produced={produced} used={used} surplus={surplus} />
      </div>
      <MinimapFrame
        canvasRef={miniRef}
        onPointerDown={onMinimapPointerDown}
        onPointerMove={onMinimapPointerMove}
        onPointerUp={onMinimapPointerUp}
        isDragging={isMinimapDragging}
      />
    </section>
  );
}
