import { describe, expect, it } from "vitest";
import { fogIndex } from "../lib/sim/fog";
import { makeFixture, setTile } from "../lib/sim/fixtures";
import { terrainContourMapPoints, shouldRenderTerrainAdornment } from "../lib/render/renderer";
import { minimapRegionForCell, terrainColors } from "../lib/render/minimap";
import { SURFACE_CONCRETE, SURFACE_NONE, SURFACE_ROAD, TILE_BLOCKED, TILE_CLEAR, TILE_RESOURCE, TILE_WATER } from "../lib/types";
import { generateMap } from "../lib/gen/map";

function containsPoint(polygon: Array<{ x: number; y: number }>, point: { x: number; y: number }): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

describe("organic terrain rendering helpers", () => {
  it("builds deterministic organic contours that contain the playable map", () => {
    const first = generateMap(832, { index: 0, win: { kind: "annihilate" }, mapSize: 48 });
    const second = generateMap(832, { index: 0, win: { kind: "annihilate" }, mapSize: 48 });
    const other = generateMap(3209, { index: 0, win: { kind: "annihilate" }, mapSize: 48 });
    const contour = terrainContourMapPoints({ ...first, seed: 832 });
    expect(contour).toEqual(terrainContourMapPoints({ ...second, seed: 832 }));
    expect(contour).not.toEqual(terrainContourMapPoints({ ...other, seed: 3209 }));
    for (const point of [
      { x: 0.5, y: 0.5 },
      { x: first.width - 0.5, y: 0.5 },
      { x: first.width - 0.5, y: first.height - 0.5 },
      { x: 0.5, y: first.height - 0.5 },
    ]) {
      expect(containsPoint(contour, point)).toBe(true);
    }
  });

  it("only allows visible open ground to receive terrain adornments", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" } });
    expect(shouldRenderTerrainAdornment(state, 4, 4)).toBe(true);

    setTile(state, 4, 4, TILE_WATER);
    expect(shouldRenderTerrainAdornment(state, 4, 4)).toBe(false);
    setTile(state, 4, 4, TILE_RESOURCE);
    expect(shouldRenderTerrainAdornment(state, 4, 4)).toBe(false);
    setTile(state, 4, 4, TILE_BLOCKED);
    expect(shouldRenderTerrainAdornment(state, 4, 4)).toBe(false);
    setTile(state, 4, 4, TILE_CLEAR);

    state.surfaces[4 * state.width + 4] = SURFACE_ROAD;
    expect(shouldRenderTerrainAdornment(state, 4, 4)).toBe(false);
    state.surfaces[4 * state.width + 4] = SURFACE_CONCRETE;
    expect(shouldRenderTerrainAdornment(state, 4, 4)).toBe(false);
    state.surfaces[4 * state.width + 4] = SURFACE_NONE;
    state.fog[fogIndex(state, 4, 4)!] = 0;
    expect(shouldRenderTerrainAdornment(state, 4, 4)).toBe(false);
  });

  it("keeps minimap region classification and palette semantics coordinated", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" } });
    setTile(state, 1, 1, TILE_WATER);
    setTile(state, 2, 2, TILE_RESOURCE);
    setTile(state, 3, 3, TILE_BLOCKED);
    state.heights[4 * state.width + 4] = 2;
    state.heights[5 * state.width + 5] = 3;
    state.surfaces[6 * state.width + 6] = SURFACE_ROAD;
    state.surfaces[7 * state.width + 7] = SURFACE_CONCRETE;

    expect(minimapRegionForCell(state, 1, 1)).toBe("water");
    expect(minimapRegionForCell(state, 2, 2)).toBe("resource");
    expect(minimapRegionForCell(state, 3, 3)).toBe("blocked");
    expect(minimapRegionForCell(state, 4, 4)).toBe("elevation-mid");
    expect(minimapRegionForCell(state, 5, 5)).toBe("elevation-high");
    expect(minimapRegionForCell(state, 6, 6)).toBe("road");
    expect(minimapRegionForCell(state, 7, 7)).toBe("concrete");

    const colors = terrainColors("tundra grid");
    expect(colors.low).not.toBe(colors.mid);
    expect(colors.mid).not.toBe(colors.high);
    expect(colors.water).not.toBe(colors.road);
    expect(colors.concrete).toBe(colors.low);
  });
});
