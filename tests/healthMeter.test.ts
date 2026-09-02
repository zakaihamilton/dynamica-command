import { describe, expect, it, vi } from "vitest";
import { drawUnitHealthMeter, healthMeterColors } from "../lib/render/renderOverlays";
import { iffColors } from "../lib/render/iff";

describe("health meter colors", () => {
  it("returns green tier for health ratio > 0.5", () => {
    const full = healthMeterColors(1.0);
    expect(full.top).toBe("#4ade80");
    expect(full.bottom).toBe("#16a34a");

    const halfPlus = healthMeterColors(0.51);
    expect(halfPlus.top).toBe("#4ade80");
  });

  it("returns amber/yellow tier for health ratio between 0.25 and 0.5", () => {
    const mid = healthMeterColors(0.5);
    expect(mid.top).toBe("#fde047");
    expect(mid.bottom).toBe("#d97706");

    const quarterPlus = healthMeterColors(0.26);
    expect(quarterPlus.top).toBe("#fde047");
  });

  it("returns red critical tier for health ratio <= 0.25", () => {
    const low = healthMeterColors(0.25);
    expect(low.top).toBe("#f87171");
    expect(low.bottom).toBe("#dc2626");

    const critical = healthMeterColors(0.05);
    expect(critical.top).toBe("#f87171");
  });
});

describe("drawUnitHealthMeter canvas rendering", () => {
  function createMockCtx(): CanvasRenderingContext2D {
    const grad = {
      addColorStop: vi.fn(),
    };
    return {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue(grad),
      globalAlpha: 1,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
  }

  it("skips rendering if maxHp <= 0 or hp <= 0", () => {
    const ctx = createMockCtx();
    drawUnitHealthMeter(ctx, 100, 50, 0, 100, 1);
    expect(ctx.save).not.toHaveBeenCalled();

    drawUnitHealthMeter(ctx, 100, 50, 100, 0, 1);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("renders background frame, track, fill, and border for full health", () => {
    const ctx = createMockCtx();
    drawUnitHealthMeter(ctx, 100, 50, 100, 100, 1, 1, false, 20);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(90, 50, 90, 54);
    expect(ctx.strokeStyle).toBe(iffColors(0).frame);
    // strokeRect for border
    expect(ctx.strokeRect).toHaveBeenCalledWith(89.5, 49.5, 21, 5);
    // fillRect calls: frame, track, fill, gloss line, IFF pip
    expect(ctx.fillRect).toHaveBeenCalledWith(89, 49, 22, 6); // frame
    expect(ctx.fillRect).toHaveBeenCalledWith(90, 50, 20, 4); // track
    expect(ctx.fillRect).toHaveBeenCalledWith(90, 50, 20, 4); // fill
    expect(ctx.fillRect).toHaveBeenCalledWith(89, 50, 3, 4); // ally pip
  });

  it("renders proportional fill for damaged unit", () => {
    const ctx = createMockCtx();
    drawUnitHealthMeter(ctx, 100, 50, 50, 100, 1, 1, false, 20);

    // 50% fill on width 20 = 10px fill width
    expect(ctx.fillRect).toHaveBeenCalledWith(90, 50, 10, 4);
  });

  it("renders selection indicator when isSelected is true", () => {
    const ctx = createMockCtx();
    drawUnitHealthMeter(ctx, 100, 50, 80, 100, 1, 1, true, 20);

    // Selection top accent
    expect(ctx.fillRect).toHaveBeenCalledWith(90, 48, 20, 1);
  });

  it("respects alpha and zoom scaling", () => {
    const ctx = createMockCtx();
    drawUnitHealthMeter(ctx, 200, 100, 100, 100, 2, 0.75, false);

    expect(ctx.globalAlpha).toBe(0.75);
    // Zoom 2 should result in width around 40px and height 7px
    expect(ctx.fillRect).toHaveBeenCalledWith(179, 99, 42, 9);
  });

  it("colors the frame and pip by owner, and gold for neutrals", () => {
    const ally = createMockCtx();
    drawUnitHealthMeter(ally, 100, 50, 100, 100, 1, 1, false, 20, 0);
    expect(ally.strokeStyle).toBe(iffColors(0).frame);
    expect(ally.fillStyle).toBe(iffColors(0).pip);

    const enemy = createMockCtx();
    drawUnitHealthMeter(enemy, 100, 50, 100, 100, 1, 1, false, 20, 1);
    expect(enemy.strokeStyle).toBe(iffColors(1).frame);
    expect(enemy.fillStyle).toBe(iffColors(1).pip);

    const neutral = createMockCtx();
    drawUnitHealthMeter(neutral, 100, 50, 100, 100, 1, 1, false, 20, 0, true);
    expect(neutral.strokeStyle).toBe(iffColors(0, true).frame);
    expect(neutral.fillStyle).toBe(iffColors(0, true).pip);
    expect(neutral.fillStyle).not.toBe(iffColors(1).pip);
  });
});
