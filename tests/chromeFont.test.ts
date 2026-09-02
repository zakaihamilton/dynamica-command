// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { chromeMonoFamily, chromeMonoFont } from "../lib/ui/chromeFont";

describe("chromeMonoFont", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--font-mono");
    document.documentElement.style.removeProperty("--font-ibm-plex-mono");
  });

  it("falls back when no token is set", () => {
    expect(chromeMonoFamily()).toContain("ui-monospace");
  });

  it("resolves nested font tokens for canvas", () => {
    document.documentElement.style.setProperty("--font-ibm-plex-mono", "'IBM Plex Mono'");
    document.documentElement.style.setProperty(
      "--font-mono",
      "var(--font-ibm-plex-mono, ui-monospace), ui-monospace, monospace",
    );
    expect(chromeMonoFamily()).toBe("'IBM Plex Mono', ui-monospace, monospace");
    expect(chromeMonoFont(12, 700)).toBe("700 12px 'IBM Plex Mono', ui-monospace, monospace");
  });

  it("uses the CSS var fallback when the inner token is empty", () => {
    document.documentElement.style.setProperty(
      "--font-mono",
      "var(--font-ibm-plex-mono, ui-monospace), monospace",
    );
    expect(chromeMonoFamily()).toBe("ui-monospace, monospace");
  });
});
