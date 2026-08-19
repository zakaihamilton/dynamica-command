import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BriefingLine } from "@/lib/types";

export function useBriefingTypewriter(lines: BriefingLine[], onComplete?: () => void) {
  const [shown, setShown] = useState(0);
  const [playId, setPlayId] = useState(0);
  const storyRef = useRef<HTMLDivElement>(null);
  const totalChars = lines.reduce((n, line) => n + line.text.length, 0);

  const replayTransmission = useCallback(() => {
    setShown(0);
    setPlayId((n) => n + 1);
  }, []);

  const skipToEnd = useCallback(() => {
    setShown(totalChars);
  }, [totalChars]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= totalChars) {
          window.clearInterval(id);
          onComplete?.();
          return n;
        }
        return n + 1;
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [totalChars, playId, onComplete]);

  useLayoutEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [shown]);

  const revealedLines = lines.map((line, index) => {
    const consumed = lines.slice(0, index).reduce((sum, item) => sum + item.text.length, 0);
    const chars = Math.max(0, Math.min(line.text.length, shown - consumed));
    return {
      ...line,
      visible: line.text.slice(0, chars),
      started: chars > 0,
      complete: chars >= line.text.length,
    };
  });

  const visibleLines = revealedLines.filter((line) => line.started);
  const isComplete = shown >= totalChars;
  const isTalking = shown > 0 && !isComplete;

  return {
    shown,
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
