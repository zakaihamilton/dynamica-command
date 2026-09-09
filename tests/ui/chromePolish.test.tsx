// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import NotFound from "../../app/not-found";
import { BriefingMast } from "../../components/briefing/BriefingMast";
import { BattlefieldHud } from "../../components/game/BattlefieldHud";
import { DocumentTitle } from "../../components/ui/DocumentTitle";
import { PageFallback } from "../../components/ui/PageFallback";
import { createCampaign } from "../../lib/gen/campaign";

afterEach(() => cleanup());

describe("product chrome", () => {
  it("renders a themed standby fallback", () => {
    render(<PageFallback>Deploying…</PageFallback>);
    expect(screen.getByTestId("page-fallback")).toHaveTextContent("Stand by");
    expect(screen.getByTestId("page-fallback")).toHaveTextContent("Deploying…");
  });

  it("renders a themed not-found notice", () => {
    render(<NotFound />);
    expect(screen.getByTestId("not-found")).toHaveTextContent("This frequency is dark");
    expect(screen.getByTestId("home-link")).toHaveAttribute("href", "/");
  });

  it("sets the document title and restores the previous title on unmount", () => {
    document.title = "Shifting Front";
    const { unmount } = render(<DocumentTitle title="Seed 0421 · Operation 1 | Shifting Front" />);
    expect(document.title).toBe("Seed 0421 · Operation 1 | Shifting Front");
    unmount();
    expect(document.title).toBe("Shifting Front");
  });

  it("labels the HUD as an operation instead of a level", () => {
    const campaign = createCampaign(421);
    render(
      <BattlefieldHud
        seed={421}
        levelNumber={1}
        levelCount={campaign.missions.length}
        missionName="System Failure"
        objective="Hold the line"
        profileLabel="Resource Race"
      />,
    );
    expect(screen.getByTestId("level-progress")).toHaveTextContent("Operation 1 of 6");
    expect(screen.getByText("System Failure")).toBeVisible();
    expect(screen.getByTestId("mission-profile")).toHaveTextContent("Resource Race");
  });

  it("uses the generated campaign length in the briefing mast", () => {
    const campaign = createCampaign(421);
    const mission = campaign.missions[0]!;
    const shorterCampaign = { ...campaign, missions: campaign.missions.slice(0, 3) };

    render(<BriefingMast seed={421} mission={0} campaign={shorterCampaign} def={mission} />);

    expect(screen.getByTestId("seed")).toHaveTextContent("Mission 1/3");
  });
});
