"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseTooltipPos, placeTooltip, type TooltipPos } from "@/lib/ui/tooltip";

type TipState = {
  text: string;
  pos: TooltipPos;
  anchor: DOMRect;
};

function tooltipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  return node.closest("[data-tooltip]");
}

export function TooltipLayer() {
  const [mounted, setMounted] = useState(false);
  const [tip, setTip] = useState<TipState | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLElement | null>(null);
  const forcedRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const forcedEl = () => document.querySelector("[data-tooltip-open]") as HTMLElement | null;

    const paint = () => {
      const el = forcedEl() ?? hoverRef.current;
      forcedRef.current = forcedEl();
      if (!el) {
        setTip(null);
        return;
      }
      const text = el.getAttribute("data-tooltip");
      if (!text) {
        setTip(null);
        return;
      }
      setTip({
        text,
        pos: parseTooltipPos(el.getAttribute("data-tooltip-pos")),
        anchor: el.getBoundingClientRect(),
      });
    };

    const onOver = (e: PointerEvent) => {
      const el = tooltipTarget(e.target);
      if (!el) return;
      hoverRef.current = el;
      paint();
    };

    const onOut = (e: PointerEvent) => {
      const el = tooltipTarget(e.target);
      if (!el || el !== hoverRef.current) return;
      const next = tooltipTarget(e.relatedTarget);
      if (next === el) return;
      hoverRef.current = next;
      paint();
    };

    const onFocus = (e: FocusEvent) => {
      const el = tooltipTarget(e.target);
      if (!el) return;
      hoverRef.current = el;
      paint();
    };

    const onBlur = (e: FocusEvent) => {
      if (hoverRef.current && !hoverRef.current.contains(e.relatedTarget as Node | null) && hoverRef.current !== forcedEl()) {
        if (tooltipTarget(e.target) === hoverRef.current) hoverRef.current = null;
        paint();
      }
    };

    const onScrollOrResize = () => paint();

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    const mo = new MutationObserver(paint);
    mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-tooltip", "data-tooltip-pos", "data-tooltip-open"] });
    paint();
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      mo.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node || !tip) return;
    const size = node.getBoundingClientRect();
    const next = placeTooltip(tip.anchor, size, tip.pos, { width: window.innerWidth, height: window.innerHeight });
    node.style.top = `${next.top}px`;
    node.style.left = `${next.left}px`;
  }, [tip]);

  if (!mounted || !tip) return null;
  return createPortal(
    <div ref={nodeRef} className="console-tooltip" role="tooltip" style={{ top: -9999, left: -9999 }}>
      {tip.text}
    </div>,
    document.body,
  );
}
