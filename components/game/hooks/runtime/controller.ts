import { startLoop, type LoopHandle } from "@/lib/game/loop";
import { TICKS_PER_SECOND } from "@/lib/catalog";
import { tick } from "@/lib/sim/api";
import type { SimEvent, SimState } from "@/lib/types";
import { createFrameCoordinator } from "./frame";
import { createPersistenceCoordinator } from "./persistence";
import { createPresentationCoordinator } from "./presentation";
import type { RuntimeController, RuntimePorts, RuntimeRefs } from "./types";

const AUTOSAVE_INTERVAL_TICKS = 30 * TICKS_PER_SECOND;

export function createRuntimeController(refs: RuntimeRefs, ports: RuntimePorts): RuntimeController {
  let loop: LoopHandle | null = null;
  let started = false;
  const lifecycle = refs.lifecycleRef.current;

  const persistence = createPersistenceCoordinator({
    stateRef: refs.stateRef,
    terminalSaveRef: refs.terminalSaveRef,
    campaignRecordedRef: refs.campaignRecordedRef,
    saveSession: ports.saveSession,
    persistCampaign: ports.persistCampaign,
    onAlert: ports.onAlert,
    onTacticalAnnouncement: ports.onTacticalAnnouncement,
    persistenceRef: refs.persistenceRef,
  });
  const presentation = createPresentationCoordinator({
    cameraRef: refs.cameraRef,
    canvasRef: refs.canvasRef,
    fxRef: refs.fxRef,
    fxSequence: refs.fxSequence,
    onAlert: ports.onAlert,
    onTacticalAnnouncement: ports.onTacticalAnnouncement,
  });
  const frame = createFrameCoordinator({
    cameraRef: refs.cameraRef,
    canvasRef: refs.canvasRef,
    keys: refs.keys,
    edgePanHover: refs.edgePanHover,
    panHold: refs.panHold,
    panAvailabilityRef: refs.panAvailabilityRef,
    setPanAvailability: ports.setPanAvailability,
    applyEdgePan: ports.applyEdgePan,
  });

  const syncSession = (state: SimState) => {
    if (lifecycle.sessionState === state) return;
    lifecycle.sessionState = state;
    lifecycle.terminalPresented = refs.terminalSaveRef.current;
    lifecycle.commandApplied = false;
    lifecycle.counters.commandsIssued = 0;
    lifecycle.counters.commandRejections = 0;
    persistence.reset();
    presentation.reset();
  };

  const controller: RuntimeController = {
    start() {
      if (started) return;
      started = true;
      syncSession(refs.stateRef.current);
      persistence.start();
      loop = startLoop({
        getState: () => refs.stateRef.current,
        setState: (state) => {
          refs.stateRef.current = state;
        },
        drainCommands: controller.drainCommands,
        step: tick,
        isPaused: () => refs.pausedRef.current,
        onTick: controller.onTick,
        onFrame: controller.onFrame,
      });
    },
    stop() {
      if (!started) return;
      started = false;
      persistence.stop();
      loop?.stop();
      loop = null;
    },
    drainCommands() {
      syncSession(refs.stateRef.current);
      const commands = refs.commandQueue.current.splice(0, refs.commandQueue.current.length);
      lifecycle.commandApplied = commands.length > 0;
      lifecycle.counters.commandsIssued += commands.length;
      return commands;
    },
    onTick(state: SimState, events: SimEvent[], now: number) {
      syncSession(state);
      lifecycle.counters.commandRejections += events.filter((event) => event.type === "commandRejected").length;
      if (state.tick % AUTOSAVE_INTERVAL_TICKS === 0) persistence.scheduleAutosave();
      if (lifecycle.commandApplied || state.tick % 6 === 0) {
        lifecycle.commandApplied = false;
        ports.setState({ ...state, entities: [...state.entities] });
      }
      presentation.onTick(state, events, now);
    },
    onFrame(now: number, state: SimState, paused: boolean, subTickAlpha: number, frameMs: number) {
      syncSession(state);
      frame.onFrame(state, now, paused, frameMs);
      if (state.result !== "playing" && !lifecycle.terminalPresented) {
        lifecycle.terminalPresented = true;
        persistence.onTerminal(state, now, lifecycle.counters);
        ports.setState({ ...state, entities: [...state.entities] });
      }
      persistence.onTickFrame(state, now);
      ports.redraw(now, subTickAlpha);
    },
  };

  return controller;
}
