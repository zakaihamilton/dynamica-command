import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createMission } from "../../lib/sim/api";
import { spawnBuilding } from "../../lib/sim/world";
import { CAMPAIGN_PROGRESS_VERSION, campaignKey, freshCampaignProgress } from "../../lib/persist/campaign";
import { SAVE_CONTENT_VERSION, SAVE_VERSION, saveKey } from "../../lib/persist/save";
import { SETTINGS_KEY, SETTINGS_VERSION } from "../../lib/persist/settings";
import type { SimState } from "../../lib/types";

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

test("welcome tutorial opens the seed 0000 training range", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "TUTORIAL" }).click();
  await expect(page).toHaveURL(/\/tutorial/);
  await expect(page.getByTestId("tutorial-overlay")).toBeVisible();
  await expect(page.getByTestId("seed")).toHaveText("Seed 0000");
  await expect(page.getByTestId("objective")).toHaveText("Training range — no time limit");
  await expect(page.getByTestId("time-remaining")).toHaveCount(0);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await page.getByRole("button", { name: "Skip training" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("new game launch goes to briefing without training", async ({ page }) => {
  await openBriefing(page);
  await expect(page.getByTestId("mission-objectives")).toBeVisible();

  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&mission=0&fresh=1/);
  await expect(page.getByRole("dialog", { name: "Leave mission?" })).toHaveCount(0);
});

test("launches a seeded campaign from menu to battlefield", async ({ page }) => {
  await openBriefing(page);
  await expect(page.getByTestId("mission-objectives")).toBeVisible();
  await expect(page.getByTestId("mission-objectives")).toContainText(/construction yard/i);
  await expect(page.getByTestId("mission-objectives")).toContainText("12 min");

  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&mission=0/);
  await expect(page.getByTestId("seed")).toHaveText("Seed 0421");
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await expect(page.getByTestId("credits")).toBeVisible();
  await expect(page.getByTestId("time-remaining")).toHaveText(/Time remaining 1[12]:\d{2}/);
});

test("opens the operations map and launches an available mission", async ({ page }) => {
  await page.goto("/campaign?seed=0421");

  await expect(page.getByRole("heading", { name: "Operations map" })).toBeVisible();
  await expect(page.getByTestId("mission-card-0")).toContainText("Available");
  await expect(page.getByTestId("mission-card-2")).toContainText("Locked");

  await page.getByTestId("mission-card-0").click();
  await expect(page.getByTestId("mission-detail")).toContainText("Secondary objectives");
  await expect(page.getByTestId("mission-detail")).toContainText("Time limit");
  await expect(page.getByTestId("mission-detail")).toContainText("12 min");
  await page.getByTestId("launch-selected-mission").click();
  await expect(page).toHaveURL(/\/briefing\?seed=0421&mission=0/);
});

test("returns from the operations map with Escape", async ({ page }) => {
  await page.goto("/campaign?seed=0421");

  await expect(page.getByRole("heading", { name: "Operations map" })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/\/$/);
});

test("keeps the unified menu and operations chrome inside the desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DYNAMICA" })).toBeVisible();
  await expect(page.getByText("Dynamica command", { exact: true })).toHaveCount(0);
  await expect(page.locator("header").getByText("DYNAMICA COMMAND")).toHaveCount(0);
  await expect(page.getByTestId("menu-dashboard")).toBeVisible();
  await expect(page.getByTestId("menu-signal-overlay")).toBeAttached();
  await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
  await expect(page.getByTestId("menu-dashboard").getByRole("button", { name: "IMPORT SAVE" })).toHaveCount(0);

  const menuOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(menuOverflow).toBe(false);

  await page.getByRole("button", { name: "NEW GAME" }).click();
  await expect(page.getByTestId("deploy-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New theater" })).toBeVisible();
  await page.getByRole("button", { name: "Operations map" }).click();
  await expect(page.getByRole("heading", { name: "Operations map" })).toBeVisible();

  const operationsOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(operationsOverflow).toBe(false);
  await expect(page.getByTestId("mission-detail")).toBeVisible();
});

