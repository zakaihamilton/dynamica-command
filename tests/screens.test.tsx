// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BriefingScreen } from "../components/briefing/BriefingScreen";
import { CampaignCompleteScreen } from "../components/campaign/CampaignCompleteScreen";
import { MenuScreen } from "../components/menu/MenuScreen";
import { freshCampaignProgress, writeCampaignProgress } from "../lib/persist/campaign";
import { localStorageAdapter } from "../lib/persist/save";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/audio/music", () => ({ setMusicEnabled: vi.fn() }));
vi.mock("@/lib/audio/synth", () => ({ setSfxEnabled: vi.fn(), beep: vi.fn() }));
vi.mock("@/lib/audio/mixer", () => ({ setAudioLevels: vi.fn() }));
vi.mock("@/components/menu/MenuBackdrop", () => ({ MenuBackdrop: () => <div data-testid="menu-backdrop" /> }));
vi.mock("@/components/menu/MenuHero", () => ({ MenuHero: () => <h1>Genesis Protocol</h1> }));
vi.mock("@/components/menu/MenuMainPanel", () => ({
  MenuMainPanel: ({ onNewGame, onOptions }: { onNewGame: () => void; onOptions: () => void }) => (
    <div><button onClick={onNewGame}>NEW GAME</button><button onClick={onOptions}>OPTIONS</button></div>
  ),
}));
vi.mock("@/components/menu/MenuOverlay", () => ({
  MenuOverlay: ({ view, onLaunch, onBack }: { view: string; onLaunch: () => void; onBack: () => void }) =>
    view === "main" ? null : <div role="dialog"><span>{view}</span><button onClick={onLaunch}>Launch</button><button onClick={onBack}>Back</button></div>,
}));
vi.mock("@/components/briefing/BriefingMast", () => ({ BriefingMast: () => <div data-testid="briefing-mast" /> }));
vi.mock("@/components/briefing/BriefingPortraits", () => ({
  BriefingAllyPortraits: () => <div data-testid="ally-portraits" />,
  BriefingEnemyPortrait: () => <div data-testid="enemy-portrait" />,
}));
vi.mock("@/components/briefing/BriefingStory", () => ({ BriefingStory: () => <div data-testid="briefing-story" /> }));
vi.mock("@/components/briefing/BriefingObjectives", () => ({ BriefingObjectives: () => <div data-testid="briefing-objectives" /> }));
vi.mock("@/components/briefing/BriefingActions", () => ({
  BriefingActions: ({ onLaunch, onReplay }: { onLaunch: () => void; onReplay: () => void }) => (
    <div data-testid="briefing-actions"><button onClick={onLaunch}>Launch</button><button onClick={onReplay}>Replay</button></div>
  ),
}));

beforeEach(() => {
  router.push.mockReset();
  window.localStorage.clear();
});

afterEach(() => cleanup());

describe("MenuScreen", () => {
  it("opens setup and launches the rolled theater", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.0421);
    render(<MenuScreen />);
    fireEvent.click(screen.getByRole("button", { name: "NEW GAME" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("newGame");
    fireEvent.click(screen.getByRole("button", { name: "Launch" }));
    expect(router.push).toHaveBeenCalledWith("/tutorial?seed=0421");
    vi.restoreAllMocks();
  });
});

describe("BriefingScreen", () => {
  it("renders missing, locked, and unlocked mission states", () => {
    const { rerender } = render(<BriefingScreen seed={421} mission={99} />);
    expect(screen.getByText("Mission missing.")).toBeVisible();
    rerender(<BriefingScreen seed={421} mission={1} />);
    expect(screen.getByText(/Mission locked/)).toBeVisible();
    rerender(<BriefingScreen seed={421} mission={0} />);
    expect(screen.getByTestId("briefing-screen")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Launch" }));
    expect(router.push).toHaveBeenCalledWith("/play?seed=0421&mission=0&fresh=1");
  });
});

describe("CampaignCompleteScreen", () => {
  it("shows archived progress and returns to the menu", () => {
    const progress = freshCampaignProgress(421);
    progress.completedMissions = [0];
    progress.medals = { "0": 3 };
    progress.bestScores = { "0": 1234 };
    writeCampaignProgress(localStorageAdapter(), progress);
    render(<CampaignCompleteScreen seed={421} />);

    expect(screen.getByRole("heading", { name: "Campaign record" })).toBeVisible();
    expect(screen.getByText("Best score 1234")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Return to menu" }));
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("previews available operations and keeps later missions locked", () => {
    const progress = freshCampaignProgress(421);
    progress.tutorialComplete = true;
    progress.unlockedMission = 1;
    progress.completedMissions = [0];
    writeCampaignProgress(localStorageAdapter(), progress);
    render(<CampaignCompleteScreen seed={421} mode="operations" />);

    expect(screen.getByRole("heading", { name: "Operations map" })).toBeVisible();
    expect(screen.getByTestId("mission-card-0")).toHaveAccessibleName(/Replay mission 1/i);
    expect(screen.getByTestId("mission-card-1")).toHaveAccessibleName(/Deploy mission 2/i);
    expect(screen.getByTestId("mission-card-2")).toHaveAccessibleName(/Locked mission 3/i);

    fireEvent.click(screen.getByTestId("mission-card-1"));
    expect(screen.getByTestId("mission-detail")).toHaveTextContent(/Primary objective/i);
    expect(screen.getByTestId("mission-detail")).toHaveTextContent(/Secondary objectives/i);
    expect(screen.getByTestId("mission-detail")).toHaveTextContent(/Expected duration/i);
    expect(screen.getByTestId("mission-detail")).toHaveTextContent(/Unlocks after completion/i);
    fireEvent.click(screen.getByTestId("launch-selected-mission"));
    expect(router.push).toHaveBeenCalledWith("/briefing?seed=0421&mission=1");
  });

  it("returns to the menu when Escape is pressed on the operations map", () => {
    render(<CampaignCompleteScreen seed={421} mode="operations" />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(router.push).toHaveBeenCalledWith("/");
  });
});
