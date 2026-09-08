"use client";

import { useGameRuntime } from "./hooks/useGameRuntime";
import { createGameRuntimeSurfaces } from "./hooks/runtime/surfaces";
import { TacticalScreen } from "./TacticalScreen";
import { formatSeed } from "@/lib/seed/rng";

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
  const runtime = useGameRuntime({ seed, mission, resume, fresh, slot, tutorial });
  const surfaces = createGameRuntimeSurfaces(runtime);
  const title = tutorial
    ? "Training Range | Shifting Front"
    : `Seed ${formatSeed(seed)} · Operation ${mission + 1} | Shifting Front`;

  return (
    <TacticalScreen palette={runtime.palette} {...surfaces} title={title} />
  );
}
