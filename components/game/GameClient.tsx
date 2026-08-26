"use client";

import type { CSSProperties } from "react";
import { GameOverlays } from "./GameOverlays";
import { GamePlayField } from "./GamePlayField";
import { useGameRuntime } from "./hooks/useGameRuntime";
import styles from "./GameClient.module.css";

export function GameClient({
  seed,
  mission,
  resume,
  fresh = false,
  tutorial = false,
}: {
  seed: number;
  mission: number;
  resume: boolean;
  fresh?: boolean;
  tutorial?: boolean;
}) {
  const { palette, playField, overlays } = useGameRuntime({ seed, mission, resume, fresh, tutorial });

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
      <GamePlayField {...playField} />
      <GameOverlays {...overlays} />
    </div>
  );
}
