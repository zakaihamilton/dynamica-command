"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "@/lib/ui/cx";
import {
  cinemaShotCamera,
  createCinemaScene,
  PREVIEW_LOCK_IDS,
  previewAt,
  renderCinemaFrame,
  stepCinemaScene,
  type PreviewPhase,
  type Shot,
} from "./menuBackdropSim";
import styles from "./MenuSignalOverlay.module.css";

const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FEED_WIDTH = 240;
const FEED_HEIGHT = 152;

function subscribeReduceMotion(onStoreChange: () => void) {
  const media = window.matchMedia?.(REDUCE_MOTION_QUERY);
  if (!media) return () => {};
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function reduceMotionSnapshot() {
  return window.matchMedia?.(REDUCE_MOTION_QUERY)?.matches ?? false;
}

function reduceMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduceMotion, reduceMotionSnapshot, reduceMotionServerSnapshot);
}

function previewChanged(a: PreviewPhase, b: PreviewPhase): boolean {
  return a.expanded !== b.expanded || a.lockIndex !== b.lockIndex || a.shotIndex !== b.shotIndex;
}

export function MenuSignalOverlay() {
  const reducedMotion = usePrefersReducedMotion();
  const [preview, setPreview] = useState<PreviewPhase>(() => previewAt(0));
  const previewRef = useRef<PreviewPhase>(preview);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null]);

  useEffect(() => {
    if (reducedMotion) return;

    const scene = createCinemaScene();
    const shots: Shot[] = [];
    let raf = 0;
    let t = 0;
    const started = performance.now();

    const frame = (now: number) => {
      t += 1;
      stepCinemaScene(scene, shots, t);
      const next = previewAt(now - started);
      if (next.expanded) {
        const canvas = canvasRefs.current[next.lockIndex];
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          if (canvas.width !== FEED_WIDTH) canvas.width = FEED_WIDTH;
          if (canvas.height !== FEED_HEIGHT) canvas.height = FEED_HEIGHT;
          renderCinemaFrame(ctx, canvas.width, canvas.height, t, scene, shots, {
            camera: cinemaShotCamera(scene, next.shotIndex, canvas.width, canvas.height, t),
            paintAmbient: false,
            useTerrainCache: false,
          });
        }
      }
      if (previewChanged(previewRef.current, next)) {
        previewRef.current = next;
        setPreview(next);
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  return (
    <div
      className={cx(styles.overlay, reducedMotion && styles.static)}
      data-testid="menu-signal-overlay"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-hidden
    >
      <div className={styles.crt} />
      <div className={styles.grid} />
      <div className={styles.sweep} />
      {PREVIEW_LOCK_IDS.map((id, index) => {
        const expanded = !reducedMotion && preview.expanded && preview.lockIndex === index;
        return (
          <span
            key={id}
            className={styles.lock}
            data-lock={id}
            data-expanded={expanded ? "true" : "false"}
            data-shot={expanded ? String(preview.shotIndex) : undefined}
          >
            {!reducedMotion ? (
              <canvas
                ref={(node) => {
                  canvasRefs.current[index] = node;
                }}
                className={styles.feed}
                width={FEED_WIDTH}
                height={FEED_HEIGHT}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
