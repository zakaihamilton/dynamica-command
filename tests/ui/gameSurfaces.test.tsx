// @vitest-environment jsdom

import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCampaign } from "../../lib/gen/campaign";
import { defaultSettings } from "../../lib/persist/settings";
import { addUnit, makeFixture } from "../../lib/sim/fixtures";
import { generateVisualProfile } from "../../lib/gen/visualProfile";
import type { GameActions } from "../../components/game/hooks/useGameActions";
import type { GameCamera } from "../../components/game/hooks/useGameCamera";
import type { GameSession } from "../../components/game/hooks/useGameSession";
import { GameOverlays } from "../../components/game/GameOverlays";
import { MissionResultActions } from "../../components/game/MissionResultActions";

vi.mock("../../components/game/MobileCommandLauncher", () => ({
  MobileCommandLauncher: ({ open }: { open: boolean }) => <div data-testid="surface-mobile-launcher" data-open={open ? "true" : "false"} />,
}));
vi.mock("../../components/game/CommandSidebar", () => ({
  CommandSidebar: ({
    onStop,
    onStance,
    onFormation,
  }: {
    onStop: () => void;
    onStance: (stance: "aggressive") => void;
    onFormation: (formation: "line") => void;
  }) => {
    onStop();
    onStance("aggressive");
    onFormation("line");
    return <div data-testid="surface-sidebar" />;
  },
}));
vi.mock("../../components/game/PauseMenu", () => ({
  PauseMenu: ({
    onSoundtrack,
    onOptions,
    onBack,
  }: {
    onSoundtrack: () => void;
    onOptions: () => void;
    onBack: () => void;
  }) => {
    onSoundtrack();
    onOptions();
    onBack();
    return <div data-testid="surface-pause" />;
  },
}));

afterEach(() => cleanup());

function testActions(): GameActions {
  const noop = vi.fn();
  return {
    place: { current: null },
    placeRef: { current: null },
    placeKind: null,
    setPlaceKind: noop,
    repair: { current: false },
    repairRef: { current: false },
    repairMode: false,
    setRepairMode: noop,
    sell: { current: false },
    sellRef: { current: false },
    sellMode: false,
    setSellMode: noop,
    mobileCommand: { current: null },
    mobileCommandRef: { current: null },
    mobileCommandState: null,
    setMobileCommandState: noop,
    clearTools: noop,
    chooseMobileCommand: noop,
    cancelMobileCommand: noop,
    issueSelectedCommand: noop,
    togglePlace: noop,
    toggleRepair: noop,
    toggleSell: noop,
    cancelBuilding: noop,
    availableProducer: noop,
    queueUnit: noop,
    cancelUnit: noop,
    activateCameo: noop,
  } as unknown as GameActions;
}

function testSession(): GameSession {
  const noop = vi.fn();
  return {
    confirmation: null,
    confirmAction: noop,
    cancelConfirmation: noop,
    openPauseMenu: noop,
    resumeMission: noop,
    saveMission: noop,
    loadMission: noop,
    saveNamedSlot: () => false,
    loadArchiveEntry: noop,
    defaultSlotName: () => "Test · M1",
    listSaveSlots: () => [],
    listLoadEntries: () => [],
    viewMissionBriefing: noop,
    restartMission: noop,
    toggleSound: noop,
    toggleMusic: noop,
    updateVolume: noop,
    advanceTutorial: noop,
    exitTutorial: noop,
    resultPrimary: noop,
    goHome: noop,
    goMenu: noop,
    goNextBriefing: noop,
    goCampaignVictory: noop,
    goRetry: noop,
  } as unknown as GameSession;
}

