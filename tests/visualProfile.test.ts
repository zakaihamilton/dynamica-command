import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildingSprite, unitSprite } from "../lib/gen/assets";
import { generateFactions } from "../lib/gen/factions";
import { RASTER_ART, TEXTURE_ART } from "../lib/gen/visualAssets";
import { generateVisualProfile, profileKey } from "../lib/gen/visualProfile";

describe("cinematic visual profiles", () => {
  it("derives stable but varied faction identities from seed and owner", () => {
    for (const seed of [0, 42, 421, 1847, 9999]) {
      expect(generateVisualProfile(seed, 0)).toEqual(generateVisualProfile(seed, 0));
    }
    const profiles = [0, 42, 421, 1847, 8162, 9999].flatMap((seed) => [
      profileKey(generateVisualProfile(seed, 0)),
      profileKey(generateVisualProfile(seed, 1)),
    ]);
    expect(new Set(profiles).size).toBeGreaterThan(7);
    expect(new Set(profiles.map((value) => value.split(":")[0])).size).toBe(3);
  });

  it("includes visual identity in sprite cache keys and silhouettes", () => {
    const palette = generateFactions(421)[0].palette;
    const profiles = ([0, 1, 2] as const).map((designFamily) => ({
      ...generateVisualProfile(421, 0),
      designFamily,
    }));
    const units = profiles.map((profile) => unitSprite("tank", palette, { facing: 2, variant: 9, profile }));
    const buildings = profiles.map((profile) => buildingSprite("factory", palette, { variant: 9, profile }));
    expect(new Set(units.map((spec) => spec.id)).size).toBe(3);
    expect(new Set(units.map((spec) => spec.svg)).size).toBe(3);
    expect(new Set(buildings.map((spec) => spec.id)).size).toBe(3);
    expect(new Set(buildings.map((spec) => spec.svg)).size).toBe(3);
    const unitMarkCounts = units.map((spec) => (spec.svg?.match(/<(path|ellipse|line)\b/g) ?? []).length);
    const buildingMarkCounts = buildings.map((spec) => (spec.svg?.match(/<(path|ellipse|line)\b/g) ?? []).length);
    expect(new Set(unitMarkCounts).size).toBeGreaterThan(1);
    expect(new Set(buildingMarkCounts).size).toBe(3);
  });

  it("bundles every declared raster plate and texture locally", () => {
    const assets = [...Object.values(RASTER_ART), ...Object.values(TEXTURE_ART)];
    expect(new Set(assets).size).toBe(assets.length);
    for (const asset of assets) {
      const file = join(process.cwd(), "public", asset);
      expect(existsSync(file), asset).toBe(true);
      expect(statSync(file).size, asset).toBeGreaterThan(1_000);
    }
  });
});
