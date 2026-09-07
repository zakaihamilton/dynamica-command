import { defineConfig, devices } from "@playwright/test";

const chromePath = process.env.PLAYWRIGHT_CHROME_PATH;
const chromiumLaunchOptions = {
  args: ["--mute-audio"],
  ...(chromePath ? { executablePath: chromePath } : {}),
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: chromiumLaunchOptions } },
    {
      name: "iphone-touch",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
    { name: "android-touch", testMatch: /responsive\.spec\.ts/, use: { ...devices["Pixel 5"], launchOptions: chromiumLaunchOptions } },
  ],
  webServer: {
    command: "NEXT_PUBLIC_E2E_MUTE_MUSIC=1 yarn build && PORT=3100 HOSTNAME=127.0.0.1 yarn start",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
