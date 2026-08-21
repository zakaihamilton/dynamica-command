import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    pool: "threads",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: process.env.NODE_V8_COVERAGE || process.env.VITEST_COVERAGE ? 60_000 : 30_000,
    hookTimeout: process.env.NODE_V8_COVERAGE || process.env.VITEST_COVERAGE ? 60_000 : 30_000,
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
});
