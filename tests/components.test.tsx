// @vitest-environment jsdom

import { createRef, useRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileCommandLauncher } from "../components/game/MobileCommandLauncher";
import { MobileTouchControls } from "../components/game/MobileTouchControls";
import { SelectionOrders } from "../components/game/SelectionOrders";
import { CommandCatalogContent } from "../components/game/CommandCatalogContent";
import { MenuHero } from "../components/menu/MenuHero";
import { MenuOverlay } from "../components/menu/MenuOverlay";
import { MenuMainPanel } from "../components/menu/MenuMainPanel";
import { NewGameSetup } from "../components/menu/NewGameSetup";
import { SeedEntry } from "../components/menu/SeedEntry";
import { PauseMenu } from "../components/game/PauseMenu";
import { MissionConfirmation } from "../components/game/MissionConfirmation";
import { BriefingActions } from "../components/briefing/BriefingActions";
import { createCampaign } from "../lib/gen/campaign";
import { defaultSettings } from "../lib/persist/settings";
import type { Palette } from "../lib/types";
import { generateVisualProfile } from "../lib/gen/visualProfile";
import { makeFixture } from "../lib/sim/fixtures";

const palette: Palette = {
  primary: "#4a7",
  secondary: "#253",
  accent: "#fd0",
  outline: "#111",
  light: "#8c8",
  dark: "#131",
};

vi.mock("@/components/audio/SoundtrackPanel", () => ({
  SoundtrackPanel: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close soundtrack</button>,
}));
vi.mock("@/components/game/ConstructionCameos", () => ({ ConstructionCameos: () => <div data-testid="construction-catalog" /> }));
vi.mock("@/components/game/ProductionCameos", () => ({ ProductionCameos: () => <div data-testid="production-catalog" /> }));
vi.mock("@/components/game/SelectionPanel", () => ({ SelectionPanel: () => <div data-testid="selection-catalog" /> }));

