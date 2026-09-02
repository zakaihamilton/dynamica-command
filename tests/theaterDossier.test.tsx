// @vitest-environment jsdom

import { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NewGameSetup } from "../components/menu/NewGameSetup";
import { TheaterDossier } from "../components/menu/TheaterDossier";
import { createCampaign } from "../lib/gen/campaign";
import { characterLabel } from "../lib/gen/names";
import { completeMission, freshCampaignProgress, writeCampaignProgress } from "../lib/persist/campaign";
import { localStorageAdapter } from "../lib/persist/save";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
});

describe("TheaterDossier", () => {
  it("renders seed 0421 world identity, factions, staff, and eight operations", () => {
    const campaign = createCampaign(421);
    render(<TheaterDossier campaign={campaign} />);

    const dossier = screen.getByTestId("theater-dossier");
    expect(dossier).toHaveTextContent(campaign.world.name);
    expect(dossier).toHaveTextContent(campaign.world.tone);
    expect(dossier).toHaveTextContent(campaign.world.conflict);
    expect(dossier).toHaveTextContent(campaign.factions[0].name);
    expect(dossier).toHaveTextContent(campaign.factions[1].name);
    expect(dossier).toHaveTextContent(characterLabel(campaign.characters.commander));
    expect(dossier).toHaveTextContent(characterLabel(campaign.characters.advisor));
    expect(dossier).toHaveTextContent(characterLabel(campaign.characters.enemyLeader));
    expect(screen.getByRole("list", { name: "Eight operations" }).querySelectorAll("li")).toHaveLength(8);
    for (const mission of campaign.missions) {
      expect(dossier).toHaveTextContent(mission.name);
    }
    expect(dossier).toHaveTextContent("8 operations · maps 48 → 72 → 96 · opposition escalates");
    expect(dossier).toHaveTextContent("Unrecorded on this device");
  });

  it("shows an empty state without a theater code", () => {
    render(<TheaterDossier campaign={null} />);
    expect(screen.getByText("Awaiting a 4-digit theater code")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Eight operations" })).toBeNull();
  });

  it("reports local archive progress for a started campaign", () => {
    const progress = completeMission(completeMission(freshCampaignProgress(421), 0, 2, 400), 1, 1, 200);
    writeCampaignProgress(localStorageAdapter(), progress);
    render(<TheaterDossier campaign={createCampaign(421)} />);
    expect(screen.getByText("2/8 operations complete")).toBeVisible();
  });

  it("reports a completed campaign archive", () => {
    let progress = freshCampaignProgress(421);
    for (let index = 0; index < 8; index += 1) {
      progress = completeMission(progress, index, 1, 100);
    }
    writeCampaignProgress(localStorageAdapter(), progress);
    render(<TheaterDossier campaign={createCampaign(421)} />);
    expect(screen.getByText("Campaign complete · 8/8 operations")).toBeVisible();
  });
});

describe("NewGameSetup dossier", () => {
  it("shows the live theater when a campaign is authorized", () => {
    const campaign = createCampaign(421);
    render(
      <NewGameSetup
        code="0421"
        error=""
        campaign={campaign}
        inputRef={createRef<HTMLInputElement>()}
        onChange={() => {}}
        onRandomize={() => {}}
        onLaunch={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "New theater" })).toBeVisible();
    expect(screen.getByTestId("theater-dossier")).toHaveTextContent(campaign.world.name);
    expect(screen.getByRole("button", { name: "Launch" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Roll" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
  });
});
