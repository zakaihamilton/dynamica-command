import { expect, test, type Page } from "@playwright/test";

async function openBriefing(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "NEW GAME" }).click();
  const seed = page.getByLabel("Four digit theater seed");
  await seed.fill("0421");
  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/briefing\?seed=0421&mission=0/);
}

async function deployToBattlefield(page: Page) {
  await openBriefing(page);
  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);
}

test("launches a seeded campaign from menu to battlefield", async ({ page }) => {
  await openBriefing(page);
  await expect(page.getByTestId("mission-objectives")).toBeVisible();
  await expect(page.getByTestId("mission-objectives")).toContainText(/construction yard/i);

  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);
  await expect(page.getByTestId("seed")).toHaveText("Seed 0421");
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await expect(page.getByTestId("credits")).toBeVisible();
});

test("shows briefing portraits before launch", async ({ page }) => {
  await openBriefing(page);
  await expect(page.getByTestId("briefing-portrait").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible();
});

test("replays the incoming transmission from the start", async ({ page }) => {
  await openBriefing(page);
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
