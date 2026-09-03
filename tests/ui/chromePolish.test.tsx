// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import NotFound from "../../app/not-found";
import { BattlefieldHud } from "../../components/game/BattlefieldHud";
import { DocumentTitle } from "../../components/ui/DocumentTitle";
import { PageFallback } from "../../components/ui/PageFallback";

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
    document.title = "Dynamica Command";
    const { unmount } = render(<DocumentTitle title="Seed 0421 · Operation 1 | Dynamica Command" />);
    expect(document.title).toBe("Seed 0421 · Operation 1 | Dynamica Command");
    unmount();
    expect(document.title).toBe("Dynamica Command");
  });

  it("labels the HUD as an operation instead of a level", () => {
    render(
      <BattlefieldHud
        seed={421}
        levelNumber={1}
        levelCount={8}
        missionName="System Failure"
        objective="Hold the line"
      />,
    );
    expect(screen.getByTestId("level-progress")).toHaveTextContent("Operation 1 of 8");
    expect(screen.getByText("System Failure")).toBeVisible();
  });
});
