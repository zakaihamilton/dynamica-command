"use client";

import type { CSSProperties } from "react";
import { GameOverlays } from "./GameOverlays";
import { GamePlayField } from "./GamePlayField";
import { useGameRuntime } from "./hooks/useGameRuntime";
import { DocumentTitle } from "@/components/ui/DocumentTitle";
import { formatSeed } from "@/lib/seed/rng";
import styles from "./GameClient.module.css";

export function GameClient({
  seed,
  mission,
  resume,
  fresh = false,
  slot,
  tutorial = false,
}: {
  seed: number;
  mission: number;
  resume: boolean;
  fresh?: boolean;
  slot?: string;
  tutorial?: boolean;
}) {
  const { palette, playField, overlays } = useGameRuntime({ seed, mission, resume, fresh, slot, tutorial });
  const title = tutorial
    ? "Training Range | Dynamica Command"
    : `Seed ${formatSeed(seed)} · Operation ${mission + 1} | Dynamica Command`;

  return (
    <div
      className={styles.shell}
      style={
        {
          "--p": palette.primary,
          "--a": palette.accent,
        } as CSSProperties
      }
      onContextMenu={(e) => e.preventDefault()}
    >
      <DocumentTitle title={title} />
      <GamePlayField {...playField} />
      <GameOverlays {...overlays} />
    </div>
  );
}
