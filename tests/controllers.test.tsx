// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBriefingController } from "../components/briefing/useBriefingController";
import { useBriefingTypewriter } from "../components/briefing/useBriefingTypewriter";
import { useGameActions } from "../components/game/hooks/useGameActions";
import { useCombatAlert } from "../components/game/hooks/useCombatAlert";
import { useGameAudioLifecycle } from "../components/game/hooks/useGameAudioLifecycle";
import { useGameKeyboard } from "../components/game/hooks/useGameKeyboard";
import { useGameSession } from "../components/game/hooks/useGameSession";
import { useGameSelection } from "../components/game/hooks/useGameSelection";
import { useMissionRoutes } from "../components/game/hooks/useMissionRoutes";
import { useMissionBackGuard } from "../components/game/hooks/useMissionBackGuard";
import { useMenuController } from "../components/menu/useMenuController";
import { freshCampaignProgress, writeCampaignProgress } from "../lib/persist/campaign";
import { createSaveSession, localStorageAdapter, readSave, writeSave } from "../lib/persist/save";
import { defaultSettings } from "../lib/persist/settings";
import { makeFixture, addBuilding, addUnit } from "../lib/sim/fixtures";
import type { Command } from "../lib/types";
import type { CommandTab, PauseView } from "../lib/ui/shortcuts";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/audio/synth", () => ({ beep: vi.fn(), setSfxEnabled: vi.fn() }));
vi.mock("@/lib/audio/music", () => ({ setMusicEnabled: vi.fn(), setMusicCue: vi.fn(), setMusicDucked: vi.fn() }));
vi.mock("@/lib/audio/mixer", () => ({ setAudioLevels: vi.fn() }));
vi.mock("@/lib/gen/visualAssets", () => ({ listTacticalRasterSources: () => [] }));
vi.mock("@/lib/render/sprites", () => ({ preloadRasterSources: vi.fn() }));

afterEach(() => {
  cleanup();
  router.push.mockReset();
  window.localStorage.clear();
});

describe("useMenuController", () => {
  it("loads saves/settings and routes valid launches", () => {
    const progress = freshCampaignProgress(421);
    progress.tutorialComplete = true;
    writeCampaignProgress(localStorageAdapter(), progress);
    const { result } = renderHook(() => useMenuController());

    act(() => result.current.setCode("0421"));
    act(() => result.current.launch());

    expect(result.current.previewLine).toContain("·");
    expect(router.push).toHaveBeenCalledWith("/briefing?seed=0421&mission=0&from=menu");
  });

  it("reports invalid launch input and handles keyboard navigation", () => {
    const { result } = renderHook(() => useMenuController());
    act(() => result.current.setCode("12"));
    act(() => result.current.launch());
    expect(result.current.error).toContain("4-digit seed");

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(result.current.view).toBe("main");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" })));
    expect(result.current.view).toBe("newGame");
  });
});

describe("useBriefingController", () => {
  it("routes launches and maps keyboard commands to typewriter actions", () => {
    const replay = vi.fn();
    const skip = vi.fn();
    const { result } = renderHook(() => useBriefingController({
      seed: 421,
      mission: 2,
      returnToGame: true,
      isComplete: false,
      replayTransmission: replay,
      skipToEnd: skip,
    }));

    act(() => result.current.launch());
    expect(router.push).toHaveBeenCalledWith("/play?seed=0421&mission=2&resume=1");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: " " })));
    expect(skip).toHaveBeenCalledOnce();
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" })));
    expect(replay).toHaveBeenCalledOnce();
  });
});

describe("useBriefingTypewriter", () => {
  it("can skip a transmission and replay it from the beginning", () => {
    const lines = [
      { speaker: "commander" as const, text: "Hold" },
      { speaker: "advisor" as const, text: "the line" },
    ];
    const { result } = renderHook(() => useBriefingTypewriter(lines));
    expect(result.current.isComplete).toBe(false);
    act(() => result.current.skipToEnd());
    expect(result.current.isComplete).toBe(true);
    expect(result.current.visibleLines.map((line) => line.visible)).toEqual(["Hold", "the line"]);
    act(() => result.current.replayTransmission());
    expect(result.current.isComplete).toBe(false);
  });
});

