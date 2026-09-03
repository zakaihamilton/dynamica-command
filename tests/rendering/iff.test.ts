import { describe, expect, it } from "vitest";
import { unitSprite } from "../../lib/gen/assets";
import { generateFactions } from "../../lib/gen/factions";
import { generateVisualProfile } from "../../lib/gen/visualProfile";
import {
  ALLY_IFF_HEX,
  ENEMY_IFF_HEX,
  NEUTRAL_IFF_HEX,
  iffColors,
} from "../../lib/render/iff";

describe("iffColors", () => {
  it("uses cyan for allies, red for enemies, and gold for neutrals", () => {
    expect(iffColors(0).hex).toBe(ALLY_IFF_HEX);
    expect(iffColors(1).hex).toBe(ENEMY_IFF_HEX);
    expect(iffColors(0).hex).toBe("#46e2ff");
    expect(iffColors(1).hex).toBe("#ff4d36");
    expect(iffColors(1, true).hex).toBe(NEUTRAL_IFF_HEX);
    expect(iffColors(1, true).hex).not.toBe(ENEMY_IFF_HEX);
    expect(iffColors(0, true).pip).not.toBe(iffColors(1).pip);
  });

  it("keeps laser strokes on the same friend/foe tokens", () => {
    expect(iffColors(0).laser).toBe("rgba(70, 226, 255, 0.45)");
    expect(iffColors(1).laser).toBe("rgba(255, 77, 54, 0.45)");
    expect(iffColors(0).laserFill).toBe("rgba(70, 226, 255, 0.28)");
    expect(iffColors(1).laserFill).toBe("rgba(255, 77, 54, 0.28)");
  });
});

describe("faction raster tints", () => {
  it("gives owner 0 and owner 1 different live unit washes", () => {
    const [ally, enemy] = generateFactions(421);
    const profile = generateVisualProfile(421, 0);
    const a = unitSprite("tank", ally.palette, { facing: 2, profile });
    const b = unitSprite("tank", enemy.palette, { facing: 2, profile });
    expect(a.imageTint).not.toBe(b.imageTint);
    expect(a.imageTint).toMatch(/^hsla\(/);
    expect(b.imageTint).toMatch(/^hsla\(/);
    expect(a.imageTint).toMatch(/\/ 0\.14\)$/);
    expect(b.imageTint).toMatch(/\/ 0\.14\)$/);
  });
});
