import { describe, expect, it, vi } from "vitest";
import { canvasPointerPos } from "../components/game/hooks/canvasPointer";
import { applyGameCommand } from "../components/game/hooks/gameKeyboard";
import { leastLoadedProducer } from "../components/game/hooks/gameActions";
import { resolvePointerUp } from "../components/game/hooks/gamePointerUp";
import { alertSfx, desiredMusicIntensity, warningAlert } from "../components/game/hooks/gameLoopEffects";
import { missionConfirmationFor } from "../components/game/hooks/missionConfirmation";
import { briefingPath, campaignCompletePath, menuPath, resultPrimaryPath } from "../components/game/hooks/missionRoutes";
import { gameOverlayModel } from "../components/game/gameOverlayModel";
import { playFieldStatus } from "../components/game/playFieldStatus";
import { createCamera, tileToScreen } from "../lib/iso";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";
import { heightAt } from "../lib/sim/world";
import type { GameCommandHandlers } from "../components/game/hooks/gameKeyboard";

vi.mock("@/lib/audio/synth", () => ({ beep: vi.fn() }));

function handlers(): GameCommandHandlers {
  return {
    activeTab: "construction",
    openPauseMenu: vi.fn(),
    resumeMission: vi.fn(),
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
    saveMission: vi.fn(),
    loadMission: vi.fn(),
    viewMissionBriefing: vi.fn(),
    restartMission: vi.fn(),
    toggleSound: vi.fn(),
    toggleMusic: vi.fn(),
    resultPrimary: vi.fn(),
    onNavigateHome: vi.fn(),
  };
}

describe("pointer canvas math", () => {
  it("maps client coordinates through the canvas scale", () => {
    expect(canvasPointerPos({
      currentTarget: {
        getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 50 }) as DOMRect,
        width: 200,
        height: 100,
      },
      clientX: 60,
      clientY: 45,
    })).toEqual({ x: 100, y: 50 });
  });
});

describe("pointer-up policy", () => {
  it("places a building, cancels tools on right-click, and issues a mobile command", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const cam = createCamera();
    const p = tileToScreen(4, 5, cam, heightAt(state, 4, 5));

    expect(resolvePointerUp({
      pointerType: "mouse",
      button: 0,
      ctrlKey: false,
      metaKey: false,
      p,
      state,
      cam,
      selectedIds: [],
      box: null,
      selectionMode: false,
      mobileCommand: null,
      placeKind: "power",
      repairMode: false,
      sellMode: false,
    })).toMatchObject({
      clearBox: true,
      clearPlace: true,
      beep: "build",
      commands: [{ type: "build", building: "power", x: 4, y: 5 }],
    });

    expect(resolvePointerUp({
      pointerType: "mouse",
      button: 2,
      ctrlKey: false,
      metaKey: false,
      p,
      state,
      cam,
      selectedIds: [],
      box: null,
      selectionMode: false,
      mobileCommand: null,
      placeKind: null,
      repairMode: true,
      sellMode: false,
    })).toEqual({ preventDefault: true, clearRepairAndSell: true, beep: "select" });

    expect(resolvePointerUp({
      pointerType: "mouse",
      button: 2,
      ctrlKey: true,
      metaKey: false,
      p,
      state,
      cam,
      selectedIds: [],
      box: null,
      selectionMode: false,
      mobileCommand: null,
      placeKind: null,
      repairMode: false,
      sellMode: false,
    })).toEqual({ preventDefault: true, contextOrder: true, attackMove: true });

    const unit = addUnit(state, 0, "infantry", 2, 2);
    expect(resolvePointerUp({
      pointerType: "touch",
      button: 0,
      ctrlKey: false,
      metaKey: false,
      p,
      state,
      cam,
      selectedIds: [unit.id],
      box: null,
      selectionMode: false,
      mobileCommand: "move",
      placeKind: null,
      repairMode: false,
      sellMode: false,
    })).toMatchObject({
      clearMobileCommand: true,
      beep: "ack",
      commands: [{ type: "move", unitIds: [unit.id], x: 4, y: 5 }],
    });
  });

  it("repairs a friendly building and drag-selects without a beep", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const yard = addBuilding(state, 0, "power", 3, 3);
    const cam = createCamera();
    const p = tileToScreen(yard.x, yard.y, cam, heightAt(state, yard.x, yard.y));

    expect(resolvePointerUp({
      pointerType: "mouse",
      button: 0,
      ctrlKey: false,
      metaKey: false,
      p,
      state,
      cam,
      selectedIds: [],
      box: null,
      selectionMode: false,
      mobileCommand: null,
      placeKind: null,
      repairMode: true,
      sellMode: false,
    })).toMatchObject({
      clearBox: true,
      beep: "build",
      commands: [{ type: "repair", buildingId: yard.id }],
    });

    expect(resolvePointerUp({
      pointerType: "mouse",
      button: 0,
      ctrlKey: false,
      metaKey: false,
      p: { x: 0, y: 0 },
      state,
      cam,
      selectedIds: [],
      box: { x0: 0, y0: 0, x1: 20, y1: 20 },
      selectionMode: false,
      mobileCommand: null,
      placeKind: null,
      repairMode: false,
      sellMode: false,
    })).toEqual({ clearBox: true, select: [] });
  });
});

