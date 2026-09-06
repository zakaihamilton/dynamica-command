import { useEffect, type MutableRefObject } from "react";
import { dispatchBattlefieldAudio } from "@/lib/audio/battlefield";
import { TICKS_PER_SECOND } from "@/lib/catalog";
import { pauseMusic, setMusicIntensity, type MusicIntensity } from "@/lib/audio/music";
import { playSfx } from "@/lib/audio/synth";
import { startLoop } from "@/lib/game/loop";
import { tick } from "@/lib/sim/api";
import { completeMission, readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import { cachedLocalStorage } from "@/lib/persist/save";
import { saveKey, type SaveSession, type SaveWriteStatus } from "@/lib/persist/save";
import { recordTelemetry, telemetryFromMission } from "@/lib/persist/telemetry";
import { cameraPanBounds, clampCamera, panAvailability, panCamera, panOffset, EDGE_PAN_DELAY_MS, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { burstsFromEvents, type FxBurst } from "@/lib/render/fx";
import type { Camera } from "@/lib/iso";
import { missionMedals, missionScore } from "@/lib/sim/debrief";
import type { Command, SimState } from "@/lib/types";
import { commandRejectionMessage } from "@/lib/ui/copy";
import { alertSfx, desiredMusicIntensity, firstAlert, rejectionSfx } from "./gameLoopEffects";

const CAMPAIGN_SAVE_RETRY_MS = 1_000;
const AUTOSAVE_INTERVAL_TICKS = 30 * TICKS_PER_SECOND;

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
  useEffect(() => {
    let appliedIntensity: MusicIntensity = "calm";
    let lastCombatTick = Number.NEGATIVE_INFINITY;
    let nextCampaignSaveAttemptMs = 0;
    let nextSaveAttemptMs = 0;
    let retrySave = false;
    let lastSaveStatus: SaveWriteStatus = "saved";
    let terminalPresented = terminalSaveRef.current;
    const saveImplicit = (state: SimState, now: number) => {
      const status = saveSession.write(state, "implicit");
      retrySave = status === "failed";
      nextSaveAttemptMs = now + CAMPAIGN_SAVE_RETRY_MS;
      if (status !== lastSaveStatus) {
        const message = status === "conflict"
          ? "Autosave paused: this campaign changed in another tab. Use Save Mission or Load Mission to resolve it."
          : status === "failed"
            ? "Progress could not be saved. Retrying; check available browser storage."
            : "Progress saved.";
        onAlert(message);
        onTacticalAnnouncement(message);
      }
      lastSaveStatus = status;
      if (status === "saved" && state.result !== "playing") terminalSaveRef.current = true;
      return status;
    };
    let commandApplied = false;
    let commandsIssued = 0;
    let commandRejections = 0;
    let idleHandle: number | null = null;
    let idleViaTimeout = false;
    const cancelIdle = () => {
      if (idleHandle === null) return;
      if (idleViaTimeout) clearTimeout(idleHandle);
      else if (typeof cancelIdleCallback === "function") cancelIdleCallback(idleHandle);
      idleHandle = null;
    };
    const scheduleAutosave = () => {
      if (!persistCampaign) return;
      cancelIdle();
      const run = () => {
        idleHandle = null;
        saveImplicit(stateRef.current, performance.now());
      };
      if (typeof requestIdleCallback === "function") {
        idleViaTimeout = false;
        idleHandle = requestIdleCallback(run, { timeout: 250 });
      } else {
        idleViaTimeout = true;
        idleHandle = window.setTimeout(run, 0);
      }
    };
    const saveOnPageHide = () => {
      if (!persistCampaign) return;
      const current = stateRef.current;
      saveImplicit(current, performance.now());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      if (event.key === saveKey(stateRef.current.seed)) {
        saveSession.markExternalChange();
      }
    };
    window.addEventListener("pagehide", saveOnPageHide);
    window.addEventListener("beforeunload", saveOnPageHide);
    window.addEventListener("storage", onStorage);
    const loop = startLoop({
      getState: () => stateRef.current,
      setState: (next) => {
        stateRef.current = next;
      },
      drainCommands: () => {
        const commands = cmdQ.current.splice(0, cmdQ.current.length);
        commandApplied = commands.length > 0;
        commandsIssued += commands.length;
        return commands;
      },
      step: tick,
      isPaused: () => pausedRef.current,
      onTick: (next, events, now) => {
        commandRejections += events.filter((event) => event.type === "commandRejected").length;
        if (next.tick % AUTOSAVE_INTERVAL_TICKS === 0) scheduleAutosave();
        if (commandApplied || next.tick % 6 === 0) {
          commandApplied = false;
          setState({ ...next, entities: [...next.entities] });
        }
        if (events.some((event) => event.type === "combat")) lastCombatTick = next.tick;
        const terminal = events.some((event) => event.type === "won" || event.type === "lost");
        if (terminal) pauseMusic();
        const alert = firstAlert(events);
        const desiredIntensity = desiredMusicIntensity(
          next.runtime?.director?.phase,
          next.tick,
          lastCombatTick,
          alert?.kind === "warning",
        );
        if (!terminal && desiredIntensity !== appliedIntensity) {
          appliedIntensity = desiredIntensity;
          setMusicIntensity(desiredIntensity);
        }
        dispatchBattlefieldAudio(
          events,
          camRef.current,
          canvasRef.current?.width ?? 1,
          canvasRef.current?.height ?? 1,
        );
        if (events.some((e) => e.type === "won")) {
          playSfx("victory", { force: true });
        }
        if (events.some((e) => e.type === "lost")) {
          playSfx("defeat", { force: true });
        }
        const rejection = events.find((e) => e.type === "commandRejected");
        if (rejection?.type === "commandRejected") {
          playSfx(rejectionSfx(rejection.reason));
          onTacticalAnnouncement(commandRejectionMessage(rejection.reason));
        }
        if (alert) {
          playSfx(alertSfx(alert.kind), { force: true });
          onAlert(alert.text);
          onTacticalAnnouncement(alert.text);
        }
        if (events.some((event) => event.type === "combat" || event.type === "destroyed" || event.type === "support" || event.type === "built" || event.type === "produced")) {
          const spawned = burstsFromEvents(events, next, now, fxSeq.current);
          fxSeq.current = spawned.nextId;
          fxRef.current.push(...spawned.bursts);
        }
      },
      onFrame: (now, s, paused, subTickAlpha, frameMs) => {
        const panStep = 600 * frameMs / 1000;
        if (!paused) {
          const cam = camRef.current;
          const canvas = canvasRef.current;
          const bounds = canvas
            ? cameraPanBounds(cam, s.width, s.height, canvas.width, canvas.height)
            : undefined;
          if (keys.current.w || keys.current.ArrowUp) panCamera(cam, 0, panStep, bounds);
          if (keys.current.s || keys.current.ArrowDown) panCamera(cam, 0, -panStep, bounds);
          if (keys.current.a || keys.current.ArrowLeft) panCamera(cam, panStep, 0, bounds);
          if (keys.current.d || keys.current.ArrowRight) panCamera(cam, -panStep, 0, bounds);
          const hoveredEdge = edgePanHover.current;
          const hold = hoveredEdge && now - hoveredEdge.startedAt >= EDGE_PAN_DELAY_MS ? hoveredEdge.dir : null;
          panHold.current = hold;
          if (hold && bounds) {
            if (!panAvailability(cam, bounds)[hold]) applyEdgePan(null);
            else {
              const off = panOffset(hold, panStep);
              panCamera(cam, off.dx, off.dy, bounds);
            }
          } else if (bounds) {
            clampCamera(cam, bounds);
          }
          if (bounds) {
            const next = panAvailability(cam, bounds);
            const prev = panAvailRef.current;
            if (prev.left !== next.left || prev.right !== next.right || prev.up !== next.up || prev.down !== next.down) {
              panAvailRef.current = next;
              setPanAvail(next);
            }
          }
        } else {
          edgePanHover.current = null;
          panHold.current = null;
        }
        if (s.result !== "playing" && !terminalPresented) {
          terminalPresented = true;
          if (persistCampaign) {
            cancelIdle();
            saveImplicit(s, now);
            recordTelemetry(
              cachedLocalStorage(),
              telemetryFromMission(s, { commandsIssued, commandRejections }),
            );
          }
          setState({ ...s, entities: [...s.entities] });
        }
        if (persistCampaign && retrySave && now >= nextSaveAttemptMs) saveImplicit(s, now);
        if (persistCampaign && s.result === "won" && !campaignRecordedRef.current) {
          if (now >= nextCampaignSaveAttemptMs) {
            const progress = readCampaignProgress(cachedLocalStorage(), s.seed);
            const recorded = writeCampaignProgress(
              cachedLocalStorage(),
              completeMission(progress, s.missionIndex, missionMedals(s), missionScore(s)),
            );
            if (recorded) campaignRecordedRef.current = true;
            else nextCampaignSaveAttemptMs = now + CAMPAIGN_SAVE_RETRY_MS;
          }
        }
        redraw(now, subTickAlpha);
      },
    });
    return () => {
      cancelIdle();
      window.removeEventListener("pagehide", saveOnPageHide);
      window.removeEventListener("beforeunload", saveOnPageHide);
      window.removeEventListener("storage", onStorage);
      loop.stop();
    };
  }, [
    applyEdgePan,
    camRef,
    campaignRecordedRef,
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
    setPanAvail,
    setState,
    stateRef,
    terminalSaveRef,
    saveSession,
    persistCampaign,
  ]);
}
