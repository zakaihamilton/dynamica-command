"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseTooltipPos, placeTooltip, tooltipMaxBox, type TooltipPos } from "@/lib/ui/tooltip";
import styles from "./TooltipLayer.module.css";

type TipState = {
  text: string;
  shortcut: string | null;
  pos: TooltipPos;
  anchor: DOMRect;
};

function tooltipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  return node.closest("[data-tooltip]");
}

export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLElement | null>(null);
  const forcedRef = useRef<HTMLElement | null>(null);
  const keyboardDismissedRef = useRef(false);

  useEffect(() => {
    const forcedEl = () => document.querySelector("[data-tooltip-open]") as HTMLElement | null;

    const paint = () => {
      if (keyboardDismissedRef.current) {
        setTip(null);
        return;
      }
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
      const shortcut = el.getAttribute("data-shortcut");
      setTip({
        text,
        shortcut: shortcut && shortcut.trim() ? shortcut.trim() : null,
        pos: parseTooltipPos(el.getAttribute("data-tooltip-pos")),
        anchor: el.getBoundingClientRect(),
      });
    };

    const onOver = (e: PointerEvent) => {
      const el = tooltipTarget(e.target);
      if (!el) return;
      keyboardDismissedRef.current = false;
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
      keyboardDismissedRef.current = false;
      hoverRef.current = el;
      paint();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (["Alt", "Control", "Meta", "Shift"].includes(e.key)) return;
      keyboardDismissedRef.current = true;
      hoverRef.current = null;
      forcedRef.current = null;
      setTip(null);
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
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    const mo = new MutationObserver(paint);
    mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-tooltip", "data-tooltip-pos", "data-tooltip-open", "data-shortcut"] });
    paint();
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      mo.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node || !tip) return;
    const view = { width: window.innerWidth, height: window.innerHeight };
    const max = tooltipMaxBox(view);
    node.style.maxWidth = `${max.width}px`;
    node.style.maxHeight = `${max.height}px`;
    const size = node.getBoundingClientRect();
    const next = placeTooltip(tip.anchor, { width: size.width, height: size.height }, tip.pos, view);
    node.style.top = `${next.top}px`;
    node.style.left = `${next.left}px`;
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={nodeRef} className={styles.tooltip} role="tooltip" style={{ top: -9999, left: -9999 }}>
      <span className={styles.text}>{tip.text}</span>
      {tip.shortcut ? <kbd className={styles.kbd}>{tip.shortcut}</kbd> : null}
    </div>,
    document.body,
  );
}
