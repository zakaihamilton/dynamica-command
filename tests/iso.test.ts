import { describe, expect, it } from "vitest";
import {
  TILE_H,
  TILE_W,
  HEIGHT_STEP,
  cameraViewQuad,
  createCamera,
  expandIsoDiamond,
  isoAtlasTransform,
  screenToGroundTile,
  screenToTile,
  tileToScreen,
} from "../lib/iso";

describe("iso projection", () => {
  it("round-trips tile coordinates through screen space", () => {
    const cam = createCamera();
    cam.x = 120;
    cam.y = -40;
    cam.zoom = 1.25;
    const screen = tileToScreen(6.5, 3.25, cam, 2);
    const tile = screenToTile(screen.x, screen.y + 2 * HEIGHT_STEP * cam.zoom, cam);
    expect(tile.x).toBeCloseTo(6.5);
    expect(tile.y).toBeCloseTo(3.25);
  });

  it("lifts elevated tiles by HEIGHT_STEP and keeps ground picking independent of that lift", () => {
    const cam = createCamera();
    const ground = tileToScreen(4, 4, cam, 0);
    const raised = tileToScreen(4, 4, cam, 2);
    expect(raised.x).toBe(ground.x);
    expect(raised.y).toBe(ground.y - 2 * HEIGHT_STEP * cam.zoom);

    const picked = screenToGroundTile(ground.x, ground.y + (TILE_H / 2) * cam.zoom, cam);
    expect(picked.x).toBeCloseTo(4);
    expect(picked.y).toBeCloseTo(4);
  });

  it("returns a four-corner ground quad for the camera view", () => {
    const cam = createCamera();
    const quad = cameraViewQuad(cam, 640, 480);
    expect(quad).toHaveLength(4);
    expect(quad[0]).not.toEqual(quad[1]);
    expect(quad[1]).not.toEqual(quad[2]);
  });

  it("expands an iso diamond around its vertical center", () => {
    expect(expandIsoDiamond(10, 20, 64, 32, 1.5)).toEqual({
      x: 10,
      y: 20 - 8,
      w: 96,
      h: 48,
    });
  });

  it("builds an affine atlas transform onto a diamond of TILE_W × TILE_H", () => {
    const [a, b, c, d, e, f] = isoAtlasTransform(8, 16, TILE_W, TILE_H, 8, 8);
    expect([a, b, c, d, e, f]).toEqual([4, 2, -4, 2, 8, 16]);
  });
});