describe("game overlay surfaces", () => {
  it("switches mobile, sidebar, pause, tutorial, and terminal states", () => {
    const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    const unit = addUnit(state, 0, "infantry", 2, 2);
    const camera = {
      onMinimapPointerDown: vi.fn(),
      onMinimapPointerMove: vi.fn(),
      onMinimapPointerUp: vi.fn(),
      isMinimapDragging: false,
    } as unknown as GameCamera;
    const props = {
      campaign: createCampaign(421),
      state,
      playerVisualProfile: generateVisualProfile(421, 0),
      selectedIds: [unit.id],
      tutorial: false,
      selectionMode: false,
      mobilePanelOpen: true,
      mobileLauncherRef: createRef<HTMLButtonElement>(),
      miniRef: createRef<HTMLCanvasElement>(),
      activeTab: "construction" as const,
      onTab: vi.fn(),
      paused: false,
      pauseView: "main" as const,
      pauseNotice: "",
      audioSettings: defaultSettings(),
      camera,
      setPauseView: vi.fn(),
      setPauseNotice: vi.fn(),
      onToggleMobilePanel: vi.fn(),
      onPause: vi.fn(),
      actions: testActions(),
      session: testSession(),
    };
    const { rerender } = render(<GameOverlays {...props} />);

    expect(screen.getByTestId("surface-mobile-launcher")).toBeVisible();
    expect(screen.getByTestId("surface-sidebar")).toBeVisible();

    rerender(
      <GameOverlays
        {...props}
        session={{
          ...props.session,
          confirmation: {
            action: "menu",
            title: "Leave mission?",
            message: "Return to the main menu?",
            confirmLabel: "Leave mission",
          },
        }}
      />,
    );
    expect(screen.queryByTestId("surface-mobile-launcher")).toBeNull();
    expect(screen.getByTestId("mission-confirmation")).toBeVisible();

    rerender(<GameOverlays {...props} paused />);
    expect(screen.queryByTestId("surface-mobile-launcher")).toBeNull();
    expect(screen.getByTestId("surface-pause")).toBeVisible();

    rerender(<GameOverlays {...props} tutorial state={{ ...state, result: "won" }} paused={false} />);
    expect(screen.queryByTestId("surface-mobile-launcher")).toBeNull();
    expect(screen.queryByTestId("surface-sidebar")).toBeNull();
    expect(screen.queryByTestId("surface-pause")).toBeNull();
  });

  it("offers to replay a completed mission", () => {
    const state = { ...makeFixture({ seed: 421, win: { kind: "annihilate" } }), result: "won" as const };
    const onRetry = vi.fn();

    render(
      <MissionResultActions
        state={state}
        onNextBriefing={vi.fn()}
        onCampaignVictory={vi.fn()}
        onCampaignMap={vi.fn()}
        onRetry={onRetry}
        onMenu={vi.fn()}
        onSoundtrack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Replay mission" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps command controls available during tutorial play", () => {
    const state = makeFixture({ seed: 421, win: { kind: "annihilate" } });
    const props = {
      campaign: createCampaign(421),
      state,
      playerVisualProfile: generateVisualProfile(421, 0),
      selectedIds: [],
      tutorial: true,
      selectionMode: false,
      mobilePanelOpen: false,
      mobileLauncherRef: createRef<HTMLButtonElement>(),
      miniRef: createRef<HTMLCanvasElement>(),
      activeTab: "construction" as const,
      onTab: vi.fn(),
      paused: false,
      pauseView: "main" as const,
      pauseNotice: "",
      audioSettings: defaultSettings(),
      camera: {
        onMinimapPointerDown: vi.fn(),
        onMinimapPointerMove: vi.fn(),
        onMinimapPointerUp: vi.fn(),
        isMinimapDragging: false,
      } as unknown as GameCamera,
      setPauseView: vi.fn(),
      setPauseNotice: vi.fn(),
      onToggleMobilePanel: vi.fn(),
      onPause: vi.fn(),
      actions: testActions(),
      session: testSession(),
    };

    render(<GameOverlays {...props} />);

    expect(screen.getByTestId("surface-mobile-launcher")).toBeVisible();
    expect(screen.getByTestId("surface-sidebar")).toBeVisible();
  });
});
