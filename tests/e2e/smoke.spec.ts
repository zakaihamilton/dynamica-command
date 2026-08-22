import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createMission } from "../../lib/sim/api";
import { CAMPAIGN_PROGRESS_VERSION, campaignKey, freshCampaignProgress } from "../../lib/persist/campaign";
import { SAVE_CONTENT_VERSION, SAVE_VERSION, saveKey } from "../../lib/persist/save";
import { SETTINGS_KEY, SETTINGS_VERSION } from "../../lib/persist/settings";
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

async function canvasDigest(canvas: Locator): Promise<number> {
  return canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    const { data } = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4) {
      hash ^= data[i] ?? 0;
      hash = Math.imul(hash, 16777619);
      hash ^= data[i + 1] ?? 0;
      hash = Math.imul(hash, 16777619);
      hash ^= data[i + 2] ?? 0;
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  });
}

async function nextFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function browserSupportsNativeAac(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (typeof window.AudioEncoder === "undefined" || typeof window.AudioData === "undefined") return false;
    try {
      const support = await window.AudioEncoder.isConfigSupported({
        codec: "mp4a.40.2",
        sampleRate: 44_100,
        numberOfChannels: 2,
        bitrate: 160_000,
      });
      return support.supported === true;
    } catch {
      return false;
    }
  });
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

test("keeps the tactical radar readable and usable across breakpoints", async ({ page }) => {
  await deployToBattlefield(page);
  const radar = page.getByTestId("tactical-radar");
  await expect(radar).toBeVisible();
  await expect(radar).toHaveAttribute("aria-label", /click to focus.*drag to pan/i);
  await expect(page.getByText("ALLY", { exact: true })).toBeVisible();

  const desktopStyles = await radar.evaluate((element) => {
    const frame = element.parentElement;
    const sweep = frame?.querySelector("span");
    return {
      touchAction: getComputedStyle(element).touchAction,
      imageRendering: getComputedStyle(element).imageRendering,
      frameOverlay: frame ? getComputedStyle(frame, "::after").backgroundImage : "none",
      sweepAnimation: sweep ? getComputedStyle(sweep).animationName : "none",
    };
  });
  expect(desktopStyles.touchAction).toBe("none");
  expect(desktopStyles.imageRendering).toBe("auto");
  expect(desktopStyles.frameOverlay).toBe("none");
  expect(desktopStyles.sweepAnimation).toMatch(/radar-scan/);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => radar.evaluate((element) => {
    const sweep = element.parentElement?.querySelector("span");
    return sweep ? getComputedStyle(sweep).animationName : "none";
  })).toBe("none");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(radar).toBeVisible();
  expect(await radar.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(0);
});

test("keeps tactical radar clicks anchored and cleans up interrupted drags", async ({ page }) => {
  await deployToBattlefield(page);
  const radar = page.getByTestId("tactical-radar");
  await expect(radar).toBeVisible();

  const box = await radar.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width * 0.5;
  const startY = box!.y + box!.height * 0.5;

  await page.mouse.move(startX, startY);
  await nextFrame(page);
  const beforeDrag = await canvasDigest(radar);

  await page.mouse.down();
  await expect(radar).not.toHaveAttribute("data-dragging", "true");

  await page.mouse.move(startX + 2, startY + 2);
  await expect(radar).not.toHaveAttribute("data-dragging", "true");

  await page.mouse.move(startX + 48, startY + 24);
  await expect(radar).toHaveAttribute("data-dragging", "true");
  await nextFrame(page);
  expect(await canvasDigest(radar)).not.toBe(beforeDrag);

  await radar.dispatchEvent("pointercancel", { bubbles: true, pointerId: 1 });
  await expect(radar).not.toHaveAttribute("data-dragging", "true");
  await page.mouse.up();

  await page.keyboard.press("h");
  await nextFrame(page);
  const beforeClick = await canvasDigest(radar);
  await radar.click({ position: { x: 8, y: 8 } });
  await nextFrame(page);
  expect(await canvasDigest(radar)).not.toBe(beforeClick);
});