describe("useGameActions", () => {
  it("keeps build, repair, sell, and mobile command modes mutually exclusive", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const cmdQ = { current: [] as Command[] };
    const selected = { current: new Set<number>() };
    const { result } = renderHook(() => useGameActions({ stateRef: { current: state }, cmdQ, selected, selectedIds: [] }));

    act(() => result.current.togglePlace("power"));
    expect(result.current.placeKind).toBe("power");
    act(() => result.current.toggleRepair());
    expect(result.current.repairMode).toBe(true);
    expect(result.current.placeKind).toBeNull();
    act(() => result.current.toggleSell());
    expect(result.current.sellMode).toBe(true);
    expect(result.current.repairMode).toBe(false);
    act(() => result.current.chooseMobileCommand("move"));
    expect(result.current.mobileCommandState).toBe("move");
    expect(result.current.sellMode).toBe(false);
  });

  it("queues a command through the least-loaded available producer", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    addBuilding(state, 0, "barracks", 2, 2);
    const cmdQ = { current: [] as Command[] };
    const selected = { current: new Set<number>() };
    const { result } = renderHook(() => useGameActions({ stateRef: { current: state }, cmdQ, selected, selectedIds: [] }));

    act(() => result.current.queueUnit("infantry"));
    expect(cmdQ.current).toEqual([{ type: "produce", fromId: 1, unit: "infantry" }]);
  });

  it("queues orders for the current unit selection", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const unit = addUnit(state, 0, "infantry", 2, 2);
    const cmdQ = { current: [] as Command[] };
    const selected = { current: new Set<number>() };
    const { result } = renderHook(() => useGameActions({ stateRef: { current: state }, cmdQ, selected, selectedIds: [unit.id] }));

    act(() => result.current.issueSelectedCommand("stop"));
    act(() => result.current.issueSelectedCommand("stance", "hold"));
    act(() => result.current.issueSelectedCommand("formation", "wedge"));

    expect(cmdQ.current).toEqual([
      { type: "stop", unitIds: [unit.id] },
      { type: "stance", unitIds: [unit.id], stance: "hold" },
      { type: "formation", unitIds: [unit.id], formation: "wedge" },
    ]);
  });
});

