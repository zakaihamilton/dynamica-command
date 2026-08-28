// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { useRef, type PointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { createCamera } from "../lib/iso";
import { makeFixture } from "../lib/sim/fixtures";
import type { BuildingKind, Command } from "../lib/types";
import { useGameInput } from "../components/game/hooks/useGameInput";

vi.mock("@/lib/audio/synth", () => ({ beep: vi.fn() }));

function testCanvas() {
  const canvas = {
    width: 800,
    height: 600,
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

function renderInput(canvas: HTMLCanvasElement) {
  const state = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
  const commitSelection = vi.fn();
  const applyEdgePan = vi.fn();
  const { result } = renderHook(() => useGameInput({
    stateRef: useRef(state),
    camRef: useRef(createCamera()),
    selectedRef: useRef(new Set<number>()),
    commitSelection,
    cmdQRef: useRef<Command[]>([]),
    placeRef: useRef<BuildingKind | null>(null),
    setPlaceKind: vi.fn(),
    repairRef: useRef(false),
    setRepairMode: vi.fn(),
    sellRef: useRef(false),
    setSellMode: vi.fn(),
    clearTools: vi.fn(),
    mobileCommandRef: useRef(null),
    setMobileCommandState: vi.fn(),
    pausedRef: useRef(false),
    panAvailRef: useRef({ left: true, right: true, up: true, down: true }),
    applyEdgePan,
    selectionModeRef: useRef(false),
    setSelectionMode: vi.fn(),
  }));
  return { result, canvas, commitSelection, applyEdgePan };
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
    const { result, applyEdgePan } = renderInput(canvas);

    act(() => {
      result.current.onDown(pointerEvent(canvas));
      result.current.onCancel(pointerEvent(canvas));
    });

    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(result.current.boxRef.current).toBeNull();
    expect(applyEdgePan).toHaveBeenLastCalledWith(null);
  });
});
