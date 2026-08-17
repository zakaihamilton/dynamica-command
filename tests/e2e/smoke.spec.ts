import { expect, test } from "@playwright/test";

test("launches a seeded campaign from menu to battlefield", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "NEW GAME" }).click();

  const seed = page.getByLabel("Four digit theater seed");
  await seed.fill("0421");
  await page.getByRole("button", { name: "Launch" }).click();

  await expect(page).toHaveURL(/\/briefing\?seed=0421&mission=0/);
  await expect(page.getByTestId("mission-objectives")).toBeVisible();
  await expect(page.getByTestId("mission-objectives")).toContainText(/construction yard/i);

  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);
  await expect(page.getByTestId("seed")).toHaveText("Seed 0421");
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await expect(page.getByTestId("credits")).toBeVisible();
});