describe("game lifecycle hooks", () => {
  it("restores an active mission after browser Back until leave is confirmed", () => {
    window.history.replaceState({}, "", "/briefing?seed=0421&mission=0");
    window.history.pushState({}, "", "/play?seed=0421&mission=0&fresh=1");
    const requestLeave = vi.fn();
    const back = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useMissionBackGuard({ enabled: true, onRequestLeave: requestLeave }));

    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(window.location.pathname).toBe("/play");
    expect(requestLeave).toHaveBeenCalledOnce();
    act(() => result.current.leave());
    expect(back).toHaveBeenCalledWith(-2);

    unmount();
    back.mockRestore();
    window.history.replaceState({}, "", "/");
  });

  it("cleans up stale same-URL sentinels when the mission guard is disabled", () => {
    const sentinelKey = "__genesisMissionBackSentinel";
    window.history.replaceState({ [sentinelKey]: true, route: "mission" }, "", "/play?seed=0421&mission=0");
    const missionUrl = window.location.href;
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const onRequestLeave = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useMissionBackGuard({ enabled, onRequestLeave }),
      { initialProps: { enabled: true } },
    );

    expect(replaceState).toHaveBeenCalledWith({ route: "mission" }, "", missionUrl);
    expect(pushState).toHaveBeenCalledWith(
      { route: "mission", [sentinelKey]: true },
      "",
      missionUrl,
    );

    act(() => rerender({ enabled: false }));
    expect(back).toHaveBeenCalledOnce();
    unmount();
    replaceState.mockRestore();
    pushState.mockRestore();
    back.mockRestore();
    window.history.replaceState({}, "", "/");
  });

  it("does not overwrite a newer save during a briefing transition", () => {
    const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    const storage = localStorageAdapter();
    const session = createSaveSession(storage, 421);
    const replacement = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    replacement.tick = 77;
    expect(writeSave(storage, replacement)).toBe(true);
    const { result } = renderHook(() => useMissionRoutes({
      seed: 421,
      stateRef: { current: state },
      saveSession: session,
    }));

    act(() => result.current.viewMissionBriefing());

    expect(readSave(storage, 421)?.tick).toBe(77);
    expect(router.push).toHaveBeenCalledWith("/briefing?seed=0421&mission=0&return=game&from=result");
  });

  it("requires confirmation before saving, loading, restarting, or leaving a mission", () => {
    const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    const stateRef = { current: state };
    const props: Parameters<typeof useGameSession>[0] = {
      seed: 421,
      stateRef,
      setState: vi.fn(),
      commitSelection: vi.fn(),
      cmdQRef: { current: [] as Command[] },
      fxRef: { current: [] },
      clearTools: vi.fn(),
      resetInput: vi.fn(),
      resetCamera: vi.fn(),
      pausedRef: { current: true },
      setPaused: vi.fn(),
      setPauseView: vi.fn(),
      setPauseNotice: vi.fn(),
      campaignRecordedRef: { current: false },
      terminalSaveRef: { current: false },
      settings: defaultSettings(),
      setSettings: vi.fn(),
      saveSession: createSaveSession(localStorageAdapter(), 421),
    };
    const { result } = renderHook(() => useGameSession(props));

    act(() => result.current.saveMission());
    expect(result.current.confirmation).toMatchObject({
      action: "save",
      message: "Save the current mission state for this seed?",
    });
    expect(readSave(localStorageAdapter(), 421)).toBeNull();
    act(() => result.current.confirmAction());
    expect(result.current.confirmation).toBeNull();
    expect(readSave(localStorageAdapter(), 421)?.seed).toBe(421);

    stateRef.current.tick = 77;
    act(() => result.current.saveMission());
    act(() => result.current.confirmAction());
    stateRef.current.tick = 99;
    act(() => result.current.loadMission());
    expect(result.current.confirmation).toMatchObject({ action: "load" });
    act(() => result.current.confirmAction());
    expect(stateRef.current.tick).toBe(77);
    expect(props.cmdQRef.current).toEqual([]);
    expect(props.fxRef.current).toEqual([]);
    expect(props.clearTools).toHaveBeenCalledOnce();
    expect(props.resetInput).toHaveBeenCalledOnce();
    expect(props.resetCamera).toHaveBeenCalledWith(stateRef.current);

    const beforeRestart = stateRef.current;
    act(() => result.current.restartMission());
    expect(result.current.confirmation).toMatchObject({ action: "restart" });
    act(() => result.current.cancelConfirmation());
    expect(stateRef.current).toBe(beforeRestart);
    act(() => result.current.restartMission());
    act(() => result.current.confirmAction());
    expect(stateRef.current).not.toBe(beforeRestart);
    expect(stateRef.current.tick).toBe(0);

    act(() => result.current.goMenu());
    expect(result.current.confirmation).toMatchObject({ action: "menu" });
    expect(router.push).not.toHaveBeenCalledWith("/");
    act(() => result.current.confirmAction());
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("commits selections and advances the tutorial selection stage", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    state.tutorialStage = "select";
    const unit = addUnit(state, 0, "infantry", 2, 2);
    const stateRef = { current: state };
    const setState = vi.fn();
    const { result } = renderHook(() => useGameSelection({ stateRef, setState }));

    act(() => result.current.commitSelection([unit.id]));
    expect(result.current.selectedIds).toEqual([unit.id]);
    expect(state.tutorialStage).toBe("move");
    expect(setState).toHaveBeenCalledOnce();
  });

  it("clears combat alerts after their display window and manages audio lifecycle", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useCombatAlert());
      act(() => result.current.onAlert("Contact"));
      expect(result.current.combatAlert).toBe("Contact");
      act(() => vi.advanceTimersByTime(3000));
      expect(result.current.combatAlert).toBeNull();
    } finally {
      vi.useRealTimers();
    }

    const { rerender } = renderHook((props) => useGameAudioLifecycle(props), {
      initialProps: { seed: 421, missionIndex: 3, tutorial: false, paused: true },
    });
    rerender({ seed: 421, missionIndex: 3, tutorial: false, paused: false });
  });
});

