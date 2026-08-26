// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductionCameos, productionBlockerText } from "../components/game/ProductionCameos";
import { addBuilding, makeFixture } from "../lib/sim/fixtures";
import { generateVisualProfile } from "../lib/gen/visualProfile";

vi.mock("../components/game/SpritePreview", () => ({
  SpritePreview: () => <span data-testid="sprite-preview" />,
}));

afterEach(() => cleanup());

describe("production cameo availability", () => {
  it("explains that the required producer must be built", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });

    expect(productionBlockerText(state, "tank", 0, undefined)).toBe("Build a War Factory");
  });

  it("explains credit and power blockers together", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    addBuilding(state, 0, "factory", 4, 4);
    state.credits[0] = 0;

    const producer = state.entities.find((entity) => entity.kind === "factory");
    expect(productionBlockerText(state, "tank", -1, producer)).toBe("Need 425 more credits · Restore power");
  });

  it("keeps unavailable units visible and puts the next step in the tooltip", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    render(
      <ProductionCameos
        state={state}
        palette={state.factions[0].palette}
        profile={generateVisualProfile(state.seed, 0)}
        power={0}
        availableProducer={() => undefined}
        onQueueUnit={vi.fn()}
        onCancelUnit={vi.fn()}
      />,
    );

    const tank = screen.getByRole("button", { name: /Tank, 425 credits/ });
    expect(tank).toBeDisabled();
    expect(tank.parentElement).toHaveAttribute("data-tooltip", expect.stringContaining("Build a War Factory"));
  });

  it("explains how to unlock a gated unit", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    state.missionIndex = -1;

    expect(productionBlockerText(state, "medic", 0, undefined)).toBe("Advance the campaign to unlock this unit");
  });
});
