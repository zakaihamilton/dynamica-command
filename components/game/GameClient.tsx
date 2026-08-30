"use client";

import type { CSSProperties } from "react";
import { GameOverlays } from "./GameOverlays";
import { GamePlayField } from "./GamePlayField";
import { useGameRuntime } from "./hooks/useGameRuntime";
import type { NavigationOrigin } from "./hooks/missionRoutes";
import styles from "./GameClient.module.css";

export function GameClient({
  seed,
  mission,
  resume,
  fresh = false,
  tutorial = false,
  tutorialOrigin = "menu",
}: {
  seed: number;
  mission: number;
  resume: boolean;
  fresh?: boolean;
  tutorial?: boolean;
  tutorialOrigin?: NavigationOrigin;
}) {
  const { palette, playField, overlays } = useGameRuntime({ seed, mission, resume, fresh, tutorial, tutorialOrigin });

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
