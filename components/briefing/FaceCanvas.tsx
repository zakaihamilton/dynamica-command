"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { getPortraitAsset } from "@/lib/gen/portraitCatalog";
import {
  drawPortraitBackdrop,
  drawPortraitClippedFrame,
  drawPortraitFrame,
  PORTRAIT_EYE_CLIPS,
  portraitBlinking,
  portraitSpeechFrame,
  type FaceTone,
} from "@/lib/render/portraits";
import type { Character } from "@/lib/types";
import type { FacePortrait } from "./useFacePortrait";
import styles from "./Face.module.css";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function FaceCanvas({
  who,
  talking,
  tone,
  portrait,
}: {
  who: Character;
  talking: boolean;
  tone: FaceTone;
  portrait: FacePortrait;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const whoRef = useRef(who);
  const talkingRef = useRef(talking);
  const toneRef = useRef(tone);

  useIsomorphicLayoutEffect(() => {
    whoRef.current = who;
    talkingRef.current = talking;
    toneRef.current = tone;
  }, [talking, tone, who]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = 200;
    const h = 240;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
    let t = 0;
    let last = performance.now();
    let raf = 0;
    let lastSig = "";
    const loop = (now: number) => {
      t += Math.min(32, now - last) * (60 / 1000);
      last = now;
      const currentTone = toneRef.current;
      const currentFace = whoRef.current.face;
      const asset = getPortraitAsset(currentFace.portraitId);
      const image = portrait.imageRef.current;
      const loaded = Boolean(asset && image && portrait.loadedIdRef.current === currentFace.portraitId);
      const speaking = talkingRef.current;
      const mouthOpen = Boolean(
        loaded && asset && speaking && portraitSpeechFrame(t, currentFace.portraitId, asset.frameCount) === 2,
      );
      const blinking = Boolean(loaded && asset && asset.frameCount >= 2 && portraitBlinking(t, currentFace.portraitId));
      const sig = `${currentFace.portraitId}:${loaded}:${speaking}:${mouthOpen}:${blinking}:${currentTone}`;
      if (sig === lastSig) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastSig = sig;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = currentTone === "enemy" ? "#1c1210" : currentTone === "command" ? "#12160f" : "#10140c";
      ctx.fillRect(0, 0, w, h);
      if (asset && image && loaded) {
        drawPortraitFrame(ctx, image, asset, 0, 0, 0, w, h);
        if (mouthOpen) {
          drawPortraitClippedFrame(
            ctx,
            image,
            asset,
            2,
            0,
            0,
            w,
            h,
            [portrait.mouthClipRef.current],
            portrait.offsetsRef.current.talk,
            portrait.overlayRef.current ?? (portrait.overlayRef.current = document.createElement("canvas")),
          );
        }
        if (blinking) {
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
            portrait.offsetsRef.current.blink,
            portrait.overlayRef.current ?? (portrait.overlayRef.current = document.createElement("canvas")),
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
  }, [portrait]);

  return <canvas ref={ref} width={200} height={240} className={styles.canvas} data-testid="briefing-portrait" />;
}
