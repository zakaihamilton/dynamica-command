import { useEffect, type MutableRefObject } from "react";
import { beep } from "@/lib/audio/synth";
import { startLoop } from "@/lib/game/loop";
import { completeMission, readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import { localStorageAdapter, writeSave } from "@/lib/persist/save";
import { cameraPanBounds, clampCamera, panAvailability, panCamera, panOffset, EDGE_PAN_DELAY_MS, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { burstsFromDestroyed, type FxBurst } from "@/lib/render/fx";
import type { Camera } from "@/lib/render/iso";
import type { Command, SimState } from "@/lib/types";

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
}) {
  useEffect(() => {
    const loop = startLoop({
      getState: () => stateRef.current,
      setState: (next) => {
        stateRef.current = next;
      },
      drainCommands: () => cmdQ.current.splice(0, cmdQ.current.length),
      isPaused: () => pausedRef.current,
      onTick: (next, events, now) => {
        if (next.tick % 48 === 0) writeSave(localStorageAdapter(), next);
        if (next.tick % 6 === 0) setState({ ...next, entities: [...next.entities] });
        if (events.some((e) => e.type === "won")) beep("win");
        if (events.some((e) => e.type === "lost")) beep("lose");
        if (events.some((e) => e.type === "commandRejected")) beep("alert");
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
          campaignRecordedRef.current = true;
          const medals = 1 + (s.runtime?.secondary.every((objective) => objective.kind !== "preserveYard" || s.entities.some((e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0)) ? 1 : 0) + (s.losses.units[0] === 0 ? 1 : 0);
          const progress = readCampaignProgress(localStorageAdapter(), s.seed);
          writeCampaignProgress(localStorageAdapter(), completeMission(progress, s.missionIndex, medals, Math.max(0, s.creditsEarned[0] - s.losses.units[0] * 100)));
        }
        redraw(now, subTickAlpha);
      },
    });
    return () => loop.stop();
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
