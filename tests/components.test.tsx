// @vitest-environment jsdom

import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileCommandDock } from "../components/game/MobileCommandDock";
import { MobileCommandSheet } from "../components/game/MobileCommandSheet";
import { CommandCatalogContent } from "../components/game/CommandCatalogContent";
import { MenuOverlay } from "../components/menu/MenuOverlay";
import { SeedEntry } from "../components/menu/SeedEntry";
import { PauseMenu } from "../components/game/PauseMenu";
import { defaultSettings } from "../lib/persist/settings";
import type { Palette } from "../lib/types";
import { generateVisualProfile } from "../lib/gen/visualProfile";
import { addUnit, makeFixture } from "../lib/sim/fixtures";

const palette: Palette = {
  primary: "#4a7",
  secondary: "#253",
  accent: "#fd0",
  outline: "#111",
  light: "#8c8",
  dark: "#131",
};

vi.mock("@/components/assets/AssetsBrowser", () => ({
  AssetsBrowser: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close assets</button>,
}));
vi.mock("@/components/audio/SoundtrackPanel", () => ({
  SoundtrackPanel: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close soundtrack</button>,
}));
vi.mock("@/components/game/ConstructionCameos", () => ({ ConstructionCameos: () => <div data-testid="construction-catalog" /> }));
vi.mock("@/components/game/ProductionCameos", () => ({ ProductionCameos: () => <div data-testid="production-catalog" /> }));
vi.mock("@/components/game/SelectionPanel", () => ({ SelectionPanel: () => <div data-testid="selection-catalog" /> }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("MobileCommandDock", () => {
  it("describes selection mode and exposes move only for a unit selection", () => {
    const onCommand = vi.fn();
    const onSelectionMode = vi.fn();
    const onOpenSheet = vi.fn();
    const onPause = vi.fn();
    const { rerender } = render(
      <MobileCommandDock
        surface={{ dockVisible: true, sheetOpen: false, sheetContext: "base", activeCommand: null, selectionMode: false, selectedCount: 0 }}
        onCommand={onCommand}
        onSelectionMode={onSelectionMode}
        onOpenSheet={onOpenSheet}
        onPause={onPause}
      />,
    );

    expect(screen.getByTestId("mobile-command-dock")).toHaveTextContent("No selection");
    expect(screen.queryByTestId("mobile-command-move")).toBeNull();
    fireEvent.click(screen.getByTestId("mobile-select-mode"));
    expect(onSelectionMode).toHaveBeenCalledWith(true);

    rerender(
      <MobileCommandDock
        surface={{ dockVisible: true, sheetOpen: false, sheetContext: "unit", activeCommand: "move", selectionMode: true, selectedCount: 1 }}
        onCommand={onCommand}
        onSelectionMode={onSelectionMode}
        onOpenSheet={onOpenSheet}
        onPause={onPause}
      />,
    );
    expect(screen.getByTestId("mobile-marquee")).toBeVisible();
    expect(screen.getByTestId("mobile-command-move")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("mobile-command-move"));
    expect(onCommand).toHaveBeenCalledWith("move");
  });

  it("does not render when the battlefield is not mobile-playing", () => {
    render(
      <MobileCommandDock
        surface={{ dockVisible: false, sheetOpen: false, sheetContext: "base", activeCommand: null, selectionMode: false, selectedCount: 0 }}
        onCommand={vi.fn()}
        onSelectionMode={vi.fn()}
        onOpenSheet={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("mobile-command-dock")).toBeNull();
  });
});

describe("MobileCommandSheet", () => {
  it("renders unit orders, catalog controls, and closes", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const selected = addUnit(state, 0, "infantry", 2, 2);
    const onClose = vi.fn();
    const onCommand = vi.fn();
    const props = {
      open: true,
      state,
      palette,
      profile: generateVisualProfile(421, 0),
      selected,
      selectedCount: 1,
      activeTab: "selected" as const,
      command: null,
      placeKind: null,
      repairMode: false,
      sellMode: false,
      power: 10,
      produced: 20,
      used: 10,
      miniRef: createRef<HTMLCanvasElement>(),
      onClose,
      onTab: vi.fn(),
      onCommand,
      onStop: vi.fn(),
      onRepair: vi.fn(),
      onSell: vi.fn(),
      onStance: vi.fn(),
      onFormation: vi.fn(),
      onPlace: vi.fn(),
      onCancelBuilding: vi.fn(),
      onQueueUnit: vi.fn(),
      onCancelUnit: vi.fn(),
      availableProducer: vi.fn(),
      onMinimapPointerDown: vi.fn(),
      onMinimapPointerMove: vi.fn(),
      onMinimapPointerUp: vi.fn(),
      isMinimapDragging: false,
    };
    const { rerender } = render(<MobileCommandSheet {...props} />);

    expect(screen.getByTestId("mobile-unit-commands")).toBeVisible();
    expect(screen.getByTestId("mobile-build-controls")).toBeVisible();
    fireEvent.click(screen.getByTestId("mobile-command-move"));
    expect(onCommand).toHaveBeenCalledWith("move");
    fireEvent.click(screen.getByTestId("mobile-command-close"));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<MobileCommandSheet {...props} open={false} />);
    expect(screen.queryByTestId("mobile-command-sheet")).toBeNull();
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
    expect(screen.getByRole("dialog", { name: "New campaign" })).toBeVisible();
    rerender(<MenuOverlay {...props} view="options" />);
    expect(screen.getByRole("dialog", { name: "Game options" })).toBeVisible();
  });
});

describe("PauseMenu", () => {
  it("routes main actions and alternate views through callbacks", () => {
    const onResume = vi.fn();
    const onAssets = vi.fn();
    const onSoundtrack = vi.fn();
    const onOptions = vi.fn();
    const onBack = vi.fn();
    const props = {
      view: "main" as const,
      notice: "Mission saved.",
      settings: defaultSettings(),
      palette,
      seed: 421,
      missionIndex: 0,
      onResume,
      onSave: vi.fn(),
      onLoad: vi.fn(),
      onBriefing: vi.fn(),
      onRestart: vi.fn(),
      onAssets,
      onSoundtrack,
      onOptions,
      onMenu: vi.fn(),
      onToggleSound: vi.fn(),
      onToggleMusic: vi.fn(),
      onVolumeChange: vi.fn(),
      onBack,
      onCloseAssets: vi.fn(),
    };
    const { rerender } = render(<PauseMenu {...props} />);
    expect(screen.getByTestId("pause-menu")).toHaveTextContent("Mission saved.");
    fireEvent.click(screen.getByRole("button", { name: "Resume Mission" }));
    expect(onResume).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Assets" }));
    expect(onAssets).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Soundtrack" }));
    expect(onSoundtrack).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(onOptions).toHaveBeenCalledOnce();

    rerender(<PauseMenu {...props} view="soundtrack" notice="" />);
    fireEvent.click(screen.getByRole("button", { name: "Close soundtrack" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
