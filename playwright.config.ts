import { defineConfig, devices } from "@playwright/test";

const chromePath = process.env.PLAYWRIGHT_CHROME_PATH;

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
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...(chromePath ? { launchOptions: { executablePath: chromePath } } : {}) } },
    {
      name: "iphone-touch",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
    { name: "android-touch", testMatch: /responsive\.spec\.ts/, use: { ...devices["Pixel 5"], ...(chromePath ? { launchOptions: { executablePath: chromePath } } : {}) } },
  ],
  webServer: {
    command: "yarn build && PORT=3100 HOSTNAME=127.0.0.1 yarn start",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
