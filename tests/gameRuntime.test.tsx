// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { createCamera } from "../lib/iso";
import { makeFixture } from "../lib/sim/fixtures";
import { markFreshLaunchIntent } from "../lib/persist/navigation";
import { localStorageAdapter, readSave, saveKey, writeSave, writeSlot } from "../lib/persist/save";
import { freshCampaignProgress, readCampaignProgress, writeCampaignProgress, completeMission } from "../lib/persist/campaign";
import { TELEMETRY_KEY } from "../lib/persist/telemetry";
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
  pauseMusic: vi.fn(),
  setMusicEnabled: vi.fn(),
  setMusicCue: vi.fn(),
  setMusicDucked: vi.fn(),
  setMusicIntensity: vi.fn(),
  clearMusicPosition: vi.fn(),
  TUTORIAL_MUSIC_MISSION: -1,
}));
vi.mock("@/lib/audio/mixer", () => ({ setAudioLevels: vi.fn() }));
vi.mock("@/lib/audio/battlefield", () => ({ dispatchBattlefieldAudio: vi.fn() }));
vi.mock("@/lib/gen/visualAssets", () => ({ listTacticalRasterSources: () => [] }));
vi.mock("@/lib/render/sprites", () => ({ preloadRasterSources: vi.fn(), clearSpriteCache: vi.fn() }));
vi.mock("@/lib/game/loop", () => ({ startLoop }));
vi.mock("../components/game/renderFrame", () => ({ renderGameFrame }));

