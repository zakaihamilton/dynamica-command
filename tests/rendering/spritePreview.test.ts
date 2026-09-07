import { describe, expect, it } from "vitest";
import {
  SPRITE_PREVIEW_HEIGHT,
  SPRITE_PREVIEW_WIDTH,
  spritePreviewCanvasSize,
  spritePreviewDpr,
  spritePreviewLayout,
} from "../../lib/render/spritePreview";

describe("sidebar sprite preview layout", () => {
  it("clamps backing resolution to a safe high-DPI range", () => {
    expect(spritePreviewDpr(undefined)).toBe(1);
    expect(spritePreviewDpr(0)).toBe(1);
    expect(spritePreviewDpr(1.5)).toBe(1.5);
    expect(spritePreviewDpr(3)).toBe(2);
    expect(spritePreviewCanvasSize(2)).toEqual({
      width: SPRITE_PREVIEW_WIDTH * 2,
      height: SPRITE_PREVIEW_HEIGHT * 2,
    });
  });

  it("fits opaque sprite content inside the existing compact frame", () => {
    expect(spritePreviewLayout({ width: 40, height: 20 })).toEqual({
      scale: 3.44,
      width: 138,
      height: 69,
      x: 11,
      y: 22,
    });
  });

  it("keeps invalid source bounds drawable instead of producing NaN dimensions", () => {
    const layout = spritePreviewLayout({ width: 0, height: 0 });
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(Number.isFinite(layout.scale)).toBe(true);
  });
});
