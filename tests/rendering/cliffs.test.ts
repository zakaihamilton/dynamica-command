import { describe, expect, it, vi } from "vitest";
import { cliffFaces } from "../../lib/gen/tilePalette";
import { drawElevationFaces, fillElevationPoly } from "../../lib/render/terrainPaint/cliffs";

function createMockCtx(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
  } as unknown as CanvasRenderingContext2D;
}

describe("cliff canvas painting", () => {
  it("skips polygons with fewer than three points", () => {
    const ctx = createMockCtx();
    fillElevationPoly(ctx, 10, 20, [0, 0, 4, 4]);
    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it("draws and optionally strokes a translated polygon", () => {
    const ctx = createMockCtx();
    fillElevationPoly(ctx, 10, 20, [0, 0, 4, 0, 4, 4], "#123456", true);

    expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(1, 14, 20);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(2, 14, 24);
    expect(ctx.closePath).toHaveBeenCalledOnce();
    expect(ctx.fill).toHaveBeenCalledOnce();
    expect(ctx.stroke).toHaveBeenCalledOnce();
    expect(ctx.fillStyle).toBe("#123456");
  });

  it("paints both cliff faces and their corner wedge", () => {
    const ctx = createMockCtx();
    drawElevationFaces(ctx, 100, 50, 64, 32, 16, 2, 2, 421, cliffFaces("ash plains", 3), 4, 7);

    expect(ctx.fill).toHaveBeenCalledTimes(10);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
  });
});