function ControlledSeedEntry() {
  const [code, setCode] = useState("0421");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <SeedEntry
      code={code}
      error=""
      previewLine="Preview"
      inputRef={inputRef}
      onChange={setCode}
      onRandomize={vi.fn()}
      onLaunch={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("mobile command controls", () => {
  it("describes selection mode and exposes map commands only for a unit selection", () => {
    const onCommand = vi.fn();
    const onSelectionMode = vi.fn();
    const { rerender } = render(
      <MobileTouchControls
        selectedCount={0}
        hasUnitSelection={false}
        selectionMode={false}
        activeCommand={null}
        onCommand={onCommand}
        onSelectionMode={onSelectionMode}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByTestId("mobile-touch-controls")).toHaveTextContent("No selection");
    expect(screen.queryByTestId("mobile-command-move")).toBeNull();
    fireEvent.click(screen.getByTestId("mobile-select-mode"));
    expect(onSelectionMode).toHaveBeenCalledWith(true);

    rerender(
      <MobileTouchControls
        selectedCount={1}
        hasUnitSelection
        selectionMode
        activeCommand="move"
        onCommand={onCommand}
        onSelectionMode={onSelectionMode}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByTestId("mobile-command-move")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("mobile-command-move"));
    expect(onCommand).toHaveBeenCalledWith("move");
  });

  it("keeps select available without a unit selection", () => {
    render(
      <MobileTouchControls
        selectedCount={0}
        hasUnitSelection={false}
        selectionMode={false}
        activeCommand={null}
        onCommand={vi.fn()}
        onSelectionMode={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByTestId("mobile-select-mode")).toBeVisible();
    expect(screen.queryByTestId("mobile-command-move")).toBeNull();
  });
});

describe("MobileCommandLauncher", () => {
  it("opens and closes the portrait command panel from the compact rail", () => {
    const onToggle = vi.fn();
    const buttonRef = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <MobileCommandLauncher open={false} onToggle={onToggle} buttonRef={buttonRef} />,
    );

    expect(screen.getByTestId("mobile-command-toggle")).toHaveAttribute("aria-label", "Open commands");
    expect(screen.getByTestId("mobile-command-icon").querySelectorAll("path")).toHaveLength(3);
    expect(screen.queryByTestId("mobile-command-scrim")).toBeNull();
    fireEvent.click(screen.getByTestId("mobile-command-toggle"));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<MobileCommandLauncher open onToggle={onToggle} buttonRef={buttonRef} />);
    expect(screen.getByTestId("mobile-command-toggle")).toHaveAttribute("aria-label", "Close commands");
    fireEvent.click(screen.getByTestId("mobile-command-scrim"));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

describe("BriefingActions", () => {
  it("removes the duplicate back button when returning to a mission", () => {
    render(
      <BriefingActions
        campaign={createCampaign(421)}
        returnToGame
        onReplay={vi.fn()}
        onLaunch={vi.fn()}
        onBack={vi.fn()}
        backLabel="Back to mission"
      />,
    );

    expect(screen.queryByRole("button", { name: "Back to mission" })).toBeNull();
    expect(screen.getByRole("button", { name: "Return to mission" })).toBeVisible();
  });
});

describe("SelectionOrders", () => {
  it("routes stop, stance, and formation actions to the selected units", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const onStance = vi.fn();
    const onFormation = vi.fn();

    render(
      <SelectionOrders
        stance="aggressive"
        formation={undefined}
        onStop={onStop}
        onStance={onStance}
        onFormation={onFormation}
      />,
    );

    await user.click(screen.getByTestId("selected-action-stop"));
    await user.click(screen.getByTestId("selected-action-stance-hold"));
    await user.click(screen.getByTestId("selected-action-formation-wedge"));

    expect(onStop).toHaveBeenCalledOnce();
    expect(onStance).toHaveBeenCalledWith("hold");
    expect(onFormation).toHaveBeenCalledWith("wedge");
  });
});

describe("CommandCatalogContent", () => {
  it("routes each tab to one shared content surface", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const props = {
      state,
      palette,
      profile: generateVisualProfile(421, 0),
      activeTab: "construction" as const,
      placeKind: null,
      selected: undefined,
      power: 0,
      availableProducer: vi.fn(),
      onPlace: vi.fn(),
      onCancelBuilding: vi.fn(),
      onQueueUnit: vi.fn(),
      onCancelUnit: vi.fn(),
      onStop: vi.fn(),
      onStance: vi.fn(),
      onFormation: vi.fn(),
    };
    const { rerender } = render(<CommandCatalogContent {...props} />);
    expect(screen.getByTestId("construction-catalog")).toBeVisible();
    rerender(<CommandCatalogContent {...props} activeTab="production" />);
    expect(screen.getByTestId("production-catalog")).toBeVisible();
    rerender(<CommandCatalogContent {...props} activeTab="selected" />);
    expect(screen.getByTestId("selection-catalog")).toBeVisible();
  });
});

describe("SeedEntry", () => {
  it("selects an existing seed so typing replaces it", async () => {
    const user = userEvent.setup();
    render(<ControlledSeedEntry />);
    const input = screen.getByLabelText<HTMLInputElement>("Four digit theater seed");

    input.focus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(4);

    await user.keyboard("9876");
    expect(input).toHaveValue("9876");
  });

  it("sanitizes input and launches on Enter or Roll", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onLaunch = vi.fn();
    const onRandomize = vi.fn();
    render(
      <SeedEntry
        code="12"
        error=""
        previewLine="Preview"
        inputRef={createRef<HTMLInputElement>()}
        onChange={onChange}
        onRandomize={onRandomize}
        onLaunch={onLaunch}
      />,
    );
    const input = screen.getByLabelText("Four digit theater seed");
    fireEvent.change(input, { target: { value: "a1b23456" } });
    expect(onChange).toHaveBeenCalledWith("1234");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onLaunch).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Roll" }));
    expect(onRandomize).toHaveBeenCalledOnce();
    expect(screen.queryByText("placeholder")).toBeNull();
  });

  it("keeps seed status height without a placeholder word", () => {
    render(
      <SeedEntry
        code="12"
        error=""
        previewLine="Preview"
        inputRef={createRef<HTMLInputElement>()}
        onChange={vi.fn()}
        onRandomize={vi.fn()}
        onLaunch={vi.fn()}
      />,
    );
    expect(document.body.textContent).not.toContain("placeholder");
  });
});

describe("MenuOverlay", () => {
  it("renders only the active overlay view", () => {
    const props = {
      code: "0421",
      error: "",
      previewLine: "Theater",
      inputRef: createRef<HTMLInputElement>(),
      settings: defaultSettings(),
      onChange: vi.fn(),
      onRandomize: vi.fn(),
      onLaunch: vi.fn(),
      onToggleSound: vi.fn(),
      onToggleMusic: vi.fn(),
      onVolumeChange: vi.fn(),
      onBack: vi.fn(),
    };
    const { rerender } = render(<MenuOverlay {...props} view="main" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<MenuOverlay {...props} view="newGame" />);
    expect(screen.getByRole("dialog", { name: "New theater" })).toBeVisible();
    rerender(<MenuOverlay {...props} view="options" />);
    expect(screen.getByRole("dialog", { name: "Game options" })).toBeVisible();
  });
});

describe("NewGameSetup", () => {
  it("does not expose an operations map action", () => {
    render(
      <NewGameSetup
        code="0421"
        error=""
        previewLine="Theater"
        inputRef={createRef<HTMLInputElement>()}
        onChange={vi.fn()}
        onRandomize={vi.fn()}
        onLaunch={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "New theater" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Operations map" })).toBeNull();
  });
});

describe("MenuHero", () => {
  it("renders the product title once without repeating it as an eyebrow", () => {
    render(<MenuHero />);

    expect(screen.getByRole("heading", { name: "DYNAMICA" })).toBeVisible();
    expect(screen.getByText("COMMAND")).toBeVisible();
    expect(screen.getByText("Harvest. Build. Conquer.")).toBeInTheDocument();
    expect(screen.queryByText("Dynamica command")).toBeNull();
  });
});

describe("MenuMainPanel dashboard", () => {
  const handlers = {
    onNewGame: vi.fn(),
    onTutorial: vi.fn(),
    onLoadMission: vi.fn(),
    onOptions: vi.fn(),
  };

  const renderDashboard = () => render(
    <MenuMainPanel
      {...handlers}
    />,
  );

  it("shows one unified main menu when the archive is empty", () => {
    renderDashboard();

    expect(screen.getByTestId("menu-dashboard")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Main menu" })).toHaveTextContent("TUTORIAL");
    expect(screen.getByRole("navigation", { name: "Main menu" })).toHaveTextContent("LOAD MISSION");
    expect(screen.getByRole("navigation", { name: "Main menu" })).not.toHaveTextContent("Campaign archive");
    expect(screen.queryByRole("button", { name: "IMPORT SAVE" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "NEW GAME" }));
    fireEvent.click(screen.getByRole("button", { name: "TUTORIAL" }));
    fireEvent.click(screen.getByRole("button", { name: "LOAD MISSION" }));
    fireEvent.click(screen.getByRole("button", { name: "OPTIONS" }));
    expect(handlers.onNewGame).toHaveBeenCalledOnce();
    expect(handlers.onTutorial).toHaveBeenCalledOnce();
    expect(handlers.onLoadMission).toHaveBeenCalledOnce();
    expect(handlers.onOptions).toHaveBeenCalledOnce();
  });
});

describe("PauseMenu", () => {
  it("routes main actions and alternate views through callbacks", () => {
    const onResume = vi.fn();
    const onSoundtrack = vi.fn();
    const onOptions = vi.fn();
    const onControls = vi.fn();
    const onBack = vi.fn();
    const onCommitSave = vi.fn(() => true);
    const onLoadEntry = vi.fn();
    const props = {
      view: "main" as const,
      notice: "Mission saved.",
      settings: defaultSettings(),
      seed: 421,
      missionIndex: 0,
      saveSlots: [],
      loadEntries: [],
      defaultSlotName: "Test · M1",
      onResume,
      onSave: vi.fn(),
      onLoad: vi.fn(),
      onCommitSave,
      onLoadEntry,
      onBriefing: vi.fn(),
      onRestart: vi.fn(),
      onControls,
      onSoundtrack,
      onOptions,
      onMenu: vi.fn(),
      onToggleSound: vi.fn(),
      onToggleMusic: vi.fn(),
      onVolumeChange: vi.fn(),
      onBack,
    };
    const { rerender } = render(<PauseMenu {...props} />);
    expect(screen.getByTestId("pause-menu")).toHaveTextContent("Mission saved.");
    expect(screen.getByText("Mission")).toBeVisible();
    expect(screen.getByText("Operation")).toBeVisible();
    expect(screen.getByText("Theater")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Export Save" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Resume Mission" }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Assets" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    expect(onControls).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Soundtrack" }));
    expect(onSoundtrack).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(onOptions).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Main Menu" })).toBeVisible();

    rerender(<PauseMenu {...props} view="controls" notice="" />);
    expect(screen.getByTestId("pause-controls")).toBeVisible();

    rerender(<PauseMenu {...props} view="save" notice="" />);
    expect(screen.getByRole("heading", { name: "Save mission" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onCommitSave).toHaveBeenCalledWith("Test · M1", null);

    rerender(<PauseMenu {...props} view="soundtrack" notice="" />);
    fireEvent.click(screen.getByRole("button", { name: "Close soundtrack" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("MissionConfirmation", () => {
  it("shows the requested action and routes confirm/cancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <MissionConfirmation
        confirmation={{
          action: "restart",
          title: "Restart mission?",
          message: "Restart this mission from the beginning?",
          confirmLabel: "Restart mission",
        }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Restart mission?" })).toHaveTextContent("Restart this mission");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart mission" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
