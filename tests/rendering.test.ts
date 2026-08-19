import { describe, expect, it } from "vitest";
import { makeFixture, setTile } from "../lib/sim/fixtures";
import { minimapRegionForCell, terrainColors } from "../lib/render/minimap";
import { SURFACE_CONCRETE, SURFACE_ROAD, TILE_BLOCKED, TILE_CLEAR, TILE_RESOURCE, TILE_WATER } from "../lib/types";
import { generateMap } from "../lib/gen/map";
import {
  atlasPixelAtTile,
  atlasRectForTile,
  bakeTerrainAtlasData,
  fogTerrainGain,
  oreCrystalCluster,
  oreShardCount,
  oreVeinAt,
  oreVeinPeak,
  ORE_GLINT_RIDGE,
  ORE_VEIN_PROBES,
  resourceSignature,
  sampleTerrainMaterial,
  terrainAtlasKey,
  type TerrainAtlasData,
} from "../lib/render/terrainAtlas";
import {
  oreGlint,
  oreSparkle,
  waterCaustic,
  weatherKindForBiome,
  weatherParticleAt,
} from "../lib/render/terrainWeather";

function atlasCellGoldSpread(atlas: TerrainAtlasData, tileX: number, tileY: number): number {
  const rect = atlasRectForTile(tileX, tileY, atlas.mapWidth);
  let min = 510;
  let max = 0;
  for (let ly = 0; ly < rect.sh; ly++) {
    for (let lx = 0; lx < rect.sw; lx++) {
      const i = ((rect.sy + ly) * atlas.width + (rect.sx + lx)) * 4;
      const gold = (atlas.data[i] ?? 0) + (atlas.data[i + 1] ?? 0);
      if (gold < min) min = gold;
      if (gold > max) max = gold;
    }
  }
  return max - min;
}

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
    const high = atlasPixelAtTile(atlas, 4, 4);
    const road = atlasPixelAtTile(atlas, 6, 6);
    const concrete = atlasPixelAtTile(atlas, 7, 7);
    expect(water[2]).toBeGreaterThan(water[0]);
    expect(sampleTerrainMaterial(state, 1, 1).water).toBe(true);
    expect(atlasCellGoldSpread(atlas, 2, 2)).toBeGreaterThan(atlasCellGoldSpread(atlas, 0, 0));
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

describe("ore veins", () => {
  it("is deterministic, bounded, and weaker after harvest", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 3, 2, TILE_RESOURCE, 800);
    let mapX = 3.4;
    let mapY = 2.3;
    let a = oreVeinAt(state, mapX, mapY);
    for (let ly = 0; ly < 8; ly++) {
      for (let lx = 0; lx < 8; lx++) {
        const sample = oreVeinAt(state, 3 + (lx + 0.5) / 8, 2 + (ly + 0.5) / 8);
        if (sample.ridge > a.ridge) {
          a = sample;
          mapX = 3 + (lx + 0.5) / 8;
          mapY = 2 + (ly + 0.5) / 8;
        }
      }
    }
    expect(oreVeinAt(state, mapX, mapY)).toEqual(a);
    expect(a.ridge).toBeGreaterThan(0);
    expect(a.ridge).toBeLessThanOrEqual(1);
    expect(a.intensity).toBeGreaterThan(0);
    expect(a.intensity).toBeLessThanOrEqual(1);
    state.resourceAmount[2 * state.width + 3] = 120;
    const poor = oreVeinAt(state, mapX, mapY);
    expect(poor.ridge).toBe(a.ridge);
    expect(poor.intensity).toBeLessThan(a.intensity);
  });

  it("picks a deterministic peak that harvest can drop below the crystal cutoff", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 3, 2, TILE_RESOURCE, 800);
    const peak = oreVeinPeak(state, 3, 2);
    expect(oreVeinPeak(state, 3, 2)).toEqual(peak);
    let best = 0;
    for (const [fx, fy] of ORE_VEIN_PROBES) {
      const intensity = oreVeinAt(state, 3 + fx, 2 + fy).intensity;
      if (intensity > best) best = intensity;
    }
    expect(peak.intensity).toBe(best);
    expect(peak.intensity).toBeGreaterThanOrEqual(ORE_GLINT_RIDGE);
    state.resourceAmount[2 * state.width + 3] = 50;
    expect(oreVeinPeak(state, 3, 2).intensity).toBeLessThan(ORE_GLINT_RIDGE);
  });

  it("builds a deterministic faceted cluster on a rich peak", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 3, 2, TILE_RESOURCE, 800);
    const cluster = oreCrystalCluster(state, 3, 2);
    expect(cluster).not.toBeNull();
    expect(oreCrystalCluster(state, 3, 2)).toEqual(cluster);
    expect(cluster!.shards).toHaveLength(oreShardCount(800));
    expect(cluster!.shards[0]!.rise).toBeGreaterThan(8);
    expect(cluster!.shards[0]!.rise).toBeLessThan(18);
    expect(cluster!.shards[0]!.half).toBeGreaterThan(8);
    const spanX = Math.max(...cluster!.shards.map((s) => s.dx)) - Math.min(...cluster!.shards.map((s) => s.dx));
    const spanY = Math.max(...cluster!.shards.map((s) => s.dy)) - Math.min(...cluster!.shards.map((s) => s.dy));
    expect(spanX).toBeGreaterThan(24);
    expect(spanY).toBeGreaterThan(12);
    state.resourceAmount[2 * state.width + 3] = 50;
    expect(oreCrystalCluster(state, 3, 2)).toBeNull();
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
    expect(oreSparkle(900, 2, 2, 0)).toEqual(oreSparkle(900, 2, 2, 0));
    expect(oreSparkle(1800, 2, 2, 0).sweep).not.toBe(oreSparkle(900, 2, 2, 0).sweep);
    expect(oreSparkle(900, 2, 2, 1).twinkle).toBeGreaterThanOrEqual(0);
    expect(oreSparkle(900, 2, 2, 1).twinkle).toBeLessThanOrEqual(1);
    expect(weatherKindForBiome("tundra grid")).toBe("snow");
    expect(weatherKindForBiome("volcanic shelf")).toBe("ember");
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
