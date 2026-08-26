import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const configuredPath = process.env.PLAYWRIGHT_CHROME_PATH;

if (configuredPath && !existsSync(configuredPath)) {
  console.error(`Playwright preflight failed: PLAYWRIGHT_CHROME_PATH does not exist: ${configuredPath}`);
  process.exit(1);
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(configuredPath ? { executablePath: configuredPath } : {}),
    });
    await browser.close();
    console.log(`Playwright browser preflight passed${configuredPath ? ` using ${configuredPath}` : " using the bundled Chromium"}.`);
  } catch (error) {
    await browser?.close().catch(() => undefined);
    console.error("Playwright preflight failed: the configured browser could not launch.");
    console.error("Install Chromium with `yarn playwright install chromium`, or set PLAYWRIGHT_CHROME_PATH to a runnable Chrome/Chromium executable.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
