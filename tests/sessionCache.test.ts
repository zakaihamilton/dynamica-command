// @vitest-environment jsdom

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearVisualProfileCache, generateCampaignVisualProfile, generateVisualProfile, visualProfileCacheSize } from "../lib/gen/visualProfile";
import { clearRenderSessionCaches } from "../lib/render/sessionCache";
import { cachedSprite, rasterize, spriteCacheSize } from "../lib/render/sprites";
import type { SpriteSpec } from "../lib/types";

function sprite(id: string): SpriteSpec {
  return {
    id,
    kind: "tile",
    w: 1,
    h: 1,
    palette: {
      primary: "#000",
      secondary: "#000",
      accent: "#000",
      outline: "#000",
      light: "#000",
      dark: "#000",
    },
    shapes: [],
  };
}

describe("render session caches", () => {
  let getContext: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterAll(() => {
    getContext.mockRestore();
  });

  beforeEach(() => {
    clearRenderSessionCaches();
  });

  it("keeps the raster cache at its 512-entry limit and evicts the oldest entry", () => {
    for (let index = 0; index < 512; index++) rasterize(sprite(`sprite-${index}`));
    expect(spriteCacheSize()).toBe(512);
    expect(cachedSprite("sprite-0")).toBeDefined();

    rasterize(sprite("sprite-512"));

    expect(spriteCacheSize()).toBe(512);
    expect(cachedSprite("sprite-0")).toBeUndefined();
    expect(cachedSprite("sprite-512")).toBeDefined();
  });

  it("bounds and clears visual profile caches by session", () => {
    for (let seed = 0; seed < 80; seed++) {
      generateCampaignVisualProfile(seed);
      generateVisualProfile(seed, 0);
      generateVisualProfile(seed, 1);
    }
    expect(visualProfileCacheSize()).toEqual({ campaigns: 64, profiles: 128 });

    clearVisualProfileCache();

    expect(visualProfileCacheSize()).toEqual({ campaigns: 0, profiles: 0 });
  });

  it("clears raster and profile state through the session cleanup entrypoint", () => {
    rasterize(sprite("session-sprite"));
    generateVisualProfile(421, 0);

    clearRenderSessionCaches();

    expect(spriteCacheSize()).toBe(0);
    expect(visualProfileCacheSize()).toEqual({ campaigns: 0, profiles: 0 });
  });
});
