import { expect, test } from "@playwright/test";
import { MIN_RENDER_HEIGHT, MIN_RENDER_WIDTH } from "../../components/game/hooks/useGameCamera";
import { cameraPanBounds, clampCamera } from "../../lib/render/camera";
import { TILE_H, tileToScreen } from "../../lib/iso";
import { SAVE_CONTENT_VERSION, SAVE_VERSION, saveKey } from "../../lib/persist/save";
import { SETTINGS_KEY, SETTINGS_VERSION, defaultSettings } from "../../lib/persist/settings";
import { createMission } from "../../lib/sim/api";
import { addUnit, setHeight } from "../../lib/sim/fixtures";
import { heightAt } from "../../lib/sim/world";
import type { Entity, SimState } from "../../lib/types";

const TEST_SEED = 421;

function playerUnits(state: SimState): Entity[] {
  return state.entities.filter(
    (entity) => entity.owner === 0 && entity.class === "unit" && entity.hp > 0 && !entity.neutral,
  );
}

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

async function expectOperationsMapFit(
  page: import("@playwright/test").Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto("/campaign?seed=0421");
  await expect(page.getByRole("heading", { name: "Operations map" })).toBeVisible();

  const dimensions = await expectNoHorizontalOverflow(page);
  expect(dimensions.documentHeight).toBeLessThanOrEqual(viewport.height);

  const panel = page.getByTestId("operations-panel");
  const launch = page.getByTestId("launch-selected-mission");
  const returnToMenu = page.getByRole("button", { name: "Return to menu" });
  const layout = await panel.evaluate((element) => {
    const panelRect = element.getBoundingClientRect();
    return {
      panel: { top: panelRect.top, bottom: panelRect.bottom },
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    };
  });

  expect(layout.panel.top).toBeGreaterThanOrEqual(0);
  expect(layout.panel.bottom).toBeLessThanOrEqual(viewport.height);
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);

  for (const control of [launch, returnToMenu]) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  }
}

