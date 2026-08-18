import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  return dimensions;
}

test.describe("short-height layouts", () => {
  test("keeps the briefing actions reachable at short desktop heights", async ({ page }) => {
    for (const height of [650, 791]) {
      await page.setViewportSize({ width: 1600, height });
      await page.goto("/briefing?seed=0421&mission=0");
      await expect(page.getByTestId("mission-objectives")).toBeVisible();

      const dimensions = await expectNoHorizontalOverflow(page);
      expect(dimensions.documentHeight).toBeGreaterThanOrEqual(dimensions.viewportHeight);

      const objectives = page.getByTestId("mission-objectives");
      await objectives.scrollIntoViewIfNeeded();
      await expect(objectives).toBeVisible();

      const launch = page.getByRole("button", { name: "Launch" });
      await launch.scrollIntoViewIfNeeded();
      await expect(launch).toBeVisible();
      const launchBounds = await launch.boundingBox();
      expect(launchBounds).not.toBeNull();
      expect(launchBounds!.y + launchBounds!.height).toBeLessThanOrEqual(height);

      await launch.click();
      await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);
    }
  });

  test("keeps battlefield pause and upgrade controls usable at 1280x600", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto("/play?seed=0421&mission=0");
    await expect(page.getByTestId("command-sidebar")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-menu")).toBeVisible();
    await page.getByRole("button", { name: "Upgrades" }).click();

    const upgrades = page.getByRole("dialog", { name: "Campaign Upgrades" });
    await expect(upgrades).toBeVisible();
    await expect(upgrades.getByRole("button", { name: "Back" })).toBeVisible();
    const upgradeBounds = await upgrades.boundingBox();
    expect(upgradeBounds).not.toBeNull();
    expect(upgradeBounds!.y).toBeGreaterThanOrEqual(0);
    expect(upgradeBounds!.y + upgradeBounds!.height).toBeLessThanOrEqual(600);
  });

  test("keeps the tutorial overlay inside a short landscape viewport", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 400 });
    await page.goto("/tutorial?seed=0421");
    const tutorial = page.getByTestId("tutorial-overlay");
    await expect(tutorial).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const tutorialBounds = await tutorial.boundingBox();
    expect(tutorialBounds).not.toBeNull();
    expect(tutorialBounds!.y).toBeGreaterThanOrEqual(0);
    expect(tutorialBounds!.y + tutorialBounds!.height).toBeLessThanOrEqual(400);
    await expect(tutorial.getByRole("button", { name: "Continue" })).toBeVisible();
  });
});
