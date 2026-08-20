import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BriefingLine } from "@/lib/types";
import { briefingRevealedLines } from "./briefingWrap";

const CHAR_MS = 40;
const CHAR_BATCH = 2;

export function useBriefingTypewriter(lines: BriefingLine[], onComplete?: () => void) {
  const [shown, setShown] = useState(0);
  const [playId, setPlayId] = useState(0);
  const storyRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(0);
  const completedRef = useRef(false);
  const totalChars = lines.reduce((n, line) => n + line.text.length, 0);
  const resetKey = `${playId}:${totalChars}`;
  const [activeKey, setActiveKey] = useState(resetKey);
  if (activeKey !== resetKey) {
    setActiveKey(resetKey);
    setShown(0);
  }
  const displayShown = activeKey !== resetKey ? 0 : shown;

  const replayTransmission = useCallback(() => {
    shownRef.current = 0;
    completedRef.current = false;
    setShown(0);
    setPlayId((n) => n + 1);
  }, []);

  const skipToEnd = useCallback(() => {
    shownRef.current = totalChars;
    setShown(totalChars);
  }, [totalChars]);

  useEffect(() => {
    shownRef.current = displayShown;
  }, [displayShown]);

  useEffect(() => {
    completedRef.current = false;
  }, [playId, totalChars]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    let stopped = false;
    const step = (now: number) => {
      if (stopped) return;
      if (shownRef.current >= totalChars) return;
      const dt = Math.min(100, now - last);
      last = now;
      carry += dt / CHAR_MS;
      if (carry >= CHAR_BATCH || shownRef.current + Math.floor(carry) >= totalChars) {
        const add = Math.max(1, Math.floor(carry));
        carry -= add;
        const next = Math.min(totalChars, shownRef.current + add);
        shownRef.current = next;
        setShown(next);
        if (next >= totalChars) return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [playId, totalChars]);

  useEffect(() => {
    if (displayShown < totalChars || completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [displayShown, totalChars, onComplete]);

  useLayoutEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [displayShown]);

  const revealedLines = briefingRevealedLines(lines, displayShown);
  const visibleLines = revealedLines.filter((line) => line.started);
  const isComplete = displayShown >= totalChars;
  const isTalking = displayShown > 0 && !isComplete;

  return {
    shown: displayShown,
    totalChars,
    storyRef,
    visibleLines,
    revealedLines,
    isTalking,
    isComplete,
    replayTransmission,
    skipToEnd,
  };
}
