import { describe, expect, it, vi } from "vitest";
import { createCamera } from "../../lib/iso";
import { makeFixture } from "../../lib/sim/fixtures";
import { cameraPanBounds, EDGE_PAN_DELAY_MS } from "../../lib/render/camera";
import { createFrameCoordinator } from "../../components/game/hooks/runtime/frame";

const ref = <T,>(current: T) => ({ current });

function makeFrameCoordinator(keys: Record<string, boolean> = {}) {
  const camera = createCamera();
  const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
  const bounds = cameraPanBounds(camera, 48, 48, canvas.width, canvas.height);
  camera.x = (bounds.minX + bounds.maxX) / 2;
  camera.y = (bounds.minY + bounds.maxY) / 2;
  const panAvailability = ref({ left: true, right: true, up: true, down: true });
  const edgePanHover = ref<{ dir: "left" | "right" | "up" | "down"; startedAt: number } | null>(null);
  const panHold = ref<"left" | "right" | "up" | "down" | null>(null);
  const setPanAvailability = vi.fn();
  const applyEdgePan = vi.fn();
  const coordinator = createFrameCoordinator({
    cameraRef: ref(camera),
    canvasRef: ref(canvas),
    keys: ref(keys),
    edgePanHover,
    panHold,
    panAvailabilityRef: panAvailability,
    setPanAvailability,
    applyEdgePan,
  });
  return { camera, bounds, coordinator, edgePanHover, panHold, setPanAvailability };
}

describe("runtime frame coordinator", () => {
  it("clamps keyboard pan and publishes availability changes", () => {
    const frame = makeFrameCoordinator({ d: true, w: true });
    const state = makeFixture({ width: 48, height: 48, win: { kind: "annihilate" } });

    frame.coordinator.onFrame(state, 0, false, 10_000);

    expect(frame.camera.x).toBe(frame.bounds.minX);
    expect(frame.camera.y).toBe(frame.bounds.maxY);
    expect(frame.setPanAvailability).toHaveBeenCalled();
  });

  it("waits for the edge-pan delay and clears edge state while paused", () => {
    const frame = makeFrameCoordinator();
    const state = makeFixture({ width: 48, height: 48, win: { kind: "annihilate" } });
    frame.edgePanHover.current = { dir: "left", startedAt: 0 };
    const before = frame.camera.x;

    frame.coordinator.onFrame(state, EDGE_PAN_DELAY_MS - 1, false, 16);
    expect(frame.panHold.current).toBeNull();
    expect(frame.camera.x).toBe(before);

    frame.coordinator.onFrame(state, EDGE_PAN_DELAY_MS + 1, false, 16);
    expect(frame.panHold.current).toBe("left");
    expect(frame.camera.x).toBeGreaterThan(before);

    frame.coordinator.onFrame(state, EDGE_PAN_DELAY_MS + 2, true, 16);
    expect(frame.edgePanHover.current).toBeNull();
    expect(frame.panHold.current).toBeNull();
  });

  it("uses elapsed time when edge-pan frames are delayed", () => {
    const frame = makeFrameCoordinator();
    const state = makeFixture({ width: 48, height: 48, win: { kind: "annihilate" } });
    frame.edgePanHover.current = { dir: "right", startedAt: 0 };
    const before = frame.camera.x;

    frame.coordinator.onFrame(state, 0, false, 0);
    frame.coordinator.onFrame(state, 1_000, false, 100);

    expect(frame.camera.x).toBe(before - 600);
  });
});
