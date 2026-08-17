import type { PointerEventHandler, Ref } from "react";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./MinimapFrame.module.css";

export function MinimapFrame({
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  canvasRef: Ref<HTMLCanvasElement>;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
}) {
  return (
    <div className={styles.host} data-tooltip="Tactical radar. Click or drag to pan. H jumps to the yard." data-shortcut={SHORTCUT.home}>
      <div className={styles.frame}>
        <canvas
          ref={canvasRef}
          width={224}
          height={160}
          className={styles.canvas}
          aria-label="Tactical minimap. Click or drag to move the camera."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <span className={styles.sweep} aria-hidden />
      </div>
    </div>
  );
}