async function waitForBattlefield(page: import("@playwright/test").Page) {
  const canvas = page.getByTestId("battlefield-canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate((element, mins) => {
    const canvasEl = element as HTMLCanvasElement;
    const host = canvasEl.parentElement;
    if (!host) return false;
    const width = Math.max(mins.width, Math.floor(host.clientWidth));
    const height = Math.max(mins.height, Math.floor(host.clientHeight));
    return canvasEl.width === width && canvasEl.height === height;
  }, { width: MIN_RENDER_WIDTH, height: MIN_RENDER_HEIGHT })).toBe(true);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function waitForStableSelection(page: import("@playwright/test").Page, text: string) {
  const controls = page.getByTestId("mobile-touch-controls");
  await expect.poll(async () => (await controls.textContent())?.includes(text) ?? false).toBe(true);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function pageCamera(page: import("@playwright/test").Page, state: SimState) {
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
  return { dimensions, bounds, camera };
}

function canvasCssPoint(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
  dimensions: { width: number; height: number },
) {
  return {
    x: bounds.x + point.x * (bounds.width / dimensions.width),
    y: bounds.y + point.y * (bounds.height / dimensions.height),
  };
}

async function pointForTile(page: import("@playwright/test").Page, x: number, y: number) {
  const state = createMission({ seed: TEST_SEED, missionIndex: 0 });
  const { dimensions, bounds, camera } = await pageCamera(page, state);
  return canvasCssPoint(tileToScreen(x, y, camera, heightAt(state, x, y)), bounds, dimensions);
}

async function pointForEntity(page: import("@playwright/test").Page, entity: Entity) {
  const state = createMission({ seed: TEST_SEED, missionIndex: 0 });
  const { dimensions, bounds, camera } = await pageCamera(page, state);
  const point = tileToScreen(entity.x, entity.y, camera, heightAt(state, Math.round(entity.x), Math.round(entity.y)));
  const zoom = camera.zoom;
  return canvasCssPoint({
    x: point.x,
    y: point.y + (TILE_H / 2) * zoom - 12 * zoom,
  }, bounds, dimensions);
}

async function marqueeForEntities(page: import("@playwright/test").Page, entities: Entity[]) {
  const points = await Promise.all(entities.map((entity) => pointForEntity(page, entity)));
  const canvas = page.getByTestId("battlefield-canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Battlefield canvas has no layout bounds");
  const inset = 12;
  const x0 = Math.max(bounds.x + inset, Math.min(...points.map((point) => point.x)) - inset);
  const y0 = Math.max(bounds.y + inset, Math.min(...points.map((point) => point.y)) - inset);
  const x1 = Math.min(bounds.x + bounds.width - inset, Math.max(...points.map((point) => point.x)) + inset);
  const y1 = Math.min(bounds.y + bounds.height - inset, Math.max(...points.map((point) => point.y)) + inset);
  return { start: { x: x0, y: y0 }, end: { x: x1, y: y1 } };
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

test.describe("operations map responsive layout", () => {
  test("fits the full command console inside desktop windows", async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 600 },
      { width: 1280, height: 720 },
      { width: 1600, height: 900 },
      { width: 1024, height: 768 },
    ]) {
      await expectOperationsMapFit(page, viewport);
    }
  });

  test("reflows to a scrollable page on narrow viewports", async ({ page }) => {
    for (const viewport of [
      { width: 700, height: 400 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/campaign?seed=0421");
      await expect(page.getByRole("heading", { name: "Operations map" })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const launch = page.getByTestId("launch-selected-mission");
      await launch.scrollIntoViewIfNeeded();
      await expect(launch).toBeVisible();
      const launchBounds = await launch.boundingBox();
      expect(launchBounds).not.toBeNull();
      expect(launchBounds!.y).toBeGreaterThanOrEqual(0);
      expect(launchBounds!.y + launchBounds!.height).toBeLessThanOrEqual(viewport.height);
    }
  });
});

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

test.describe("selected unit actions", () => {
  test("refreshes stance and formation after clicking selected actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play?seed=0421&mission=0");
    await waitForBattlefield(page);

    const state = createMission({ seed: TEST_SEED, missionIndex: 0 });
    const infantryEntity = playerUnits(state).find((entity) => entity.kind === "infantry");
    if (!infantryEntity) throw new Error("Mission has no player infantry");
    const infantry = await pointForEntity(page, infantryEntity);
    await dispatchTouch(page, "pointerdown", infantry);
    await dispatchTouch(page, "pointerup", infantry);

    await waitForStableSelection(page, "1 unit");
    await page.getByTestId("mobile-command-toggle").click();
    const sidebar = page.getByTestId("command-sidebar");
    await sidebar.getByRole("tab", { name: "Selected" }).click();

    const unitOrders = sidebar;
    const hold = unitOrders.getByTestId("selected-action-stance-hold");
    await expect(hold).toHaveAttribute("aria-pressed", "false");
    await hold.click();
    await expect(hold).toHaveAttribute("aria-pressed", "true");
    await expect(sidebar.getByText("Stance hold", { exact: true })).toBeVisible();

    const wedge = unitOrders.getByTestId("selected-action-formation-wedge");
    await expect(wedge).toHaveAttribute("aria-pressed", "false");
    await wedge.click();
    await expect(wedge).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("desktop marquee selection", () => {
  test("keeps units selected across an edge-scrolled drag", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const state = createMission({ seed: TEST_SEED, missionIndex: 0 });
    setHeight(state, 12, 12, 0);
    setHeight(state, 24, 0, 0);
    const anchorUnit = addUnit(state, 0, "infantry", 12, 12);
    const revealedUnit = addUnit(state, 0, "tank", 24, 0);
    const save = JSON.stringify({
      version: SAVE_VERSION,
      contentVersion: SAVE_CONTENT_VERSION,
      savedAt: Date.now(),
      state,
    });
    await page.addInitScript(({ saveStorageKey, saveRaw, settingsKey, settingsRaw }) => {
      localStorage.setItem(saveStorageKey, saveRaw);
      localStorage.setItem(settingsKey, settingsRaw);
    }, {
      saveStorageKey: saveKey(TEST_SEED),
      saveRaw: save,
      settingsKey: SETTINGS_KEY,
      settingsRaw: JSON.stringify({
        version: SETTINGS_VERSION,
        savedAt: Date.now(),
        settings: { ...defaultSettings(), tacticalRosterEnabled: true },
      }),
    });
    await page.goto(`/play?seed=${String(TEST_SEED).padStart(4, "0")}&mission=0&resume=1`);
    await waitForBattlefield(page);

    const { dimensions, bounds, camera } = await pageCamera(page, state);
    const anchorPoint = tileToScreen(anchorUnit.x, anchorUnit.y, camera, heightAt(state, anchorUnit.x, anchorUnit.y));
    const start = canvasCssPoint({
      x: anchorPoint.x - 18,
      y: anchorPoint.y + (TILE_H / 2) * camera.zoom - 12 * camera.zoom - 24,
    }, bounds, dimensions);
    const end = {
      x: bounds.x + bounds.width - 4,
      y: start.y + 48,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.waitForTimeout(1_100);
    await page.mouse.up();

    const roster = page.getByTestId("tactical-roster");
    const anchorRow = roster.locator('[role="listitem"]').filter({ hasText: `Coords ${anchorUnit.x}, ${anchorUnit.y}` });
    const revealedRow = roster.locator('[role="listitem"]').filter({ hasText: `Coords ${revealedUnit.x}, ${revealedUnit.y}` });
    await expect.poll(() => anchorRow.getAttribute("data-selected")).toBe("true");
    await expect.poll(() => revealedRow.getAttribute("data-selected")).toBe("true");
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
        const launcher = page.getByTestId("mobile-command-launcher");
        await expect(launcher).toBeVisible();
        const launcherBounds = await launcher.boundingBox();
        expect(launcherBounds).not.toBeNull();
        expect(launcherBounds!.y + launcherBounds!.height).toBeLessThanOrEqual(viewport.height);
        const sidebar = page.getByTestId("command-sidebar");
        await expect(sidebar).not.toBeVisible();
        await expect(sidebar).toHaveAttribute("aria-hidden", "true");
        await expect(sidebar).toHaveAttribute("inert", "");
      } else {
        await expect(page.getByTestId("command-sidebar")).toBeVisible();
        const sidebarBounds = await page.getByTestId("command-sidebar").boundingBox();
        expect(sidebarBounds).not.toBeNull();
        expect(sidebarBounds!.x + sidebarBounds!.width).toBeLessThanOrEqual(viewport.width);
      }
    });
  }

  test("opens the collapsible command panel and selection mode without reserving map space", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play?seed=0421&mission=0");

    const launcher = page.getByTestId("mobile-command-launcher");
    const canvas = page.getByTestId("battlefield-canvas");
    const closedCanvasBounds = await canvas.boundingBox();
    expect(closedCanvasBounds).not.toBeNull();
    expect(closedCanvasBounds!.width).toBe(390);
    expect(closedCanvasBounds!.height).toBe(844);

    await launcher.getByTestId("mobile-command-toggle").click();
    const panel = page.getByTestId("command-sidebar");
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute("aria-hidden");
    await expect(panel).not.toHaveAttribute("inert");
    await expect(page.getByTestId("mobile-command-scrim")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const panelBounds = await panel.boundingBox();
    expect(panelBounds).not.toBeNull();
    expect(panelBounds!.x).toBeGreaterThanOrEqual(0);
    expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(390);

    const select = panel.getByTestId("mobile-select-mode");
    await expect(select).toHaveAttribute("aria-pressed", "false");
    await select.click();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(panel).not.toBeVisible();

    await launcher.getByTestId("mobile-command-toggle").click();
    await expect(panel).toBeVisible();
    await page.getByTestId("mobile-command-scrim").click();
    await expect(panel).not.toBeVisible();
  });

  test("keeps the pause actions above the compact mobile launcher", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play?seed=0421&mission=0");

    await page.getByTestId("mobile-pause").click();
    await expect(page.getByTestId("mobile-command-launcher")).not.toBeVisible();
    const pause = page.getByTestId("pause-menu");
    await expect(pause).toBeVisible();
    const resume = pause.getByRole("button", { name: "Resume Mission" });
    await expect(resume).toBeVisible();
    const bounds = await resume.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    await resume.click();
    await expect(page.getByTestId("mobile-command-launcher")).toBeVisible();
  });

  test("does not expose unit movement for a selected base", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/play?seed=0421&mission=0");
    await waitForBattlefield(page);

    const yard = await pointForTile(page, 8, 7);
    await dispatchTouch(page, "pointerdown", yard);
    await dispatchTouch(page, "pointerup", yard);
    await page.getByTestId("mobile-command-toggle").click();
    await expect(page.getByTestId("command-sidebar").getByTestId("mobile-command-move")).toHaveCount(0);
  });

  test("supports touch selection, marquee selection, panning, commands, and long press", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/play?seed=${String(TEST_SEED).padStart(4, "0")}&mission=0`);
    await waitForBattlefield(page);

    const state = createMission({ seed: TEST_SEED, missionIndex: 0 });
    const units = playerUnits(state);
    const infantryEntity = units.find((entity) => entity.kind === "infantry");
    if (!infantryEntity) throw new Error("Mission has no player infantry");
    const infantry = await pointForEntity(page, infantryEntity);
    await dispatchTouch(page, "pointerdown", infantry);
    await dispatchTouch(page, "pointerup", infantry);
    await expect(page.getByTestId("mobile-touch-controls")).toContainText("1 unit");

    await page.getByTestId("mobile-command-toggle").click();
    await page.getByTestId("command-sidebar").getByTestId("mobile-select-mode").click();
    const marquee = await marqueeForEntities(page, units);
    await dispatchTouch(page, "pointerdown", marquee.start);
    await dispatchTouch(page, "pointermove", marquee.end);
    await dispatchTouch(page, "pointerup", marquee.end);
    await waitForStableSelection(page, `${units.length} units`);

    const dragStart = { x: 90, y: 650 };
    await dispatchTouch(page, "pointerdown", dragStart);
    await dispatchTouch(page, "pointermove", { x: 155, y: 650 });
    await dispatchTouch(page, "pointerup", { x: 155, y: 650 });
    await waitForStableSelection(page, `${units.length} units`);

    await page.getByTestId("mobile-command-toggle").click();
    await page.getByTestId("command-sidebar").getByTestId("mobile-command-move").click();
    await expect(page.getByTestId("mobile-touch-controls")).toContainText("Move armed");
    const orderPoint = { x: 300, y: 600 };
    await dispatchTouch(page, "pointerdown", orderPoint);
    await dispatchTouch(page, "pointerup", orderPoint);
    await expect(page.getByTestId("mobile-touch-controls")).not.toContainText("Move armed");

    await page.getByTestId("mobile-command-toggle").click();
    await page.getByTestId("command-sidebar").getByTestId("mobile-command-move").click();
    await dispatchTouch(page, "pointerdown", { x: 300, y: 600 });
    await page.waitForTimeout(520);
    await dispatchTouch(page, "pointerup", { x: 300, y: 600 });
    await expect(page.getByTestId("mobile-touch-controls")).not.toContainText("Move armed");
  });

  test("keeps tutorial controls above the battlefield and reachable on small phones", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/tutorial?seed=0421");
    const tutorial = page.getByTestId("tutorial-overlay");
    await expect(tutorial).toBeVisible();
    await expect(page.getByTestId("mobile-command-launcher")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    const bounds = await tutorial.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
    await expect(tutorial.getByRole("button", { name: "Continue" })).toBeVisible();
    await expect(tutorial.getByRole("button", { name: "Back" })).toBeVisible();
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
    await expect(page.getByRole("button", { name: "Back to menu" })).toBeVisible();
  });

  test("preserves selection through rotation and cancels the open portrait panel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/play?seed=${String(TEST_SEED).padStart(4, "0")}&mission=0`);
    await waitForBattlefield(page);

    const state = createMission({ seed: TEST_SEED, missionIndex: 0 });
    const infantryEntity = playerUnits(state).find((entity) => entity.kind === "infantry");
    if (!infantryEntity) throw new Error("Mission has no player infantry");
    const infantry = await pointForEntity(page, infantryEntity);
    await dispatchTouch(page, "pointerdown", infantry);
    await dispatchTouch(page, "pointerup", infantry);
    await waitForStableSelection(page, "1 unit");

    await page.getByTestId("mobile-command-toggle").click();
    await expect(page.getByTestId("command-sidebar")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByTestId("mobile-command-launcher")).not.toBeVisible();
    await expect(page.getByTestId("command-sidebar")).toBeVisible();
    await expect(page.getByTestId("mobile-touch-controls")).toContainText("1 unit");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("mobile-command-launcher")).toBeVisible();
    await expect(page.getByTestId("command-sidebar")).not.toBeVisible();
  });

  test("guards browser Back in a live mission and preserves briefing Back destinations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.goto("/briefing?seed=0421&mission=0&from=menu");
    await page.getByRole("button", { name: "Launch" }).click();
    await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);

    await page.evaluate(() => window.history.back());
    const confirmation = page.getByRole("dialog", { name: "Leave mission?" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);

    await page.evaluate(() => window.history.back());
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Leave mission" }).click();
    await expect(page).toHaveURL(/\/briefing\?seed=0421&mission=0&from=menu/);

    await page.goto("/briefing?seed=0421&mission=0&from=campaign");
    await expect(page.getByRole("button", { name: "Back to operations" })).toBeVisible();
    await page.getByRole("button", { name: "Back to operations" }).click();
    await expect(page).toHaveURL(/\/campaign\?seed=0421/);
  });
});