import { useGameRenderer } from "../components/game/hooks/useGameRenderer";
import { initialMission } from "../components/game/hooks/useGameSession";
import { useGameRuntime } from "../components/game/hooks/useGameRuntime";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
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
  it("resumes the matching save when opened without a fresh-deployment flag", () => {
    const saved = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    saved.tick = 120;
    saved.credits[0] = 9876;
    expect(writeSave(localStorageAdapter(), saved)).toBe(true);

    const resumed = initialMission(421, 0, false, false);

    expect(resumed.tick).toBe(120);
    expect(resumed.credits[0]).toBe(9876);
  });

  it("starts a fresh mission when explicitly requested even when a save exists", () => {
    const saved = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    saved.tick = 120;
    expect(writeSave(localStorageAdapter(), saved)).toBe(true);

    const fresh = initialMission(421, 0, false, false, true);

    expect(fresh.tick).toBe(0);
  });

  it("resumes a fresh-flagged mission after a browser reload", () => {
    const saved = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    saved.tick = 120;
    saved.credits[0] = 9876;
    expect(writeSave(localStorageAdapter(), saved)).toBe(true);

    const getEntriesByType = vi.spyOn(window.performance, "getEntriesByType").mockReturnValue([
      { type: "reload" } as PerformanceNavigationTiming,
    ]);

    const resumed = initialMission(421, 0, false, false, true);

    expect(resumed.tick).toBe(120);
    expect(resumed.credits[0]).toBe(9876);
    getEntriesByType.mockRestore();
  });

  it("honors a fresh SPA launch after the document was reloaded", () => {
    const saved = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    saved.tick = 120;
    expect(writeSave(localStorageAdapter(), saved)).toBe(true);

    const getEntriesByType = vi.spyOn(window.performance, "getEntriesByType").mockReturnValue([
      { type: "reload" } as PerformanceNavigationTiming,
    ]);
    markFreshLaunchIntent(421, 0);

    const fresh = initialMission(421, 0, false, false, true);

    expect(fresh.tick).toBe(0);
    getEntriesByType.mockRestore();
  });

  it("uses the in-memory fresh intent when sessionStorage rejects the marker", () => {
    const saved = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    saved.tick = 120;
    expect(writeSave(localStorageAdapter(), saved)).toBe(true);

    const getEntriesByType = vi.spyOn(window.performance, "getEntriesByType").mockReturnValue([
      { type: "reload" } as PerformanceNavigationTiming,
    ]);
    const setItem = vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("session storage unavailable");
    });
    markFreshLaunchIntent(421, 0);

    const fresh = initialMission(421, 0, false, false, true);

    expect(fresh.tick).toBe(0);
    setItem.mockRestore();
    getEntriesByType.mockRestore();
  });

  it("loads a named slot even when a later autosave exists", () => {
    const saved = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    saved.tick = 120;
    expect(writeSave(localStorageAdapter(), saved)).toBe(true);
    writeCampaignProgress(localStorageAdapter(), completeMission(freshCampaignProgress(421), 1, 3, 800));

    const slotState = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    slotState.tick = 12;
    const written = writeSlot(localStorageAdapter(), {
      name: "Bridgehead",
      state: slotState,
      campaign: completeMission(freshCampaignProgress(421), 0, 1, 100),
    });
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const loaded = initialMission(421, 0, true, false, false, written.id);

    expect(loaded.tick).toBe(12);
    expect(readSave(localStorageAdapter(), 421)?.tick).toBe(12);
    expect(readCampaignProgress(localStorageAdapter(), 421).completedMissions).toEqual([0]);
  });

  it("saves the current state when the page is unloaded", () => {
    const { result } = renderHook(() => useGameRuntime({ seed: 421, mission: 0, resume: false, tutorial: false }));
    const loopOptions = (startLoop.mock.calls as unknown[][])[0]?.[0] as { setState: (state: typeof result.current.playField.state) => void };
    const current = { ...result.current.playField.state, tick: 120 };

    loopOptions.setState(current);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(readSave(localStorageAdapter(), 421)?.tick).toBe(120);
  });

  it("does not replace a newer same-seed save during unload", () => {
    const { result } = renderHook(() => useGameRuntime({ seed: 421, mission: 0, resume: false, tutorial: false }));
    const loopOptions = (startLoop.mock.calls as unknown[][])[0]?.[0] as { setState: (state: typeof result.current.playField.state) => void };
    loopOptions.setState({ ...result.current.playField.state, tick: 120 });

    const replacement = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    replacement.tick = 77;
    expect(writeSave(localStorageAdapter(), replacement)).toBe(true);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(readSave(localStorageAdapter(), 421)?.tick).toBe(77);
  });

  it("honors cross-tab storage notifications even when the raw value is unchanged", () => {
    const saved = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    expect(writeSave(localStorageAdapter(), saved)).toBe(true);
    const raw = window.localStorage.getItem(saveKey(421));
    const { result } = renderHook(() => useGameRuntime({ seed: 421, mission: 0, resume: true, tutorial: false }));
    const loopOptions = (startLoop.mock.calls as unknown[][])[0]?.[0] as { setState: (state: typeof result.current.playField.state) => void };
    loopOptions.setState({ ...result.current.playField.state, tick: 120 });

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: saveKey(421),
        oldValue: raw,
        newValue: raw,
      }));
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(readSave(localStorageAdapter(), 421)?.tick).toBe(0);
  });

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
      result.current.overlays.onToggleMobilePanel();
    });
    expect(result.current.overlays.mobilePanelOpen).toBe(true);
    expect(startLoop).toHaveBeenCalledOnce();

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(result.current.overlays.mobilePanelOpen).toBe(false);
    expect(result.current.overlays.paused).toBe(false);

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(result.current.overlays.paused).toBe(true);

    act(() => result.current.overlays.session.resumeMission());
    act(() => window.dispatchEvent(new Event("orientationchange")));
    expect(result.current.overlays.actions.mobileCommandState).toBeNull();
    expect(result.current.overlays.mobilePanelOpen).toBe(false);
    expect(startLoop).toHaveBeenCalledOnce();
  });

  it("returns focus to the launcher when a mobile panel action closes it", () => {
    const { result } = renderHook(() => useGameRuntime({ seed: 421, mission: 0, resume: false, tutorial: false }));
    const launcher = document.createElement("button");
    document.body.append(launcher);
    (result.current.overlays.mobileLauncherRef as { current: HTMLButtonElement | null }).current = launcher;

    act(() => result.current.overlays.onToggleMobilePanel());
    expect(result.current.overlays.mobilePanelOpen).toBe(true);

    const sidebarControl = document.createElement("button");
    document.body.append(sidebarControl);
    sidebarControl.focus();
    act(() => result.current.overlays.onToggleMobilePanel());

    expect(result.current.overlays.mobilePanelOpen).toBe(false);
    expect(document.activeElement).toBe(launcher);

    launcher.remove();
    sidebarControl.remove();
  });

  it("does not record telemetry again when resuming a terminal save", () => {
    const terminalState = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    terminalState.result = "won";
    expect(writeSave(localStorageAdapter(), terminalState)).toBe(true);

    renderHook(() => useGameRuntime({ seed: 421, mission: 0, resume: true, tutorial: false }));
    const firstCall = startLoop.mock.calls[0] as unknown as [{ onFrame: (now: number, state: typeof terminalState, paused: boolean, alpha: number) => void }] | undefined;
    expect(firstCall).toBeDefined();
    act(() => firstCall?.[0].onFrame(1_000, terminalState, false, 0));

    expect(window.localStorage.getItem(TELEMETRY_KEY)).toBeNull();
  });
});
