"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "@/lib/ui/cx";
import {
  cinemaShotCamera,
  createCinemaScene,
  PREVIEW_INITIAL_DELAY_MS,
  PREVIEW_LOCK_COUNT,
  PREVIEW_LOCK_IDS,
  PREVIEW_SHOT_COUNT,
  previewAt,
  previewMissionIndex,
  previewScenarioKind,
  previewSeed,
  renderCinemaFrame,
  resetUnitTransformTracker,
  stepCinemaScene,
  type CinemaScene,
  type PreviewPhase,
  type Shot,
} from "./menuBackdropSim";
import { isTerrainAtlasReady, preloadTerrainAtlas } from "@/lib/render/terrainAtlas";
import { listTacticalRasterSources } from "@/lib/gen/visualAssets";
import { preloadRasterSources } from "@/lib/render/sprites";
import styles from "./MenuSignalOverlay.module.css";

const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FEED_WIDTH = 768;
const FEED_HEIGHT = 512;

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
  return (
    a.expanded !== b.expanded ||
    a.lockIndex !== b.lockIndex ||
    a.shotIndex !== b.shotIndex ||
    a.cycleIndex !== b.cycleIndex
  );
}

export function MenuSignalOverlay() {
  const reducedMotion = usePrefersReducedMotion();
  const [sessionOffset] = useState(() =>
    typeof window !== "undefined" && !navigator.userAgent.includes("jsdom")
      ? Math.floor(Math.random() * 60)
      : 0,
  );
  const [preview, setPreview] = useState<PreviewPhase>(() =>
    previewAt(0, PREVIEW_LOCK_COUNT, PREVIEW_SHOT_COUNT, PREVIEW_INITIAL_DELAY_MS, sessionOffset),
  );
  const previewRef = useRef<PreviewPhase>(preview);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null]);

  useEffect(() => {
    if (reducedMotion) return;

    resetUnitTransformTracker();
    const initialSeed = previewSeed(sessionOffset);
    let scene = createCinemaScene(
      initialSeed,
      previewMissionIndex(sessionOffset, initialSeed),
      previewScenarioKind(sessionOffset),
    );
    preloadTerrainAtlas(scene.ground);
    if (scene.state) preloadTerrainAtlas(scene.state);
    preloadRasterSources(listTacticalRasterSources());

    let nextScene: CinemaScene | null = null;
    let cycleIndex = sessionOffset;
    const shots: Shot[] = [];
    let raf = 0;
    let t = 0;
    const started = performance.now();

    const frame = (now: number) => {
      t += 1;
      const next = previewAt(
        now - started,
        PREVIEW_LOCK_COUNT,
        PREVIEW_SHOT_COUNT,
        PREVIEW_INITIAL_DELAY_MS,
        sessionOffset,
      );
      if (next.cycleIndex !== cycleIndex) {
        resetUnitTransformTracker();
        const seed = previewSeed(next.cycleIndex);
        scene = nextScene ?? createCinemaScene(
          seed,
          previewMissionIndex(next.cycleIndex, seed),
          previewScenarioKind(next.cycleIndex),
        );
        preloadTerrainAtlas(scene.ground);
        if (scene.state) preloadTerrainAtlas(scene.state);
        nextScene = null;
        shots.length = 0;
        cycleIndex = next.cycleIndex;
      } else if (!next.expanded && nextScene === null) {
        const nextSeed = previewSeed(next.cycleIndex + 1);
        nextScene = createCinemaScene(
          nextSeed,
          previewMissionIndex(next.cycleIndex + 1, nextSeed),
          previewScenarioKind(next.cycleIndex + 1),
        );
        preloadTerrainAtlas(nextScene.ground);
        if (nextScene.state) preloadTerrainAtlas(nextScene.state);
      }

      const terrainReady = scene.state ? isTerrainAtlasReady(scene.state) : isTerrainAtlasReady(scene.ground);
      const isExpanded = next.expanded && terrainReady;
      const effectivePreview: PreviewPhase = isExpanded === next.expanded ? next : { ...next, expanded: false };

      if (effectivePreview.expanded) {
        stepCinemaScene(scene, shots, t);
        const canvas = canvasRefs.current[effectivePreview.lockIndex];
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          if (canvas.width !== FEED_WIDTH) canvas.width = FEED_WIDTH;
          if (canvas.height !== FEED_HEIGHT) canvas.height = FEED_HEIGHT;
          renderCinemaFrame(ctx, canvas.width, canvas.height, t, scene, shots, {
            camera: cinemaShotCamera(scene, effectivePreview.shotIndex, canvas.width, canvas.height, t),
            paintAmbient: false,
          });
        }
      }
      if (previewChanged(previewRef.current, effectivePreview)) {
        previewRef.current = effectivePreview;
        setPreview(effectivePreview);
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
            data-seed={expanded ? String(previewSeed(preview.cycleIndex)) : undefined}
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
