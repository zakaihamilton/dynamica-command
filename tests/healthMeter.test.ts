import { describe, expect, it, vi } from "vitest";
import { drawUnitHealthMeter, entityHasWorldHealthMeter, healthMeterColors, worldHealthMeterLayout } from "../lib/render/renderOverlays";

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
    // strokeRect for border
    expect(ctx.strokeRect).toHaveBeenCalledWith(89.5, 49.5, 21, 5);
    // fillRect calls: frame, track, fill, gloss line
    expect(ctx.fillRect).toHaveBeenCalledWith(89, 49, 22, 6); // frame
    expect(ctx.fillRect).toHaveBeenCalledWith(90, 50, 20, 4); // track
    expect(ctx.fillRect).toHaveBeenCalledWith(90, 50, 20, 4); // fill
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
});

describe("entityHasWorldHealthMeter", () => {
  it("shows the world meter for units", () => {
    expect(entityHasWorldHealthMeter({ class: "unit", kind: "infantry" })).toBe(true);
    expect(entityHasWorldHealthMeter({ class: "unit", kind: "tank" })).toBe(true);
    expect(entityHasWorldHealthMeter({ class: "unit", kind: "harvester" })).toBe(true);
  });

  it("shows the world meter for turret buildings", () => {
    expect(entityHasWorldHealthMeter({ class: "building", kind: "turret" })).toBe(true);
  });

  it("hides the world meter for other buildings", () => {
    expect(entityHasWorldHealthMeter({ class: "building", kind: "constructionYard" })).toBe(false);
    expect(entityHasWorldHealthMeter({ class: "building", kind: "power" })).toBe(false);
    expect(entityHasWorldHealthMeter({ class: "building", kind: "refinery" })).toBe(false);
    expect(entityHasWorldHealthMeter({ class: "building", kind: "barracks" })).toBe(false);
    expect(entityHasWorldHealthMeter({ class: "building", kind: "factory" })).toBe(false);
    expect(entityHasWorldHealthMeter({ class: "building", kind: "objective" })).toBe(false);
  });
});

describe("worldHealthMeterLayout", () => {
  it("places unit meters above the sprite top", () => {
    const layout = worldHealthMeterLayout({ kind: "infantry" }, { w: 24 }, 100, 80, 200, 1);
    expect(layout.centerX).toBe(112);
    expect(layout.meterY).toBe(73);
    expect(layout.barW).toBe(18);
  });

  it("places turret meters just above the 3D cannon instead of the padded sprite top", () => {
    const layout = worldHealthMeterLayout({ kind: "turret" }, { w: 84 }, 40, 10, 200, 1);
    expect(layout.centerX).toBe(82);
    expect(layout.meterY).toBe(190);
    expect(layout.barW).toBe(24);
    expect(layout.meterY).toBeGreaterThan(10);
  });
});
