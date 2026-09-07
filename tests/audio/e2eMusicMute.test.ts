import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("E2E soundtrack guard", () => {
  it("keeps the runtime soundtrack disabled even when saved preferences enable music", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MUTE_MUSIC", "1");
    const { isMusicEnabled, setMusicEnabled } = await import("../../lib/audio/music");

    setMusicEnabled(true);

    expect(isMusicEnabled()).toBe(false);
  });
});
