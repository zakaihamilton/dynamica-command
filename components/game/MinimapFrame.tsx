import type { PointerEventHandler, Ref } from "react";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./MinimapFrame.module.css";

export function MinimapFrame({
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isDragging,
}: {
  canvasRef: Ref<HTMLCanvasElement>;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  isDragging: boolean;
}) {
  return (
    <div className={styles.host} data-tooltip="Minimap. Click or drag to look around. Press H to jump to your base." data-shortcut={SHORTCUT.home}>
      <div className={styles.frame}>
        <canvas
          ref={canvasRef}
          width={224}
          height={160}
          className={styles.canvas}
          data-testid="tactical-radar"
          data-dragging={isDragging ? "true" : undefined}
          role="img"
          tabIndex={0}
          aria-label="Minimap. Click or drag to look around. Press H to jump to your base."
          aria-describedby="tactical-radar-help"
          aria-keyshortcuts="H"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <span className={styles.sweep} aria-hidden />
      </div>
      <p id="tactical-radar-help" className={styles.help}>
        Click to look around · drag to pan · H jumps home
      </p>
    </div>
  );
}
