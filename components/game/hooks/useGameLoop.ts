import { useEffect, type MutableRefObject } from "react";
import { dispatchBattlefieldAudio } from "@/lib/audio/battlefield";
import { setMusicCue, setMusicIntensity, type MusicIntensity } from "@/lib/audio/music";
import { playSfx } from "@/lib/audio/synth";
import { startLoop } from "@/lib/game/loop";
import { completeMission, readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import { localStorageAdapter, writeSave } from "@/lib/persist/save";
import { cameraPanBounds, clampCamera, panAvailability, panCamera, panOffset, EDGE_PAN_DELAY_MS, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { burstsFromDestroyed, type FxBurst } from "@/lib/render/fx";
import type { Camera } from "@/lib/render/iso";
import { missionMedals, missionScore } from "@/lib/sim/debrief";
import type { Command, SimState } from "@/lib/types";

const CAMPAIGN_SAVE_RETRY_MS = 1_000;

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
}) {
  useEffect(() => {
    let appliedIntensity: MusicIntensity = "calm";
    let lastCombatTick = Number.NEGATIVE_INFINITY;
    let nextCampaignSaveAttemptMs = 0;
    let idleHandle: number | null = null;
    let idleViaTimeout = false;
    const cancelIdle = () => {
      if (idleHandle === null) return;
      if (idleViaTimeout) clearTimeout(idleHandle);
      else if (typeof cancelIdleCallback === "function") cancelIdleCallback(idleHandle);
      idleHandle = null;
    };
    const scheduleAutosave = () => {
      cancelIdle();
      const run = () => {
        idleHandle = null;
        writeSave(localStorageAdapter(), stateRef.current);
      };
      if (typeof requestIdleCallback === "function") {
        idleViaTimeout = false;
        idleHandle = requestIdleCallback(run);
      } else {
        idleViaTimeout = true;
        idleHandle = window.setTimeout(run, 0);
      }
    };
    const loop = startLoop({
      getState: () => stateRef.current,
      setState: (next) => {
        stateRef.current = next;
      },
      drainCommands: () => cmdQ.current.splice(0, cmdQ.current.length),
      isPaused: () => pausedRef.current,
      onTick: (next, events, now) => {
        if (next.tick % 48 === 0) scheduleAutosave();
        if (next.tick % 6 === 0) setState({ ...next, entities: [...next.entities] });
        if (events.some((event) => event.type === "combat")) lastCombatTick = next.tick;
        const phase = next.runtime?.director?.phase;
        const alert = events.find((event) => event.type === "alert");
        let desiredIntensity: MusicIntensity = phase === "finale" ? "critical" : phase === "pressure" ? "engaged" : "calm";
        if (next.tick - lastCombatTick <= 48) desiredIntensity = desiredIntensity === "critical" ? desiredIntensity : "engaged";
        if (alert?.type === "alert" && alert.kind === "warning") desiredIntensity = "critical";
        if (desiredIntensity !== appliedIntensity) {
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
          setMusicCue("victory", next.seed, next.missionIndex);
        }
        if (events.some((e) => e.type === "lost")) {
          playSfx("defeat", { force: true });
          setMusicCue("defeat", next.seed, next.missionIndex);
        }
        if (events.some((e) => e.type === "commandRejected")) playSfx("uiError");
        if (alert && alert.type === "alert") {
          playSfx(alert.kind === "warning" ? "warning" : alert.kind === "objective" ? "objective" : "contact", { force: true });
          onAlert(alert.text);
        }
        if (events.some((e) => e.type === "destroyed")) {
          const spawned = burstsFromDestroyed(events, next, now, fxSeq.current);
          fxSeq.current = spawned.nextId;
          fxRef.current.push(...spawned.bursts);
        }
      },
      onFrame: (now, s, paused, subTickAlpha) => {
        if (!paused) {
          const cam = camRef.current;
          const canvas = canvasRef.current;
          const bounds = canvas
            ? cameraPanBounds(cam, s.width, s.height, canvas.width, canvas.height)
            : undefined;
          if (keys.current.w || keys.current.ArrowUp) panCamera(cam, 0, 10, bounds);
          if (keys.current.s || keys.current.ArrowDown) panCamera(cam, 0, -10, bounds);
          if (keys.current.a || keys.current.ArrowLeft) panCamera(cam, 10, 0, bounds);
          if (keys.current.d || keys.current.ArrowRight) panCamera(cam, -10, 0, bounds);
          const hoveredEdge = edgePanHover.current;
          const hold = hoveredEdge && now - hoveredEdge.startedAt >= EDGE_PAN_DELAY_MS ? hoveredEdge.dir : null;
          panHold.current = hold;
          if (hold && bounds) {
            if (!panAvailability(cam, bounds)[hold]) applyEdgePan(null);
            else {
              const off = panOffset(hold);
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
        if (s.result !== "playing" && !terminalSaveRef.current) {
          terminalSaveRef.current = true;
          writeSave(localStorageAdapter(), s);
          setState({ ...s, entities: [...s.entities] });
        }
        if (s.result === "won" && !campaignRecordedRef.current) {
          if (now >= nextCampaignSaveAttemptMs) {
            const progress = readCampaignProgress(localStorageAdapter(), s.seed);
            const recorded = writeCampaignProgress(
              localStorageAdapter(),
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
    panAvailRef,
    panHold,
    pausedRef,
    redraw,
    setPanAvail,
    setState,
    stateRef,
    terminalSaveRef,
  ]);
}
