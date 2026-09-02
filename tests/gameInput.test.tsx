// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { useRef, type PointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { createCamera } from "../lib/iso";
import { makeFixture } from "../lib/sim/fixtures";
import type { BuildingKind, Command } from "../lib/types";
import { useGameInput } from "../components/game/hooks/useGameInput";
import { useTouchGestures } from "../components/game/hooks/useTouchGestures";

vi.mock("@/lib/audio/synth", () => ({ beep: vi.fn() }));

function testCanvas() {
  const canvas = {
    width: 800,
    height: 600,
    style: { cursor: "" },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 600 }) as DOMRect,
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
    releasePointerCapture: vi.fn(),
  } as unknown as HTMLCanvasElement;
  return canvas;
}

function pointerEvent(canvas: HTMLCanvasElement, overrides: Partial<PointerEvent<HTMLCanvasElement>> = {}) {
  return {
    currentTarget: canvas,
    pointerId: 7,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
    clientX: 120,
    clientY: 140,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as PointerEvent<HTMLCanvasElement>;
}

function renderInput(
  canvas: HTMLCanvasElement,
  overrides: { repairMode?: boolean; repairRef?: { current: boolean } } = {},
) {
  const state = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
  const commitSelection = vi.fn();
  const applyEdgePan = vi.fn();
  const clearTools = vi.fn();
  const repairRef = overrides.repairRef ?? { current: overrides.repairMode ?? false };
  const { result, rerender } = renderHook(
    (props: { repairMode: boolean }) => useGameInput({
      stateRef: useRef(state),
      camRef: useRef(createCamera()),
      selectedRef: useRef(new Set<number>()),
      commitSelection,
      cmdQRef: useRef<Command[]>([]),
      placeRef: useRef<BuildingKind | null>(null),
      setPlaceKind: vi.fn(),
      repairRef,
      repairMode: props.repairMode,
      setRepairMode: vi.fn(),
      sellRef: useRef(false),
      setSellMode: vi.fn(),
      clearTools,
      mobileCommandRef: useRef(null),
      setMobileCommandState: vi.fn(),
      pausedRef: useRef(false),
      panAvailRef: useRef({ left: true, right: true, up: true, down: true }),
      applyEdgePan,
      selectionModeRef: useRef(false),
      setSelectionMode: vi.fn(),
    }),
    { initialProps: { repairMode: overrides.repairMode ?? false } },
  );
  return { result, canvas, commitSelection, applyEdgePan, clearTools, repairRef, rerender };
}

describe("desktop marquee pointer lifecycle", () => {
  it("captures the pointer, preserves the box on leave, and releases on pointer-up", () => {
    const canvas = testCanvas();
    const { result, commitSelection, applyEdgePan } = renderInput(canvas);

    act(() => {
      result.current.onDown(pointerEvent(canvas));
      result.current.onLeave();
      result.current.onUp(pointerEvent(canvas, { clientX: 700, clientY: 500, buttons: 0 }));
    });

    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(result.current.boxRef.current).toBeNull();
    expect(commitSelection).toHaveBeenCalledOnce();
    expect(applyEdgePan).toHaveBeenLastCalledWith(null);
  });

  it("releases capture and clears the marquee on pointer-cancel", () => {
    const canvas = testCanvas();
    const { result, applyEdgePan, clearTools } = renderInput(canvas);

    act(() => {
      result.current.onDown(pointerEvent(canvas));
      result.current.onCancel(pointerEvent(canvas));
    });

    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(result.current.boxRef.current).toBeNull();
    expect(applyEdgePan).toHaveBeenLastCalledWith(null);
    expect(clearTools).toHaveBeenCalledOnce();
  });
});

describe("battlefield cursor", () => {
  it("updates the canvas cursor when repair mode turns on without another pointer move", () => {
    const canvas = testCanvas();
    const repairRef = { current: false };
    const { result, rerender } = renderInput(canvas, { repairRef });

    act(() => {
      result.current.onMove(pointerEvent(canvas, { buttons: 0 }));
    });
    expect(canvas.style.cursor).toBe("crosshair");

    repairRef.current = true;
    rerender({ repairMode: true });
    expect(canvas.style.cursor).toBe("not-allowed");
  });
});

describe("touch gesture lifecycle", () => {
  it("distinguishes a tap from a drag and fires long press once", () => {
    vi.useFakeTimers();
    try {
      const state = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
      const cam = createCamera();
      const selectionModeRef = { current: false };
      const boxRef = { current: null };
      const issueContextOrder = vi.fn();
      const { result } = renderHook(() => useTouchGestures({
        camRef: { current: cam },
        stateRef: { current: state },
        selectionModeRef,
        boxRef,
        issueContextOrder,
      }));
      const canvas = testCanvas();
      const touch = (overrides: Partial<PointerEvent<HTMLCanvasElement>> = {}) => pointerEvent(canvas, { pointerType: "touch", ...overrides });

      act(() => result.current.beginTouch(touch(), { x: 100, y: 100 }));
      expect(result.current.endTouch(touch({ buttons: 0 }))).toBe(false);

      act(() => result.current.beginTouch(touch(), { x: 100, y: 100 }));
      act(() => result.current.moveTouch(touch({ clientX: 130, clientY: 100 }), { x: 130, y: 100 }));
      expect(result.current.endTouch(touch({ clientX: 130, clientY: 100, buttons: 0 }))).toBe(true);
      expect(issueContextOrder).not.toHaveBeenCalled();

      act(() => result.current.beginTouch(touch(), { x: 100, y: 100 }));
      act(() => vi.advanceTimersByTime(500));
      expect(issueContextOrder).toHaveBeenCalledOnce();
      expect(result.current.endTouch(touch({ buttons: 0 }))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