describe("keyboard command dispatch", () => {
  it("routes pause, tabs, tools, and navigation commands", () => {
    const next = handlers();
    applyGameCommand({ type: "pause" }, next);
    applyGameCommand({ type: "resume" }, next);
    applyGameCommand({ type: "tab", tab: "production" }, next);
    applyGameCommand({ type: "cameo", index: 1, cancel: false }, next);
    applyGameCommand({ type: "repair" }, next);
    applyGameCommand({ type: "cancelTool" }, next);
    applyGameCommand({ type: "assets" }, next);
    applyGameCommand({ type: "resultMenu" }, next);
    expect(next.openPauseMenu).toHaveBeenCalledOnce();
    expect(next.resumeMission).toHaveBeenCalledOnce();
    expect(next.setActiveTab).toHaveBeenCalledWith("production");
    expect(next.activateCameo).toHaveBeenCalledWith("construction", 1, false);
    expect(next.toggleRepair).toHaveBeenCalledOnce();
    expect(next.clearTools).toHaveBeenCalledOnce();
    expect(next.setPauseView).toHaveBeenCalledWith("assets");
    expect(next.onNavigateHome).toHaveBeenCalledOnce();
  });

  it("ignores cameo shortcuts while the selected tab is open", () => {
    const next = handlers();
    next.activeTab = "selected";
    applyGameCommand({ type: "cameo", index: 0, cancel: true }, next);
    expect(next.activateCameo).not.toHaveBeenCalled();
  });
});

describe("mission confirmation and routes", () => {
  it("builds confirmation copy and result destinations", () => {
    expect(missionConfirmationFor("restart")).toMatchObject({
      action: "restart",
      confirmLabel: "Restart mission",
    });
    expect(briefingPath(421, 2, true)).toBe("/briefing?seed=0421&mission=2&return=game");
    expect(campaignCompletePath(7)).toBe("/campaign-complete?seed=0007");
    expect(menuPath()).toBe("/");
    expect(resultPrimaryPath({ result: "won", seed: 421, missionIndex: 3 })).toBe("/briefing?seed=0421&mission=4");
    expect(resultPrimaryPath({ result: "won", seed: 421, missionIndex: 7 })).toBe("/");
    expect(resultPrimaryPath({ result: "lost", seed: 421, missionIndex: 3 })).toBe("/briefing?seed=0421&mission=3");
  });
});

describe("production and overlay helpers", () => {
  it("picks the least-loaded ready producer", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const first = addBuilding(state, 0, "barracks", 2, 2);
    const second = addBuilding(state, 0, "barracks", 5, 2);
    first.producing = { kind: "infantry", remaining: 8 };
    expect(leastLoadedProducer(state, 0, "infantry")?.id).toBe(second.id);
    expect(leastLoadedProducer(state, 0, "medic")?.id).toBe(second.id);
  });

  it("derives play-field copy and overlay chrome from sim state", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const unit = addUnit(state, 0, "infantry", 2, 2);
    addUnit(state, 1, "tank", 8, 8);
    expect(playFieldStatus(state)).toMatchObject({
      objective: "Hostiles left 1",
      secondary: [],
    });
    const overlay = gameOverlayModel({ state, selectedIds: [unit.id], tutorial: false, paused: false });
    expect(overlay.mobilePlaying).toBe(true);
    expect(overlay.sheetContext).toBe("unit");
    expect(overlay.selected?.id).toBe(unit.id);
    expect(gameOverlayModel({ state, selectedIds: [], tutorial: true, paused: false }).mobilePlaying).toBe(false);
  });
});

describe("loop audio intensity", () => {
  it("escalates from director phase, recent combat, and warning alerts", () => {
    expect(desiredMusicIntensity("opening", 10, Number.NEGATIVE_INFINITY, false)).toBe("calm");
    expect(desiredMusicIntensity("pressure", 10, Number.NEGATIVE_INFINITY, false)).toBe("engaged");
    expect(desiredMusicIntensity("finale", 10, Number.NEGATIVE_INFINITY, false)).toBe("critical");
    expect(desiredMusicIntensity("opening", 50, 40, false)).toBe("engaged");
    expect(desiredMusicIntensity("finale", 50, 40, true)).toBe("critical");
    expect(warningAlert([{ type: "alert", kind: "warning", text: "Incoming" }])).toBe(true);
    expect(warningAlert([
      { type: "alert", kind: "contact", text: "Spotted" },
      { type: "alert", kind: "warning", text: "Incoming" },
    ])).toBe(false);
    expect(alertSfx("objective")).toBe("objective");
  });
});
