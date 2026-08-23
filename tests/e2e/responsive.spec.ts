import { expect, test } from "@playwright/test";
import { cameraPanBounds, clampCamera } from "../../lib/render/camera";
import { tileToScreen } from "../../lib/render/iso";
import { createMission } from "../../lib/sim/api";
import { heightAt } from "../../lib/sim/world";

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

async function pointForTile(page: import("@playwright/test").Page, x: number, y: number) {
  const state = createMission({ seed: 421, missionIndex: 0 });
  const canvas = page.getByTestId("battlefield-canvas");
  const dimensions = await canvas.evaluate((element) => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height,
  }));
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Battlefield canvas has no layout bounds");
  const constructionYard = state.entities.find((entity) => entity.owner === 0 && entity.kind === "constructionYard");
  if (!constructionYard) throw new Error("Mission has no construction yard");
  const origin = { x: 0, y: 0, zoom: 1 };
  const anchor = tileToScreen(constructionYard.x, constructionYard.y, origin, heightAt(state, constructionYard.x, constructionYard.y));
  const camera = {
    x: dimensions.width / 2 - anchor.x,
    y: dimensions.height / 3 - anchor.y,
    zoom: 1,
  };
  clampCamera(camera, cameraPanBounds(camera, state.width, state.height, dimensions.width, dimensions.height));
  const point = tileToScreen(x, y, camera, heightAt(state, x, y));
  return {
    x: bounds.x + point.x * (bounds.width / dimensions.width),
    y: bounds.y + point.y * (bounds.height / dimensions.height),
  };
}