test("opens the campaign archive from the main menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "LOAD MISSION" }).click();

  await expect(page).toHaveURL(/\/load$/);
  await expect(page.getByTestId("campaign-archive")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Load mission" })).toBeVisible();
  await expect(page.getByRole("button", { name: "IMPORT SAVE" })).toBeVisible();
  await expect(page.getByText("No saved campaigns.")).toBeVisible();
  const archiveScrollContainers = await page.getByTestId("campaign-archive").evaluate((element) => {
    const containers: string[] = [];
    let current: Element | null = element;
    while (current) {
      const overflowY = window.getComputedStyle(current).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") containers.push(current.tagName.toLowerCase());
      current = current.parentElement;
    }
    return containers;
  });
  expect(archiveScrollContainers).toEqual(["div"]);

  await page.getByRole("button", { name: "Return to menu" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("keeps briefing dialogue and battlefield status readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/briefing?seed=0421&mission=0");
  await expect(page.getByTestId("briefing-dialogue")).toBeVisible();

  const briefingGeometry = await page.getByTestId("briefing-dialogue").evaluate((element) => ({
    bodyOverflow: document.documentElement.scrollWidth > window.innerWidth,
    storyOverflow: element.scrollWidth > element.clientWidth,
  }));
  expect(briefingGeometry.bodyOverflow).toBe(false);
  expect(briefingGeometry.storyOverflow).toBe(false);

  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: campaignKey(421),
    raw: JSON.stringify({
      version: CAMPAIGN_PROGRESS_VERSION,
      savedAt: Date.now(),
      progress: { ...freshCampaignProgress(421), tutorialComplete: true },
    }),
  });
  await page.goto("/play?seed=0421&mission=0&fresh=1");
  await expect(page.getByTestId("time-remaining")).toBeVisible();

  const statusGeometry = await page.locator('[class*="status"]').evaluate((element) => {
    const first = element.children[0]?.getBoundingClientRect();
    const second = element.children[1]?.getBoundingClientRect();
    return {
      bodyOverflow: document.documentElement.scrollWidth > window.innerWidth,
      stacked: Boolean(first && second && second.top >= first.bottom - 1),
    };
  });
  expect(statusGeometry.bodyOverflow).toBe(false);
  expect(statusGeometry.stacked).toBe(true);
});

test("keeps Asset Bay selection synchronized with category filters", async ({ page }) => {
  await page.goto("/assets");

  const browser = page.getByTestId("assets-browser");
  const list = browser.getByRole("listbox");
  await expect(list.getByRole("option")).toHaveCount(28);

  await browser.getByRole("button", { name: "Buildings" }).click();
  await expect(browser.getByRole("button", { name: "Buildings" })).toHaveAttribute("aria-pressed", "true");
  await expect(list.getByRole("option")).toHaveCount(7);
  await expect(list.locator('[aria-selected="true"]')).toHaveCount(1);
  await expect(page.getByLabel("Construction Yard preview")).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await expect(list.locator('[aria-selected="true"]')).toHaveCount(1);
  await expect(page.getByLabel("Power Plant preview")).toBeVisible();
});

test("filters Portrait Lab groups without changing their accessible state", async ({ page }) => {
  await page.goto("/portraits");

  await expect(page.getByRole("heading", { name: "Commanders" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Advisors" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Enemy leaders" })).toBeVisible();

  await page.getByRole("button", { name: "Commanders" }).click();
  await expect(page.getByRole("button", { name: "Commanders" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "All roles" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("heading", { name: "Commanders" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Advisors" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Enemy leaders" })).toHaveCount(0);

  await page.getByRole("button", { name: "All roles" }).click();
  await expect(page.getByRole("heading", { name: "Advisors" })).toBeVisible();
});

test("exposes Field Medic production on the first mission", async ({ page }) => {
  const state = createMission({ seed: 421, missionIndex: 0 });
  const yard = state.entities.find((entity) => entity.owner === 0 && entity.kind === "constructionYard");
  expect(yard).toBeDefined();
  spawnBuilding(state, 0, "barracks", (yard?.x ?? 8) + 4, yard?.y ?? 8);
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: saveKey(421),
    raw: saveEnvelope(state),
  });

  await page.goto("/play?seed=0421&resume=1");
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await page.getByRole("tab", { name: "Production" }).click();
  const medic = page.getByRole("button", { name: /Field Medic, 180 credits/ });
  await expect(medic).toBeVisible();
  await expect(medic).toBeEnabled();
  await medic.click();
  await expect(page.getByTestId("cameo-progress-medic")).toBeVisible();
});

