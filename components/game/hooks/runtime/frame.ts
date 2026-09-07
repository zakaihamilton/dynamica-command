import { cameraPanBounds, clampCamera, panAvailability, panCamera, panOffset, EDGE_PAN_DELAY_MS, type PanAvailability, type PanDir } from "@/lib/render/camera";
import type { Camera } from "@/lib/iso";
import type { SimState } from "@/lib/types";

export function createFrameCoordinator({
  cameraRef,
  canvasRef,
  keys,
  edgePanHover,
  panHold,
  panAvailabilityRef,
  setPanAvailability,
  applyEdgePan,
}: {
  cameraRef: { current: Camera };
  canvasRef: { current: HTMLCanvasElement | null };
  keys: { current: Record<string, boolean> };
  edgePanHover: { current: { dir: PanDir; startedAt: number } | null };
  panHold: { current: PanDir | null };
  panAvailabilityRef: { current: PanAvailability };
  setPanAvailability: (availability: PanAvailability) => void;
  applyEdgePan: (direction: PanDir | null) => void;
}) {
  return {
    onFrame(state: SimState, now: number, paused: boolean, frameMs: number) {
      const panStep = 600 * frameMs / 1000;
      if (!paused) {
        const camera = cameraRef.current;
        const canvas = canvasRef.current;
        const bounds = canvas
          ? cameraPanBounds(camera, state.width, state.height, canvas.width, canvas.height)
          : undefined;
        if (keys.current.w || keys.current.ArrowUp) panCamera(camera, 0, panStep, bounds);
        if (keys.current.s || keys.current.ArrowDown) panCamera(camera, 0, -panStep, bounds);
        if (keys.current.a || keys.current.ArrowLeft) panCamera(camera, panStep, 0, bounds);
        if (keys.current.d || keys.current.ArrowRight) panCamera(camera, -panStep, 0, bounds);
        const hoveredEdge = edgePanHover.current;
        const hold = hoveredEdge && now - hoveredEdge.startedAt >= EDGE_PAN_DELAY_MS ? hoveredEdge.dir : null;
        panHold.current = hold;
        if (hold && bounds) {
          if (!panAvailability(camera, bounds)[hold]) applyEdgePan(null);
          else {
            const offset = panOffset(hold, panStep);
            panCamera(camera, offset.dx, offset.dy, bounds);
          }
        } else if (bounds) {
          clampCamera(camera, bounds);
        }
        if (bounds) {
          const next = panAvailability(camera, bounds);
          const previous = panAvailabilityRef.current;
          if (previous.left !== next.left || previous.right !== next.right || previous.up !== next.up || previous.down !== next.down) {
            panAvailabilityRef.current = next;
            setPanAvailability(next);
          }
        }
      } else {
        edgePanHover.current = null;
        panHold.current = null;
      }
    },
  };
}