describe("useGameKeyboard", () => {
  it("dispatches pause, tabs, tools, save, and navigation commands", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const refs = {
      stateRef: { current: state },
      pausedRef: { current: false },
      pauseViewRef: { current: "main" as PauseView },
      activeTabRef: { current: "construction" as CommandTab },
      place: { current: null },
      repair: { current: false },
      sell: { current: false },
    };
    const openPauseMenu = vi.fn();
    const setActiveTab = vi.fn();
    const toggleRepair = vi.fn();
    const saveMission = vi.fn();
    const onNavigateHome = vi.fn();
    renderHook(() => useGameKeyboard({
      ...refs,
      openPauseMenu,
      resumeMission: vi.fn(),
      setPauseView: vi.fn(),
      setPauseNotice: vi.fn(),
      setActiveTab,
      activateCameo: vi.fn(),
      jumpHome: vi.fn(),
      centerSelection: vi.fn(),
      toggleRepair,
      toggleSell: vi.fn(),
      stopSelected: vi.fn(),
      clearTools: vi.fn(),
      saveMission,
      loadMission: vi.fn(),
      viewMissionBriefing: vi.fn(),
      restartMission: vi.fn(),
      toggleSound: vi.fn(),
      toggleMusic: vi.fn(),
      resultPrimary: vi.fn(),
      onNavigateHome,
    }));

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" })));
    refs.pausedRef.current = true;
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" })));

    expect(openPauseMenu).toHaveBeenCalledOnce();
    expect(setActiveTab).toHaveBeenCalledWith("production");
    expect(toggleRepair).toHaveBeenCalledOnce();
    expect(saveMission).toHaveBeenCalledOnce();
    expect(onNavigateHome).not.toHaveBeenCalled();
  });

  it("uses Escape to cancel an open mission confirmation without dispatching another command", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const cancelConfirmation = vi.fn();
    const resumeMission = vi.fn();
    const saveMission = vi.fn();
    renderHook(() => useGameKeyboard({
      stateRef: { current: state },
      pausedRef: { current: true },
      pauseViewRef: { current: "main" },
      activeTabRef: { current: "construction" },
      place: { current: null },
      repair: { current: false },
      sell: { current: false },
      openPauseMenu: vi.fn(),
      resumeMission,
      setPauseView: vi.fn(),
      setPauseNotice: vi.fn(),
      setActiveTab: vi.fn(),
      activateCameo: vi.fn(),
      jumpHome: vi.fn(),
      centerSelection: vi.fn(),
      toggleRepair: vi.fn(),
      toggleSell: vi.fn(),
      stopSelected: vi.fn(),
      clearTools: vi.fn(),
      saveMission,
      loadMission: vi.fn(),
      viewMissionBriefing: vi.fn(),
      restartMission: vi.fn(),
      toggleSound: vi.fn(),
      toggleMusic: vi.fn(),
      resultPrimary: vi.fn(),
      onNavigateHome: vi.fn(),
      confirmationOpen: true,
      cancelConfirmation,
    }));

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));

    expect(cancelConfirmation).toHaveBeenCalledOnce();
    expect(resumeMission).not.toHaveBeenCalled();
    expect(saveMission).not.toHaveBeenCalled();
  });
});
