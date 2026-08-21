import type { PointerEventHandler, Ref } from "react";
import { SHORTCUT } from "@/lib/ui/shortcuts";
import styles from "./MinimapFrame.module.css";

export function MinimapFrame({
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isDragging,
  friendlyColor,
  hostileColor,
}: {
  canvasRef: Ref<HTMLCanvasElement>;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  isDragging: boolean;
  friendlyColor: string;
  hostileColor: string;
}) {
  return (
    <div className={styles.host} data-tooltip="Tactical radar. Click or drag to pan. H jumps to the yard." data-shortcut={SHORTCUT.home}>
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
          aria-label="Tactical radar. Click to focus the camera or drag to pan."
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
        Click to focus · drag to pan · H home
      </p>
      <div className={styles.legend} aria-label="Tactical radar legend">
        <span className={styles.legendItem}><span className={styles.swatch} style={{ backgroundColor: friendlyColor }} aria-hidden />ALLY</span>
        <span className={styles.legendItem}><span className={styles.swatch} style={{ backgroundColor: hostileColor }} aria-hidden />HOSTILE</span>
        <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.selectedSwatch}`} aria-hidden />SELECTED</span>
        <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.objectiveSwatch}`} aria-hidden />OBJECTIVE</span>
        <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.viewSwatch}`} aria-hidden />VIEW</span>
      </div>
    </div>
  );
}