test("toggles music and sound from welcome options", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "OPTIONS" }).click();
  await expect(page.getByRole("heading", { name: "Game options" })).toBeVisible();

  await page.getByRole("button", { name: "Music: On" }).click();
  await expect(page.getByRole("button", { name: "Music: Off" })).toBeVisible();
  await page.getByRole("button", { name: "Sound effects: On" }).click();
  await expect(page.getByRole("button", { name: "Sound effects: Off" })).toBeVisible();
  const musicVolume = page.getByRole("slider", { name: "Music volume" });
  await musicVolume.fill("0.5");
  await expect(musicVolume).toHaveValue("0.5");
  await expect(page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), SETTINGS_KEY)).resolves.toMatchObject({
    version: SETTINGS_VERSION,
    settings: { musicVolume: 0.5 },
  });

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Game options" })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "OPTIONS" }).click();
  await expect(page.getByRole("button", { name: "Music: Off" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sound effects: Off" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Music volume" })).toHaveValue("0.5");
});

test("shows briefing portraits before launch", async ({ page }) => {
  await openBriefingSkippingTutorial(page);
  await expect(page.getByTestId("briefing-portrait").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible();
});

test("opens the deterministic soundtrack panel from the briefing", async ({ page }) => {
  await openBriefingSkippingTutorial(page);
  await page.getByRole("button", { name: "Soundtrack", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mission soundtrack" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Seed 0421 // Mission 1");
  const download = dialog.getByRole("button", { name: "Download M4A", exact: true });
  if (await browserSupportsNativeAac(page)) {
    await expect(download).toBeEnabled();
  } else {
    await expect(download).toBeDisabled();
    await expect(dialog).toContainText(/cannot encode native AAC|unavailable/i);
  }
});

test("exposes the soundtrack panel from pause and mission result screens", async ({ page }) => {
  await deployToBattlefield(page);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  await page.getByRole("button", { name: "Soundtrack", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Mission soundtrack" })).toContainText("Mission 1");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Resume Mission" }).click();

  const state = distinctiveSave("won");
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: saveKey(421),
    raw: saveEnvelope(state),
  });
  await page.goto("/play?seed=0421&resume=1");
  await expect(page.getByTestId("mission-result")).toBeVisible();
  await page.getByRole("button", { name: "Soundtrack", exact: true }).click();
  const resultDialog = page.getByRole("dialog", { name: "Mission soundtrack" });
  await expect(resultDialog).toContainText("Mission 1");
  await page.keyboard.press("Escape");
  await expect(resultDialog).not.toBeVisible();
  await expect(page.getByTestId("mission-result")).toBeVisible();
});

test("downloads a valid deterministic M4A when native AAC is supported", async ({ page }) => {
  test.setTimeout(180_000);
  await openBriefingSkippingTutorial(page);
  test.skip(!(await browserSupportsNativeAac(page)), "Chromium does not expose native AAC WebCodecs in this environment.");
  await page.getByRole("button", { name: "Soundtrack", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mission soundtrack" });
  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await dialog.getByRole("button", { name: "Download M4A", exact: true }).click();
  await expect(dialog.getByRole("progressbar", { name: "Export progress" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("genesis-protocol-0421-mission-01.m4a");
  const path = await download.path();
  expect(path).not.toBeNull();
  const file = await readFile(path!);
  expect(file.subarray(4, 8).toString("ascii")).toBe("ftyp");
  expect(file.toString("latin1")).toContain("mp4a");
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
  return JSON.stringify({ version: SAVE_VERSION, contentVersion: SAVE_CONTENT_VERSION, savedAt: Date.now(), state });
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

test("offers to reset an unreadable save from the welcome screen", async ({ page }) => {
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, "not valid json");
  }, { key: saveKey(421) });

  await page.goto("/");
  const recovery = page.getByRole("alert").filter({ hasText: "Unreadable save: 0421" });
  await expect(recovery).toContainText("Unreadable save: 0421");
  await page.getByRole("button", { name: "Reset 0421" }).click();
  await expect(recovery).toHaveCount(0);
  await expect(page.evaluate((key) => localStorage.getItem(key), saveKey(421))).resolves.toBeNull();
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