async function dispatchTouch(
  page: import("@playwright/test").Page,
  type: "pointerdown" | "pointermove" | "pointerup",
  point: { x: number; y: number },
  pointerId = 1,
) {
  await page.getByTestId("battlefield-canvas").evaluate((element, event) => {
    element.dispatchEvent(new PointerEvent(event.type, {
      bubbles: true,
      cancelable: true,
      pointerId: event.pointerId,
      pointerType: "touch",
      isPrimary: true,
      button: event.type === "pointerup" ? 0 : 0,
      buttons: event.type === "pointerup" ? 0 : 1,
      clientX: event.x,
      clientY: event.y,
    }));
  }, { type, pointerId, x: point.x, y: point.y });
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

  test("keeps battlefield pause controls usable at 1280x600", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto("/play?seed=0421&mission=0");
    await expect(page.getByTestId("command-sidebar")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Escape");
    const pause = page.getByRole("dialog", { name: "Game paused" });
    await expect(pause).toBeVisible();
    await expect(pause.getByRole("button", { name: "Resume Mission" })).toBeVisible();
    const pauseBounds = await pause.boundingBox();
    expect(pauseBounds).not.toBeNull();
    expect(pauseBounds!.y).toBeGreaterThanOrEqual(0);
    expect(pauseBounds!.y + pauseBounds!.height).toBeLessThanOrEqual(600);
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

test.describe("mobile-first layouts", () => {
  for (const viewport of [
    { width: 390, height: 844, name: "phone portrait" },
    { width: 375, height: 667, name: "short phone portrait" },
    { width: 320, height: 568, name: "small phone portrait" },
    { width: 844, height: 390, name: "phone landscape" },
  ]) {
    test(`keeps the battlefield usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/play?seed=0421&mission=0");
      await expect(page.getByTestId("battlefield-canvas")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const canvas = page.getByTestId("battlefield-canvas");
      const canvasBounds = await canvas.boundingBox();
      expect(canvasBounds).not.toBeNull();
      expect(canvasBounds!.x).toBeGreaterThanOrEqual(0);
      expect(canvasBounds!.y).toBeGreaterThanOrEqual(0);
      expect(canvasBounds!.x + canvasBounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(canvasBounds!.y + canvasBounds!.height).toBeLessThanOrEqual(viewport.height);

      if (viewport.height > viewport.width) {
        const dock = page.getByTestId("mobile-command-dock");
        await expect(dock).toBeVisible();
        const dockBounds = await dock.boundingBox();
        expect(dockBounds).not.toBeNull();
        expect(dockBounds!.y + dockBounds!.height).toBeLessThanOrEqual(viewport.height);
        await expect(page.getByTestId("mobile-command-sheet")).toHaveCount(0);
      } else {
        await expect(page.getByTestId("command-sidebar")).toBeVisible();
        const sidebarBounds = await page.getByTestId("command-sidebar").boundingBox();
        expect(sidebarBounds).not.toBeNull();
        expect(sidebarBounds!.x + sidebarBounds!.width).toBeLessThanOrEqual(viewport.width);
      }
    });
  }

  test("opens the contextual command sheet and selection mode without covering the map", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play?seed=0421&mission=0");

    const select = page.getByTestId("mobile-select-mode");
    await expect(select).toHaveAttribute("aria-pressed", "false");
    await select.click();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("mobile-command-dock")).toContainText("Drag a box around friendly units");

    await select.click();
    await page.getByTestId("mobile-command-more").click();
    const sheet = page.getByTestId("mobile-command-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Command catalog");

    const sheetBounds = await sheet.boundingBox();
    expect(sheetBounds).not.toBeNull();
    expect(sheetBounds!.y).toBeGreaterThanOrEqual(0);
    expect(sheetBounds!.y + sheetBounds!.height).toBeLessThanOrEqual(844);
    await sheet.getByRole("button", { name: "Close commands" }).click();
    await expect(sheet).toHaveCount(0);
  });

  test("keeps the pause actions above the mobile command dock", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play?seed=0421&mission=0");

    await page.getByTestId("mobile-pause").click();
    await expect(page.getByTestId("mobile-command-dock")).toHaveCount(0);
    const pause = page.getByTestId("pause-menu");
    await expect(pause).toBeVisible();
    const resume = pause.getByRole("button", { name: "Resume Mission" });
    await expect(resume).toBeVisible();
    const bounds = await resume.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await resume.click();
    await expect(page.getByTestId("mobile-command-dock")).toBeVisible();
  });

  test("does not expose unit movement for a selected base", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play?seed=0421&mission=0");

    const yard = await pointForTile(page, 8, 7);
    await dispatchTouch(page, "pointerdown", yard);
    await dispatchTouch(page, "pointerup", yard);
    await expect(page.getByTestId("mobile-command-dock").getByTestId("mobile-command-move")).toHaveCount(0);
  });

  test("supports touch selection, marquee selection, panning, commands, and long press", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play?seed=0421&mission=0");

    const infantry = await pointForTile(page, 13, 9);
    await dispatchTouch(page, "pointerdown", infantry);
    await dispatchTouch(page, "pointerup", infantry);
    await expect(page.getByTestId("mobile-command-dock")).toContainText("1 unit");

    await page.getByTestId("mobile-select-mode").click();
    await expect(page.getByTestId("mobile-marquee")).toBeVisible();
    await dispatchTouch(page, "pointerdown", { x: 40, y: 180 });
    await dispatchTouch(page, "pointermove", { x: 350, y: 680 });
    await dispatchTouch(page, "pointerup", { x: 350, y: 680 });
    await expect(page.getByTestId("mobile-marquee")).toHaveCount(0);
    await expect(page.getByTestId("mobile-command-dock")).toContainText("2 units");

    const dragStart = { x: 90, y: 650 };
    await dispatchTouch(page, "pointerdown", dragStart);
    await dispatchTouch(page, "pointermove", { x: 155, y: 650 });
    await dispatchTouch(page, "pointerup", { x: 155, y: 650 });
    await expect(page.getByTestId("mobile-command-dock")).toContainText("2 units");

    await page.getByTestId("mobile-command-move").click();
    await expect(page.getByTestId("mobile-command-dock")).toContainText("Move active");
    const orderPoint = { x: 300, y: 600 };
    await dispatchTouch(page, "pointerdown", orderPoint);
    await dispatchTouch(page, "pointerup", orderPoint);
    await expect(page.getByTestId("mobile-command-dock")).not.toContainText("Move active");

    await page.getByTestId("mobile-command-move").click();
    await dispatchTouch(page, "pointerdown", { x: 300, y: 600 });
    await page.waitForTimeout(520);
    await dispatchTouch(page, "pointerup", { x: 300, y: 600 });
    await expect(page.getByTestId("mobile-command-dock")).not.toContainText("Move active");
  });

  test("keeps tutorial controls above the battlefield and reachable on small phones", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/tutorial?seed=0421");
    const tutorial = page.getByTestId("tutorial-overlay");
    await expect(tutorial).toBeVisible();
    await expect(page.getByTestId("mobile-command-dock")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    const bounds = await tutorial.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
    await expect(tutorial.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("keeps menu and briefing actions reachable on small phones", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "NEW GAME" }).click();
    await expectNoHorizontalOverflow(page);
    await expect(page.getByLabel("Four digit theater seed")).toBeVisible();

    await page.goto("/briefing?seed=0421&mission=0");
    await expect(page.getByTestId("briefing-actions")).toBeVisible();
    await page.getByRole("button", { name: "Launch" }).scrollIntoViewIfNeeded();
    const launch = page.getByRole("button", { name: "Launch" });
    const launchBounds = await launch.boundingBox();
    expect(launchBounds).not.toBeNull();
    expect(launchBounds!.x).toBeGreaterThanOrEqual(0);
    expect(launchBounds!.x + launchBounds!.width).toBeLessThanOrEqual(320);
  });
});
