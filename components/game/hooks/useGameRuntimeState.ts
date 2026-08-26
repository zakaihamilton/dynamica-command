import { useMemo, useRef, useState } from "react";
import { createCampaign } from "@/lib/gen/campaign";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { cachedLocalStorage, createSaveSession } from "@/lib/persist/save";
import type { SimState } from "@/lib/types";
import { initialMission } from "./useGameSession";

/** Owns the durable mission/session state and DOM refs used by runtime layers. */
export function useGameRuntimeState({
  seed,
  mission,
  resume,
  fresh,
  tutorial,
}: {
  seed: number;
  mission: number;
  resume: boolean;
  fresh: boolean;
  tutorial: boolean;
}) {
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const saveSession = useMemo(() => createSaveSession(cachedLocalStorage(), seed), [seed]);
  const playerVisualProfile = useMemo(() => generateVisualProfile(seed, 0), [seed]);
  const [state, setState] = useState<SimState>(() => initialMission(seed, mission, resume, tutorial, fresh));
  const stateRef = useRef<SimState>(state);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const mobileMiniRef = useRef<HTMLCanvasElement>(null);

  return {
    campaign,
    saveSession,
    playerVisualProfile,
    state,
    setState,
    stateRef,
    hostRef,
    canvasRef,
    miniRef,
    mobileMiniRef,
  };
}
