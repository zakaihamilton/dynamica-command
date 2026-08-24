// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { createCamera } from "../lib/iso";
import { makeFixture } from "../lib/sim/fixtures";
import type { BuildingKind } from "../lib/types";

const renderGameFrame = vi.hoisted(() => vi.fn(() => ({
  worldCtx: null,
  miniCtx: null,
  secondaryMiniCtx: null,
  fx: [],
})));

const startLoop = vi.hoisted(() => vi.fn(() => ({ stop: vi.fn() })));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/audio/synth", () => ({ beep: vi.fn(), setSfxEnabled: vi.fn(), playSfx: vi.fn() }));
vi.mock("@/lib/audio/music", () => ({
  setMusicEnabled: vi.fn(),
  setMusicCue: vi.fn(),
  setMusicDucked: vi.fn(),
  setMusicIntensity: vi.fn(),
  TUTORIAL_MUSIC_MISSION: -1,
}));
vi.mock("@/lib/audio/mixer", () => ({ setAudioLevels: vi.fn() }));
vi.mock("@/lib/audio/battlefield", () => ({ dispatchBattlefieldAudio: vi.fn() }));
vi.mock("@/lib/gen/visualAssets", () => ({ listTacticalRasterSources: () => [] }));
vi.mock("@/lib/render/sprites", () => ({ preloadRasterSources: vi.fn() }));
vi.mock("@/lib/game/loop", () => ({ startLoop }));
vi.mock("../components/game/renderFrame", () => ({ renderGameFrame }));

import { useGameRenderer } from "../components/game/hooks/useGameRenderer";
import { useGameRuntime } from "../components/game/hooks/useGameRuntime";

afterEach(() => {
  cleanup();
  renderGameFrame.mockClear();
  startLoop.mockClear();
});

beforeEach(() => {
  class FakeResizeObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

describe("useGameRenderer", () => {
  it("skips painting when the canvas host is missing and paints once both exist", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" } });
    const { result } = renderHook(() => {
      const stateRef = useRef(state);
      const hostRef = useRef<HTMLDivElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const miniRef = useRef<HTMLCanvasElement | null>(null);
      const mobileMiniRef = useRef<HTMLCanvasElement | null>(null);
      const camRef = useRef(createCamera());
      const selected = useRef(new Set<number>());
      const hoverRef = useRef<{ x: number; y: number } | null>(null);
      const cursorRef = useRef<{ x: number; y: number } | null>(null);
      const boxRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
      const place = useRef<BuildingKind | null>(null);
      const repair = useRef(false);
      const sell = useRef(false);
      const renderer = useGameRenderer({
        stateRef,
        hostRef,
        canvasRef,
        miniRef,
        mobileMiniRef,
        camRef,
        selected,
        hoverRef,
        cursorRef,
        boxRef,
        place,
        repair,
        sell,
      });
      return { renderer, hostRef, canvasRef };
    });

    act(() => {
      result.current.renderer.redraw(1_000, 0.25);
    });
    expect(renderGameFrame).not.toHaveBeenCalled();

    const canvas = document.createElement("canvas");
    const host = document.createElement("div");
    result.current.canvasRef.current = canvas;
    result.current.hostRef.current = host;

    act(() => {
      result.current.renderer.redraw(1_000, 0.25);
    });
    expect(renderGameFrame).toHaveBeenCalledOnce();
    expect(renderGameFrame).toHaveBeenCalledWith(expect.objectContaining({
      state,
      canvas,
      host,
      nowMs: 1_000,
      subTickAlpha: 0.25,
    }));
  });
});

describe("useGameRuntime", () => {
  it("starts the sim loop and exposes play-field plus overlay props", () => {
    const { result } = renderHook(() => useGameRuntime({ seed: 421, mission: 0, resume: false, tutorial: false }));

    expect(startLoop).toHaveBeenCalledOnce();
    expect(result.current.campaign.seedNumber).toBe(421);
    expect(result.current.playField.state.seed).toBe(421);
    expect(result.current.playField.tutorial).toBe(false);
    expect(result.current.overlays.paused).toBe(false);
    expect(result.current.overlays.activeTab).toBe("construction");
    expect(result.current.palette.primary).toBeTruthy();

    act(() => {
      result.current.overlays.onOpenMobileSheet();
    });
    expect(result.current.overlays.mobileSheetOpen).toBe(true);
    expect(result.current.overlays.selectionMode).toBe(false);
    expect(startLoop).toHaveBeenCalledOnce();

    act(() => {
      result.current.overlays.onSelectionMode(true);
    });
    expect(result.current.overlays.selectionMode).toBe(true);
    expect(result.current.overlays.mobileSheetOpen).toBe(false);
    expect(startLoop).toHaveBeenCalledOnce();
  });
});
