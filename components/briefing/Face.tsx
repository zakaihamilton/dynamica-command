"use client";

import { memo, useEffect, useRef } from "react";
import { drawFace, type FaceTone } from "@/lib/render/faces";
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

  useEffect(() => {
    whoRef.current = who;
    talkingRef.current = talking;
    toneRef.current = tone;
  }, [who, talking, tone]);

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
    let t = 0;
    let raf = 0;
    const loop = () => {
      t += 1;
      const currentTone = toneRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = currentTone === "enemy" ? "#1c1210" : currentTone === "command" ? "#12160f" : "#10140c";
      ctx.fillRect(0, 0, w, h);
      drawFace(ctx, whoRef.current.face, w / 2, h / 2 - 2, w * 0.9, t, talkingRef.current, currentTone);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={200} height={240} className={styles.canvas} />;
});
