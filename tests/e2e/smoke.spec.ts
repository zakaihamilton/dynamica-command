import { expect, test, type Page } from "@playwright/test";
import { createMission } from "../../lib/sim/api";
import { CAMPAIGN_PROGRESS_VERSION, campaignKey, freshCampaignProgress } from "../../lib/persist/campaign";
import { SAVE_VERSION, saveKey } from "../../lib/persist/save";
import type { SimState } from "../../lib/types";

/** Fixture so briefing/play tests can skip the first-deploy /tutorial gate. */
async function markTutorialComplete(page: Page, seed = 421) {
  const progress = { ...freshCampaignProgress(seed), tutorialComplete: true };
  await page.addInitScript(({ key, raw }) => {
    localStorage.setItem(key, raw);
  }, {
    key: campaignKey(seed),
    raw: JSON.stringify({
      version: CAMPAIGN_PROGRESS_VERSION,
      savedAt: Date.now(),
      progress,
    }),
  });
}

async function openBriefingSkippingTutorial(page: Page) {
  await markTutorialComplete(page);
  await page.goto("/");
  await page.getByRole("button", { name: "NEW GAME" }).click();
  const seed = page.getByLabel("Four digit theater seed");
  await seed.fill("0421");
  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/briefing\?seed=0421&mission=0/);
}

async function deployToBattlefield(page: Page) {
  await openBriefingSkippingTutorial(page);
  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);
}

test("first deploy routes through tutorial to briefing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "NEW GAME" }).click();
  await page.getByLabel("Four digit theater seed").fill("0421");
  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/tutorial\?seed=0421/);
  await expect(page.getByTestId("tutorial-overlay")).toBeVisible();
  await page.getByRole("button", { name: "Skip training" }).click();
  await expect(page).toHaveURL(/\/briefing\?seed=0421&mission=0/);
  await expect(page.getByTestId("mission-objectives")).toBeVisible();
});

test("launches a seeded campaign from menu to battlefield", async ({ page }) => {
  await openBriefingSkippingTutorial(page);
  await expect(page.getByTestId("mission-objectives")).toBeVisible();
  await expect(page.getByTestId("mission-objectives")).toContainText(/construction yard/i);

  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);
  await expect(page.getByTestId("seed")).toHaveText("Seed 0421");
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await expect(page.getByTestId("credits")).toBeVisible();
});

test("shows briefing portraits before launch", async ({ page }) => {
  await openBriefingSkippingTutorial(page);
  await expect(page.getByTestId("briefing-portrait").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible();
});

test("replays the incoming transmission from the start", async ({ page }) => {
  await openBriefingSkippingTutorial(page);
  await page.keyboard.press(" ");
  const lastLine = page.getByTestId("briefing-line").nth(2);
  await expect(lastLine).toBeVisible();
  const lastText = (await lastLine.innerText()).trim();
  expect(lastText.length).toBeGreaterThan(12);
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.getByTestId("briefing-dialogue")).not.toContainText(lastText.slice(-24));
});

test("pauses and resumes from the battlefield", async ({ page }) => {
  await deployToBattlefield(page);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  await page.getByRole("button", { name: "Options" }).click();
  await expect(page.getByRole("button", { name: "Music: On" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sound effects: On" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Resume Mission" }).click();
  await expect(page.getByTestId("pause-menu")).toHaveCount(0);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
});

function saveEnvelope(state: SimState): string {
  return JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state });
}

function distinctiveSave(result: SimState["result"] = "playing"): SimState {
  const state = createMission({ seed: 421, missionIndex: 0 });
  state.credits[0] = 9876;
  state.tick = 120;
  state.result = result;
  return state;
}

test("resumes a seeded save from the menu", async ({ page }) => {
  const state = distinctiveSave();
  await page.addInitScript(({ key, raw }) => {
    localStorage.setItem(key, raw);
  }, { key: saveKey(421), raw: saveEnvelope(state) });

  await page.goto("/");
  await page.getByRole("button", { name: /Mission 1/ }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&resume=1/);
  await expect(page.getByTestId("seed")).toHaveText("Seed 0421");
  await expect(page.getByTestId("credits")).toHaveText("9,876");
});

test("loads the last save from the pause menu", async ({ page }) => {
  const state = distinctiveSave();
  await deployToBattlefield(page);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await page.evaluate(({ key, raw }) => {
    localStorage.setItem(key, raw);
  }, { key: saveKey(421), raw: saveEnvelope(state) });

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  await page.getByRole("button", { name: "Load Mission" }).click();
  await expect(page.getByRole("status")).toContainText(/Loaded mission at tick 120/);
  await page.getByRole("button", { name: "Resume Mission" }).click();
  await expect(page.getByTestId("credits")).toHaveText("9,876");
});

test("shows a mission result overlay from a finished save", async ({ page }) => {
  const state = distinctiveSave("won");
  await page.addInitScript(({ key, raw }) => {
    localStorage.setItem(key, raw);
  }, { key: saveKey(421), raw: saveEnvelope(state) });

  await page.goto("/play?seed=0421&resume=1");
  await expect(page.getByTestId("mission-result")).toBeVisible();
  await expect(page.getByTestId("mission-result")).toHaveAttribute("data-result", "won");
  await expect(page.getByRole("heading", { name: "Mission complete" })).toBeVisible();
});
