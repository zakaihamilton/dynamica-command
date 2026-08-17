"use client";

import { useEffect, useRef } from "react";
import { drawFace, type FaceTone } from "@/lib/render/faces";
import type { Character } from "@/lib/types";
import styles from "./Face.module.css";

export function Face({
  who,
  talking,
  tone,
}: {
  who: Character;
  talking: boolean;
  tone: FaceTone;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawFace(ctx, who.face, w / 2, h / 2 - 2, w * 0.9, t, talking, tone);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [who, talking, tone]);
  return <canvas ref={ref} width={200} height={240} className={styles.canvas} />;
}
