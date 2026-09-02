import { describe, expect, it, vi } from "vitest";
import { unitSprite } from "../lib/gen/assets";
import { generateFactions } from "../lib/gen/factions";
import { generateVisualProfile } from "../lib/gen/visualProfile";
import {
  ALLY_IFF_HEX,
  ENEMY_IFF_HEX,
  NEUTRAL_IFF_HEX,
  drawUnitIffMarker,
  iffColors,
} from "../lib/render/iff";
import { unitShadowRadii } from "../lib/render/unitMotion";

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

describe("drawUnitIffMarker", () => {
  function createMockCtx() {
    const strokes: string[] = [];
    const fills: string[] = [];
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      ellipse: vi.fn(),
      globalAlpha: 1,
      lineWidth: 1,
      set fillStyle(value: string | CanvasGradient | CanvasPattern) {
        fills.push(String(value));
      },
      set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
        strokes.push(String(value));
      },
      get fills() {
        return fills;
      },
      get strokes() {
        return strokes;
      },
    } as unknown as CanvasRenderingContext2D & { fills: string[]; strokes: string[] };
  }

  it("strokes a cyan ellipse for owner 0 and red for owner 1", () => {
    const ally = createMockCtx();
    const enemy = createMockCtx();
    const { radX, radY } = unitShadowRadii("tank", 1);
    drawUnitIffMarker(ally, "tank", 40, 80, 1, 1, 0);
    drawUnitIffMarker(enemy, "tank", 40, 80, 1, 1, 1);

    expect(ally.ellipse).toHaveBeenCalledWith(40, 80, radX * 1.42, radY * 1.48, 0, 0, Math.PI * 2);
    expect(ally.strokes).toContain(iffColors(0).stroke);
    expect(ally.fills).toContain(iffColors(0).fill);
    expect(enemy.strokes).toContain(iffColors(1).stroke);
    expect(enemy.fills).toContain(iffColors(1).fill);
  });

  it("does not paint neutrals with enemy red", () => {
    const ctx = createMockCtx();
    drawUnitIffMarker(ctx, "convoyTruck", 10, 20, 1, 1, 0, true);
    expect(ctx.strokes).toContain(iffColors(0, true).stroke);
    expect(ctx.strokes).not.toContain(iffColors(1).stroke);
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
  });
});
