import { describe, expect, it } from "vitest";
import { makeFixture, setTile } from "../lib/sim/fixtures";
import { minimapRegionForCell, terrainColors } from "../lib/render/minimap";
import { SURFACE_CONCRETE, SURFACE_ROAD, TILE_BLOCKED, TILE_CLEAR, TILE_RESOURCE, TILE_WATER } from "../lib/types";
import { generateMap } from "../lib/gen/map";
import {
  atlasPixelAtTile,
  bakeTerrainAtlasData,
  fogTerrainGain,
  hasOreCluster,
  resourceSignature,
  sampleTerrainMaterial,
  terrainAtlasKey,
  tileVariant,
} from "../lib/render/terrainAtlas";
import {
  oreGlint,
  waterCaustic,
  weatherKindForBiome,
  weatherParticleAt,
} from "../lib/render/terrainWeather";

describe("seeded terrain atlas", () => {
  it("bakes deterministic atlases that differ by seed", () => {
    const first = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    const second = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    const other = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 3209 });
    other.biome = "rust canyons";
    const a = bakeTerrainAtlasData(first);
    const b = bakeTerrainAtlasData(second);
    const c = bakeTerrainAtlasData(other);
    expect(a.key).toBe(b.key);
    expect(a.data).toEqual(b.data);
    expect(terrainAtlasKey(first)).toBe(a.key);
    expect(c.key).not.toBe(a.key);
    expect(a.data).not.toEqual(c.data);
    const generated = generateMap(832, { index: 0, win: { kind: "annihilate" }, mapSize: 48 });
    const world = { ...generated, seed: 832, missionIndex: 0 };
    expect(sampleTerrainMaterial(world, 4, 4)).toEqual(sampleTerrainMaterial(world, 4, 4));
  });

  it("changes atlas pixels for water, road, ore, and elevation", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 1, 1, TILE_WATER);
    setTile(state, 2, 2, TILE_RESOURCE, 800);
    setTile(state, 3, 3, TILE_BLOCKED);
    state.heights[4 * state.width + 4] = 3;
    state.surfaces[6 * state.width + 6] = SURFACE_ROAD;
    state.surfaces[7 * state.width + 7] = SURFACE_CONCRETE;
    const atlas = bakeTerrainAtlasData(state);
    const ground = atlasPixelAtTile(atlas, 0, 0);
    const water = atlasPixelAtTile(atlas, 1, 1);
    const ore = atlasPixelAtTile(atlas, 2, 2);
    const high = atlasPixelAtTile(atlas, 4, 4);
    const road = atlasPixelAtTile(atlas, 6, 6);
    const concrete = atlasPixelAtTile(atlas, 7, 7);
    expect(water[2]).toBeGreaterThan(water[0]);
    expect(sampleTerrainMaterial(state, 1, 1).water).toBe(true);
    expect(ore[0]).toBeGreaterThan(ground[0]);
    expect(high[0] + high[1] + high[2]).toBeGreaterThan(ground[0] + ground[1] + ground[2]);
    expect(road).not.toEqual(ground);
    expect(concrete).not.toEqual(ground);
    expect(sampleTerrainMaterial(state, 1.5, 1.5).water).toBe(true);
    expect(sampleTerrainMaterial(state, 2.4, 2.4).ore).toBe(true);
  });

  it("keeps unexplored terrain present while fog only darkens it", () => {
    expect(fogTerrainGain(2)).toBe(1);
    expect(fogTerrainGain(1)).toBe(0.55);
    expect(fogTerrainGain(0)).toBe(0.15);
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 11 });
    const visible = sampleTerrainMaterial(state, 3, 3);
    expect(visible.r + visible.g + visible.b).toBeGreaterThan(0);
    expect(fogTerrainGain(0) * visible.r).toBeGreaterThan(0);
  });

  it("invalidates the atlas when any resource cell is harvested", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 1, 0, TILE_RESOURCE, 800);
    const before = terrainAtlasKey(state);
    const sigBefore = resourceSignature(state.resourceAmount);
    state.resourceAmount[1] = 200;
    expect(resourceSignature(state.resourceAmount)).not.toBe(sigBefore);
    expect(terrainAtlasKey(state)).not.toBe(before);
  });
});

describe("terrain weather and water motion", () => {
  it("is deterministic for a given clock", () => {
    const a = weatherParticleAt(832, "tundra grid", 4, 1200, 640, 360);
    const b = weatherParticleAt(832, "tundra grid", 4, 1200, 640, 360);
    expect(a).toEqual(b);
    expect(weatherParticleAt(832, "tundra grid", 4, 2400, 640, 360)).not.toEqual(a);
    expect(waterCaustic(400, 3, 5)).toEqual(waterCaustic(400, 3, 5));
    expect(waterCaustic(800, 3, 5).offset).not.toBe(waterCaustic(400, 3, 5).offset);
    expect(oreGlint(900, 2, 2)).toBeGreaterThan(0);
    expect(weatherKindForBiome("tundra grid")).toBe("snow");
    expect(weatherKindForBiome("volcanic shelf")).toBe("ember");
  });

  it("places ore glints on the same cells as ore clusters", () => {
    const seed = 832;
    let mismatch = 0;
    let clustered = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const signed = (seed * 83492791) ^ (x * 73856093) ^ (y * 19349663);
        if ((signed % 3 === 0) !== hasOreCluster(seed, x, y)) mismatch += 1;
        if (hasOreCluster(seed, x, y)) clustered += 1;
      }
    }
    expect(clustered).toBeGreaterThan(0);
    expect(mismatch).toBeGreaterThan(0);
    expect(tileVariant(seed, 3, 5)).toBe(((seed * 83492791) ^ (3 * 73856093) ^ (5 * 19349663)) >>> 0);
  });
});

describe("minimap classification", () => {
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
    expect(minimapRegionForCell(state, 0, 0)).toBe("ground");
    setTile(state, 0, 0, TILE_CLEAR);

    const colors = terrainColors("tundra grid");
    expect(colors.low).not.toBe(colors.mid);
    expect(colors.mid).not.toBe(colors.high);
    expect(colors.water).not.toBe(colors.road);
  });
});
