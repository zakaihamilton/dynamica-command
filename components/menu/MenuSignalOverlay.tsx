"use client";

import { useSyncExternalStore } from "react";
import { cx } from "@/lib/ui/cx";
import styles from "./MenuSignalOverlay.module.css";

const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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

export function MenuSignalOverlay() {
  const reducedMotion = usePrefersReducedMotion();

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
      <span className={styles.lock} data-lock="a" />
      <span className={styles.lock} data-lock="b" />
      <span className={styles.lock} data-lock="c" />
    </div>
  );
}
