import { describe, expect, it } from "vitest";
import { EDGE_PAN_BAND, EDGE_PAN_DELAY_MS, panDirFromPointer } from "../lib/render/camera";
import { parseTooltipPos, placeTooltip, TOOLTIP_PAD, tooltipMaxBox } from "../lib/ui/tooltip";

describe("edge pan from pointer", () => {
  it("waits 250ms before activating edge scroll", () => {
    expect(EDGE_PAN_DELAY_MS).toBe(250);
  });

  it("returns null away from the rim so map clicks stay selectable", () => {
    expect(panDirFromPointer(200, 200, 800, 600)).toBeNull();
    expect(panDirFromPointer(EDGE_PAN_BAND + 1, 200, 800, 600)).toBeNull();
  });

  it("picks the nearest edge inside the hover band", () => {
    expect(panDirFromPointer(4, 200, 800, 600)).toBe("left");
    expect(panDirFromPointer(796, 200, 800, 600)).toBe("right");
    expect(panDirFromPointer(400, 3, 800, 600)).toBe("up");
    expect(panDirFromPointer(400, 597, 800, 600)).toBe("down");
  });

  it("prefers the closer edge in a corner", () => {
    expect(panDirFromPointer(2, 10, 800, 600)).toBe("left");
    expect(panDirFromPointer(10, 2, 800, 600)).toBe("up");
  });

  it("skips unavailable directions", () => {
    expect(panDirFromPointer(4, 200, 800, 600, EDGE_PAN_BAND, {
      left: false,
      right: true,
      up: true,
      down: true,
    })).toBeNull();
  });
});

describe("floating tooltips", () => {
  it("parses placement attributes", () => {
    expect(parseTooltipPos("below")).toBe("below");
    expect(parseTooltipPos("left")).toBe("left");
    expect(parseTooltipPos(null)).toBe("above");
  });

  it("stays inside the viewport when the anchor is scrolled near a clip edge", () => {
    const placed = placeTooltip(
      { top: 8, left: 20, width: 80, height: 40 },
      { width: 140, height: 28 },
      "above",
      { width: 400, height: 300 },
    );
    expect(placed.top).toBeGreaterThanOrEqual(8);
    expect(placed.left).toBeGreaterThanOrEqual(8);
    expect(placed.top + 28).toBeLessThanOrEqual(300 - 8);
    expect(placed.left + 140).toBeLessThanOrEqual(400 - 8);
  });

  it("flips a left tooltip to the right when it would overflow", () => {
    const placed = placeTooltip(
      { top: 80, left: 10, width: 40, height: 20 },
      { width: 120, height: 24 },
      "left",
      { width: 400, height: 300 },
    );
    expect(placed.left).toBeGreaterThan(50);
  });

  it("keeps a wide tooltip inside the viewport near a right edge", () => {
    const size = { width: 280, height: 36 };
    const view = { width: 400, height: 300 };
    const placed = placeTooltip(
      { top: 80, left: 350, width: 40, height: 20 },
      size,
      "above",
      view,
    );
    expect(placed.left).toBeGreaterThanOrEqual(TOOLTIP_PAD);
    expect(placed.left + size.width).toBeLessThanOrEqual(view.width - TOOLTIP_PAD);
    expect(placed.top).toBeGreaterThanOrEqual(TOOLTIP_PAD);
    expect(placed.top + size.height).toBeLessThanOrEqual(view.height - TOOLTIP_PAD);
  });

  it("caps tooltip size to the padded viewport so copy can wrap instead of clipping", () => {
    expect(tooltipMaxBox({ width: 400, height: 300 })).toEqual({
      width: 400 - TOOLTIP_PAD * 2,
      height: 300 - TOOLTIP_PAD * 2,
    });
  });
});