test("keeps the tactical radar readable and usable across breakpoints", async ({ page }) => {
  await deployToBattlefield(page);
  const radar = page.getByTestId("command-sidebar").getByTestId("tactical-radar");
  await expect(radar).toBeVisible();
  await expect(radar).toHaveAttribute("aria-label", /click to focus.*drag to pan/i);
  await expect(page.getByLabel("Tactical radar legend")).toHaveCount(0);

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
  await page.getByTestId("mobile-command-toggle").click();
  const mobileRadar = page.getByTestId("command-sidebar").getByTestId("tactical-radar");
  await expect(mobileRadar).toBeVisible();
  expect(await mobileRadar.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(0);
  await expect.poll(() => mobileRadar.evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) return 0;
    return [...context.getImageData(0, 0, canvas.width, canvas.height).data].reduce((sum, channel) => sum + channel, 0);
  })).toBeGreaterThan(0);
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
  await openBriefing(page);
  await expect(page.getByTestId("briefing-portrait").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible();
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
  await deployToBattlefield(page);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await page.keyboard.press("Escape");
  test.skip(!(await browserSupportsNativeAac(page)), "Chromium does not expose native AAC WebCodecs in this environment.");
  await page.getByRole("button", { name: "Soundtrack", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mission soundtrack" });
  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
  await dialog.getByRole("button", { name: "Download music", exact: true }).click();
  await expect(dialog.getByRole("progressbar", { name: "Download progress" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("dynamica-command-0421-mission-01.m4a");
  const path = await download.path();
  expect(path).not.toBeNull();
  const file = await readFile(path!);
  expect(file.subarray(4, 8).toString("ascii")).toBe("ftyp");
  expect(file.toString("latin1")).toContain("mp4a");
});

test("cancels a soundtrack export without closing the panel", async ({ page }) => {
  await deployToBattlefield(page);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await page.keyboard.press("Escape");
  test.skip(!(await browserSupportsNativeAac(page)), "Chromium does not expose native AAC WebCodecs in this environment.");
  await page.getByRole("button", { name: "Soundtrack", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mission soundtrack" });
  await dialog.getByRole("button", { name: "Download music", exact: true }).click();
  const cancel = dialog.getByRole("button", { name: "Cancel download", exact: true });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(dialog).toContainText("Download cancelled");
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "LOAD MISSION" }).click();
  await page.getByRole("button", { name: /Mission 1/ }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&resume=1/);
  await expect(page.getByTestId("seed")).toHaveText("Seed 0421");
  await expect(page.getByTestId("credits")).toHaveText("9,876");
});

test("offers to reset an unreadable save from the campaign archive", async ({ page }) => {
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, "not valid json");
  }, { key: saveKey(421) });

  await page.goto("/");
  await page.getByRole("button", { name: "LOAD MISSION" }).click();
  const recovery = page.getByRole("alert").filter({ hasText: "Damaged save: 0421" });
  await expect(recovery).toContainText("Damaged save: 0421");
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
  const confirmation = page.getByRole("dialog", { name: "Load mission?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Load mission" }).click();
  await expect(page.getByRole("status")).toContainText(/Loaded the last save/);
  await page.getByRole("button", { name: "Resume Mission" }).click();
  await expect(page.getByTestId("credits")).toHaveText("9,876");
});

test("resumes the active mission after refreshing the window", async ({ page }) => {
  await deployToBattlefield(page);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();

  const state = distinctiveSave();
  await page.evaluate(({ key, raw }) => {
    localStorage.setItem(key, raw);
  }, { key: saveKey(421), raw: saveEnvelope(state) });

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Load Mission" }).click();
  await page.getByRole("dialog", { name: "Load mission?" }).getByRole("button", { name: "Load mission" }).click();
  await expect(page.getByRole("status")).toContainText(/Loaded the last save/);
  await page.getByRole("button", { name: "Resume Mission" }).click();

  await page.reload();
  await expect(page.getByTestId("command-sidebar")).toBeVisible();
  await expect(page.getByTestId("credits")).toHaveText("9,876");
});

test("starts a new same-seed mission after reloading before a fresh launch", async ({ page }) => {
  await deployToBattlefield(page);
  await expect(page.getByTestId("command-sidebar")).toBeVisible();

  const state = distinctiveSave();
  await page.evaluate(({ key, raw }) => {
    localStorage.setItem(key, raw);
  }, { key: saveKey(421), raw: saveEnvelope(state) });

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Load Mission" }).click();
  await page.getByRole("dialog", { name: "Load mission?" }).getByRole("button", { name: "Load mission" }).click();
  await expect(page.getByRole("status")).toContainText(/Loaded the last save/);
  await page.getByRole("button", { name: "Resume Mission" }).click();

  await page.reload();
  await expect(page.getByTestId("credits")).toHaveText("9,876");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Escape to Menu" }).click();
  await page.getByRole("dialog", { name: "Leave mission?" }).getByRole("button", { name: "Leave mission" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("menu-dashboard")).toBeVisible();

  await page.getByRole("button", { name: "NEW GAME" }).click();
  await page.getByLabel("Four digit theater seed").fill("0421");
  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/briefing\?seed=0421&mission=0/);
  await page.getByRole("button", { name: "Launch" }).click();
  await expect(page).toHaveURL(/\/play\?seed=0421&mission=0&fresh=1/);
  await expect(page.getByTestId("credits")).toHaveText("2,000");
});

test("shows a mission result overlay from a finished save", async ({ page }) => {
  const state = distinctiveSave("won");
  await page.addInitScript(({ key, raw }) => {
    localStorage.setItem(key, raw);
  }, { key: saveKey(421), raw: saveEnvelope(state) });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play?seed=0421&resume=1");
  await expect(page.getByTestId("mission-result")).toBeVisible();
  await expect(page.getByTestId("mobile-command-launcher")).toHaveCount(0);
  await expect(page.getByTestId("mission-result")).toHaveAttribute("data-result", "won");
  await expect(page.getByRole("heading", { name: "Mission complete" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next briefing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Campaign map" })).toBeVisible();
});
