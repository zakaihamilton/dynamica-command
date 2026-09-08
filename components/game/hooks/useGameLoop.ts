import { useEffect, useRef, type MutableRefObject } from "react";
import type { Camera } from "@/lib/iso";
import type { FxBurst } from "@/lib/render/fx";
import type { PanAvailability, PanDir } from "@/lib/render/camera";
import type { Command, SimState } from "@/lib/types";
import type { SaveSession } from "@/lib/persist/save";
import { createGameRuntimeFacade } from "./runtime/facade";
import type { RuntimeLifecycleState, RuntimePersistenceState, RuntimePorts, RuntimeRefs } from "./runtime/types";

export function useGameLoop({
  stateRef,
  setState,
  cmdQ,
  pausedRef,
  camRef,
  canvasRef,
  keys,
  edgePanHover,
  panHold,
  panAvailRef,
  setPanAvail,
  applyEdgePan,
  fxRef,
  fxSeq,
  terminalSaveRef,
  campaignRecordedRef,
  redraw,
  onAlert,
  onTacticalAnnouncement,
  saveSession,
  persistCampaign = true,
}: {
  stateRef: MutableRefObject<SimState>;
  setState: (s: SimState) => void;
  cmdQ: MutableRefObject<Command[]>;
  pausedRef: MutableRefObject<boolean>;
  camRef: MutableRefObject<Camera>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  keys: MutableRefObject<Record<string, boolean>>;
  edgePanHover: MutableRefObject<{ dir: PanDir; startedAt: number } | null>;
  panHold: MutableRefObject<PanDir | null>;
  panAvailRef: MutableRefObject<PanAvailability>;
  setPanAvail: (v: PanAvailability) => void;
  applyEdgePan: (dir: PanDir | null) => void;
  fxRef: MutableRefObject<FxBurst[]>;
  fxSeq: MutableRefObject<number>;
  terminalSaveRef: MutableRefObject<boolean>;
  campaignRecordedRef: MutableRefObject<boolean>;
  redraw: (nowMs?: number, subTickAlpha?: number) => void;
  onAlert: (text: string) => void;
  onTacticalAnnouncement: (text: string) => void;
  saveSession: SaveSession;
  persistCampaign?: boolean;
}) {
  const lifecycleRef = useRef<RuntimeLifecycleState>({
    sessionState: null,
    terminalPresented: false,
    commandApplied: false,
    counters: { commandsIssued: 0, commandRejections: 0 },
  });
  const persistenceRef = useRef<RuntimePersistenceState>({
    saveRetry: { state: null, retry: false, nextAttemptMs: 0, lastStatus: "saved" },
    nextCampaignSaveAttemptMs: 0,
  });

  useEffect(() => {
    const refs: RuntimeRefs = {
      stateRef,
      commandQueue: cmdQ,
      pausedRef,
      cameraRef: camRef,
      canvasRef,
      keys,
      edgePanHover,
      panHold,
      panAvailabilityRef: panAvailRef,
      fxRef,
      fxSequence: fxSeq,
      terminalSaveRef,
      campaignRecordedRef,
      lifecycleRef,
      persistenceRef,
    };
    const ports: RuntimePorts = {
      setState,
      setPanAvailability: setPanAvail,
      applyEdgePan,
      redraw,
      onAlert,
      onTacticalAnnouncement,
      saveSession,
      persistCampaign,
    };
    const runtime = createGameRuntimeFacade(refs, ports);
    runtime.start();
    return () => runtime.stop();
  }, [
    applyEdgePan,
    campaignRecordedRef,
    camRef,
    canvasRef,
    cmdQ,
    edgePanHover,
    fxRef,
    fxSeq,
    keys,
    onAlert,
    onTacticalAnnouncement,
    panAvailRef,
    panHold,
    pausedRef,
    redraw,
    saveSession,
    setPanAvail,
    setState,
    stateRef,
    terminalSaveRef,
    persistCampaign,
  ]);
}
