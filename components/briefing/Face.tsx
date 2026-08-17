"use client";

import { memo, useEffect, useRef } from "react";
import { getPortraitAsset, type PortraitAsset } from "@/lib/gen/portraitCatalog";
import {
  drawPortraitBackdrop,
  drawPortraitClippedFrame,
  drawPortraitFrame,
  PORTRAIT_EYE_CLIPS,
  PORTRAIT_MEASURE_HEIGHT,
  PORTRAIT_MEASURE_WIDTH,
  PORTRAIT_MOUTH_CLIP,
  PORTRAIT_OFFSET_NONE,
  portraitBlinking,
  portraitFrameIndex,
  resolvePortraitAnimation,
  type FaceTone,
  type PortraitClip,
  type PortraitOffset,
} from "@/lib/render/portraits";
import type { Character } from "@/lib/types";
import styles from "./Face.module.css";

export const Face = memo(function Face({
  who,
  talking,
  tone,
}: {
  who: Character;
  talking: boolean;
  tone: FaceTone;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const whoRef = useRef(who);
  const talkingRef = useRef(talking);
  const toneRef = useRef(tone);
  const portraitRef = useRef<HTMLImageElement | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const offsetsRef = useRef<{ blink: PortraitOffset; talk: PortraitOffset }>({
    blink: PORTRAIT_OFFSET_NONE,
    talk: PORTRAIT_OFFSET_NONE,
  });
  const mouthClipRef = useRef<PortraitClip>(PORTRAIT_MOUTH_CLIP);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    whoRef.current = who;
    talkingRef.current = talking;
    toneRef.current = tone;
  }, [who, talking, tone]);

  useEffect(() => {
    const portraitId = who.face.portraitId;
    const asset = getPortraitAsset(portraitId);
    if (!asset) {
      portraitRef.current = null;
      loadedIdRef.current = null;
      offsetsRef.current = { blink: PORTRAIT_OFFSET_NONE, talk: PORTRAIT_OFFSET_NONE };
      mouthClipRef.current = PORTRAIT_MOUTH_CLIP;
      return;
    }
    if (loadedIdRef.current === portraitId && portraitRef.current?.complete) return;

    let active = true;
    const image = new Image();
    image.decoding = "async";
    const show = () => {
      if (!active) return;
      portraitRef.current = image;
      loadedIdRef.current = portraitId;
      const measured = measureLoadedPortraitOffsets(image, asset);
      offsetsRef.current = { blink: measured.blink, talk: measured.talk };
      mouthClipRef.current = measured.mouthClip;
    };
    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().then(show, show);
      } else {
        show();
      }
    };
    image.onerror = () => {
      if (!active) return;
      if (loadedIdRef.current === portraitId) {
        portraitRef.current = null;
        loadedIdRef.current = null;
        offsetsRef.current = { blink: PORTRAIT_OFFSET_NONE, talk: PORTRAIT_OFFSET_NONE };
        mouthClipRef.current = PORTRAIT_MOUTH_CLIP;
      }
    };
    image.src = asset.src;
    if (image.complete && image.naturalWidth > 0) show();
    return () => {
      active = false;
    };
  }, [who.face.portraitId]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = 200;
    const h = 240;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
    let t = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      t += Math.min(32, now - last) * (60 / 1000);
      last = now;
      const currentTone = toneRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = currentTone === "enemy" ? "#1c1210" : currentTone === "command" ? "#12160f" : "#10140c";
      ctx.fillRect(0, 0, w, h);
      const currentFace = whoRef.current.face;
      const asset = getPortraitAsset(currentFace.portraitId);
      const image = portraitRef.current;
      if (asset && image && loadedIdRef.current === currentFace.portraitId) {
        const talking = talkingRef.current;
        const frame = portraitFrameIndex(t, talking, asset.frameCount, currentFace.portraitId);
        drawPortraitFrame(ctx, image, asset, 0, 0, 0, w, h);
        if (talking && frame === 2) {
          drawPortraitClippedFrame(
            ctx,
            image,
            asset,
            2,
            0,
            0,
            w,
            h,
            [mouthClipRef.current],
            offsetsRef.current.talk,
            overlayRef.current ?? (overlayRef.current = document.createElement("canvas")),
          );
        }
        if (asset.frameCount >= 2 && portraitBlinking(t, currentFace.portraitId)) {
          drawPortraitClippedFrame(
            ctx,
            image,
            asset,
            1,
            0,
            0,
            w,
            h,
            PORTRAIT_EYE_CLIPS,
            offsetsRef.current.blink,
            overlayRef.current ?? (overlayRef.current = document.createElement("canvas")),
          );
        }
        ctx.fillStyle = currentTone === "enemy" ? "rgba(126, 48, 35, 0.08)" : "rgba(90, 218, 210, 0.035)";
        ctx.fillRect(0, 0, w, h);
      } else {
        drawPortraitBackdrop(ctx, w / 2, h / 2 - 2, w * 0.9, currentTone);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={200} height={240} className={styles.canvas} />;
});

function measureLoadedPortraitOffsets(image: HTMLImageElement, asset: PortraitAsset) {
  const fallback = {
    blink: PORTRAIT_OFFSET_NONE,
    talk: PORTRAIT_OFFSET_NONE,
    mouthClip: PORTRAIT_MOUTH_CLIP,
  };
  if (asset.frameCount < 2) return fallback;
  const canvas = document.createElement("canvas");
  canvas.width = PORTRAIT_MEASURE_WIDTH;
  canvas.height = PORTRAIT_MEASURE_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;

  const sample = (frame: number) => {
    ctx.clearRect(0, 0, PORTRAIT_MEASURE_WIDTH, PORTRAIT_MEASURE_HEIGHT);
    drawPortraitFrame(ctx, image, asset, frame, 0, 0, PORTRAIT_MEASURE_WIDTH, PORTRAIT_MEASURE_HEIGHT);
    return ctx.getImageData(0, 0, PORTRAIT_MEASURE_WIDTH, PORTRAIT_MEASURE_HEIGHT).data;
  };

  const idle = sample(0);
  const blinkFrame = sample(1);
  const talkFrame = asset.frameCount >= 3 ? sample(2) : null;
  return resolvePortraitAnimation(idle, blinkFrame, talkFrame, PORTRAIT_MEASURE_WIDTH, PORTRAIT_MEASURE_HEIGHT);
}
