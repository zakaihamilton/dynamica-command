import { describe, expect, it, vi } from "vitest";
import { addUnit, makeFixture, setTile } from "../lib/sim/fixtures";
import { minimapRegionForCell, terrainColors } from "../lib/render/minimap";
import { SURFACE_CONCRETE, SURFACE_ROAD, TILE_BLOCKED, TILE_CLEAR, TILE_RESOURCE, TILE_WATER } from "../lib/types";
import type { BiomeName } from "../lib/types";
import {
  ARID_SCATTER,
  LUSH_SCATTER,
  blockerPropKind,
  scatterForTile,
} from "../lib/render/terrainPaint";
import { generateMap } from "../lib/gen/map";
import { TILE_H, TILE_W, expandIsoDiamond, isoAtlasTransform, createCamera } from "../lib/iso";
import {
  ATLAS_CELL,
  atlasPixelAtTile,
  atlasRectForTile,
  bakeTerrainAtlasData,
  fogTerrainGain,
  getTerrainAtlas,
  invalidateTerrainAtlas,
  oreCrystalCluster,
  oreVeinAt,
  oreVeinPeak,
  ORE_CRYSTAL_MIN_AMOUNT,
  ORE_GLINT_RIDGE,
  ORE_VEIN_PROBES,
  resourceSignature,
  terrainLayoutSignature,
  sampleTerrainMaterial,
  terrainAtlasKey,
  biomeMaterials,
  type TerrainAtlasData,
} from "../lib/render/terrainAtlas";
import {
  oreGlint,
  oreSparkle,
  waterCaustic,
  weatherKindForBiome,
  weatherParticleAt,
  visibleFxTileCoords,
  waterFxNeedsClip,
} from "../lib/render/terrainWeather";
import { spriteCacheKey, terrainContentKey } from "../lib/render/renderer";
import { minimapCacheKeys, MINIMAP_OVERLAY_TICK_SHIFT } from "../lib/render/minimap";
import { hash2 } from "../lib/render/terrainMaterials";
import { hashNoise, valueNoise } from "../lib/gen/map/noise";
import { isoDiamondPath } from "../lib/render/isoDiamond";

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
  it("shares deterministic noise and preserves the isometric diamond path", () => {
    expect(hash2(7, -3, 41)).toBe(hashNoise(7, -3, 41));
    const noise = valueNoise(2.25, -1.5, 41);
    expect(noise).toBe(valueNoise(2.25, -1.5, 41));
    expect(noise).not.toBe(valueNoise(2.25, -1.5, 42));

    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    isoDiamondPath(ctx, 10, 20, 8, 4);

    expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(1, 14, 22);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(2, 10, 24);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(3, 6, 22);
    expect(ctx.closePath).toHaveBeenCalledOnce();
  });

  it("scopes raster fallback cache keys to the active mission session", () => {
    const state = makeFixture({ win: { kind: "annihilate" }, seed: 832 });
    const unit = addUnit(state, 0, "infantry", 3, 3);
    const sameSession = spriteCacheKey(state, unit);
    const otherMission = spriteCacheKey({ ...state, missionIndex: 1 }, unit);
    const tutorial = spriteCacheKey({ ...state, tutorialStage: "select" }, unit);
    const otherSeed = spriteCacheKey({ ...state, seed: 3209 }, unit);

    expect(spriteCacheKey(state, unit)).toBe(sameSession);
    expect(new Set([sameSession, otherMission, tutorial, otherSeed]).size).toBe(4);
  });

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
    const generated = generateMap(832, { index: 0, win: { kind: "annihilate" }, mapSize: 48, biome: "ash plains" });
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

  it("keeps shore water blue instead of mixing bank sand", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 1, 1, TILE_WATER);
    const atlas = bakeTerrainAtlasData(state);
    const shore = atlasPixelAtTile(atlas, 1, 1);
    const mats = biomeMaterials(state.biome);
    expect(shore[2]).toBeGreaterThan(shore[0]);
    const dist = (px: [number, number, number], c: { r: number; g: number; b: number }) => (
      Math.abs(px[0] - c.r) + Math.abs(px[1] - c.g) + Math.abs(px[2] - c.b)
    );
    expect(dist(shore, mats.waterMid)).toBeLessThan(dist(shore, mats.shore));
    expect(sampleTerrainMaterial(state, 1, 1).b).toBeGreaterThan(sampleTerrainMaterial(state, 1, 1).r);
  });

  it("bakes lake interiors darker than the rim", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" }, seed: 832 });
    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) setTile(state, x, y, TILE_WATER);
    }
    const atlas = bakeTerrainAtlasData(state);
    const cellLum = (tx: number, ty: number): number => {
      const rect = atlasRectForTile(tx, ty, atlas.mapWidth);
      let sum = 0;
      for (let ly = 0; ly < rect.sh; ly++) {
        for (let lx = 0; lx < rect.sw; lx++) {
          const i = ((rect.sy + ly) * atlas.width + (rect.sx + lx)) * 4;
          sum += (atlas.data[i] ?? 0) + (atlas.data[i + 1] ?? 0) + (atlas.data[i + 2] ?? 0);
        }
      }
      return sum / (rect.sw * rect.sh);
    };
    expect(atlasPixelAtTile(atlas, 3, 3)[2]).toBeGreaterThan(atlasPixelAtTile(atlas, 3, 3)[0]);
    expect(cellLum(3, 3)).toBeLessThan(cellLum(2, 2));
    expect(cellLum(3, 3)).toBeLessThan(cellLum(2, 3));
  });

  it("bakes a dark grout seam around each concrete pad", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" }, seed: 832 });
    state.surfaces[7 * state.width + 7] = SURFACE_CONCRETE;
    state.surfaces[8 * state.width + 7] = SURFACE_CONCRETE;
    const atlas = bakeTerrainAtlasData(state);
    const rect = atlasRectForTile(7, 7, atlas.mapWidth);
    const lum = (lx: number, ly: number): number => {
      const i = ((rect.sy + ly) * atlas.width + (rect.sx + lx)) * 4;
      return (atlas.data[i] ?? 0) + (atlas.data[i + 1] ?? 0) + (atlas.data[i + 2] ?? 0);
    };
    const center = lum(ATLAS_CELL >> 1, ATLAS_CELL >> 1);
    expect(lum(0, ATLAS_CELL >> 1)).toBeLessThan(center);
    expect(lum(ATLAS_CELL - 1, ATLAS_CELL >> 1)).toBeLessThan(center);
    expect(lum(ATLAS_CELL >> 1, 0)).toBeLessThan(center);
    expect(lum(ATLAS_CELL >> 1, ATLAS_CELL - 1)).toBeLessThan(center);
    const [r, g, b] = atlasPixelAtTile(atlas, 7, 7);
    expect(Math.abs(r - 89)).toBeLessThan(22);
    expect(Math.abs(g - 104)).toBeLessThan(22);
    expect(Math.abs(b - 117)).toBeLessThan(22);
    expect(b).toBeGreaterThan(r);
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

  it("maps atlas cells onto isometric diamond vertices", () => {
    const [a, b, c, d, e, f] = isoAtlasTransform(100, 50, TILE_W, TILE_H, 8, 8);
    const map = (u: number, v: number) => ({ x: a * u + c * v + e, y: b * u + d * v + f });
    expect(map(0, 0)).toEqual({ x: 100, y: 50 });
    expect(map(8, 0)).toEqual({ x: 132, y: 66 });
    expect(map(0, 8)).toEqual({ x: 68, y: 66 });
    expect(map(8, 8)).toEqual({ x: 100, y: 82 });
  });

  it("expands an isometric diamond about its center", () => {
    const box = expandIsoDiamond(100, 50, 64, 32, 1.5);
    expect(box).toEqual({ x: 100, y: 42, w: 96, h: 48 });
  });

  it("keeps the base atlas stable during partial harvests and invalidates it when ore is exhausted", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 1, 0, TILE_RESOURCE, 800);
    invalidateTerrainAtlas();
    const atlas = getTerrainAtlas(state);
    const before = terrainAtlasKey(state);
    const layoutBefore = terrainLayoutSignature(state.tiles, state.surfaces);
    const sigBefore = resourceSignature(state.resourceAmount);
    state.resourceAmount[1] = 200;
    expect(resourceSignature(state.resourceAmount)).not.toBe(sigBefore);
    expect(terrainLayoutSignature(state.tiles, state.surfaces)).toBe(layoutBefore);
    expect(terrainAtlasKey(state)).toBe(before);
    expect(getTerrainAtlas(state)).toBe(atlas);
    state.tiles[1] = TILE_CLEAR;
    expect(terrainLayoutSignature(state.tiles, state.surfaces)).not.toBe(layoutBefore);
    expect(terrainAtlasKey(state)).not.toBe(before);
    expect(getTerrainAtlas(state)).not.toBe(atlas);
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
    expect(cluster!.bursts.length).toBeGreaterThanOrEqual(2);
    expect(cluster!.bursts.length).toBeLessThanOrEqual(3);
    expect(cluster!.shards.length).toBeGreaterThanOrEqual(5);
    expect(cluster!.shards.length).toBeLessThanOrEqual(11);
    expect(Math.min(...cluster!.shards.map((s) => s.rise))).toBeGreaterThan(2);
    expect(Math.max(...cluster!.shards.map((s) => s.rise))).toBeGreaterThan(6);
    expect(Math.max(...cluster!.shards.map((s) => s.rise))).toBeLessThan(20);
    const lengths = cluster!.shards.map((s) => Math.hypot(s.lean, s.rise));
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(2);
    expect(Math.min(...cluster!.shards.map((s) => s.half))).toBeGreaterThan(2);
    expect(Math.max(...cluster!.shards.map((s) => s.half))).toBeLessThan(5);
    const spanX = Math.max(...cluster!.shards.map((s) => s.dx)) - Math.min(...cluster!.shards.map((s) => s.dx));
    const spanY = Math.max(...cluster!.shards.map((s) => s.dy)) - Math.min(...cluster!.shards.map((s) => s.dy));
    expect(Math.hypot(spanX, spanY)).toBeGreaterThan(16);
    const originSpan = Math.hypot(
      Math.max(...cluster!.bursts.map((b) => b.dx)) - Math.min(...cluster!.bursts.map((b) => b.dx)),
      Math.max(...cluster!.bursts.map((b) => b.dy)) - Math.min(...cluster!.bursts.map((b) => b.dy)),
    );
    expect(originSpan).toBeGreaterThan(14);
    const grouped = cluster!.bursts.every((burst) => (
      cluster!.shards.some((shard) => Math.hypot(shard.dx - burst.dx, shard.dy - burst.dy) < 6)
    ));
    expect(grouped).toBe(true);
    state.resourceAmount[2 * state.width + 3] = 120;
    const depleted = oreCrystalCluster(state, 3, 2);
    expect(depleted).not.toBeNull();
    expect(depleted!.intensity).toBeLessThan(cluster!.intensity);
    expect(depleted!.shards.length).toBeLessThanOrEqual(cluster!.shards.length);
    state.resourceAmount[2 * state.width + 3] = ORE_CRYSTAL_MIN_AMOUNT;
    expect(oreCrystalCluster(state, 3, 2)).toBeNull();
  });

  it("varies burst layout across neighboring ore tiles", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    const clusters = [];
    for (let y = 1; y < 6; y++) {
      for (let x = 1; x < 6; x++) {
        setTile(state, x, y, TILE_RESOURCE, 800);
        const cluster = oreCrystalCluster(state, x, y);
        expect(cluster).not.toBeNull();
        expect(cluster!.shards.length).toBeGreaterThanOrEqual(4);
        clusters.push(cluster!);
      }
    }
    const signatures = new Set(clusters.map((cluster) => JSON.stringify({
      bursts: cluster.bursts,
      shards: cluster.shards,
    })));
    expect(signatures.size).toBe(clusters.length);
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
    expect(waterCaustic(250, 3, 5).phase).not.toBe(waterCaustic(0, 3, 5).phase);
    expect(oreGlint(900, 2, 2)).toBeGreaterThan(0);
    expect(oreSparkle(900, 2, 2, 0)).toEqual(oreSparkle(900, 2, 2, 0));
    expect(oreSparkle(1800, 2, 2, 0).sweep).not.toBe(oreSparkle(900, 2, 2, 0).sweep);
    expect(oreSparkle(900, 2, 2, 1).twinkle).toBeGreaterThanOrEqual(0);
    expect(oreSparkle(900, 2, 2, 1).twinkle).toBeLessThanOrEqual(1);
    expect(weatherKindForBiome("tundra grid")).toBe("snow");
    expect(weatherKindForBiome("volcanic shelf")).toBe("ember");
  });

  it("culls water and ore FX to the visible tile range", () => {
    const state = makeFixture({ width: 48, height: 48, win: { kind: "annihilate" }, seed: 832 });
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        setTile(state, x, y, TILE_WATER);
      }
    }
    setTile(state, 2, 2, TILE_RESOURCE, 800);
    setTile(state, 46, 46, TILE_RESOURCE, 800);
    const cam = createCamera();
    cam.x = 400;
    cam.y = 80;
    cam.zoom = 1;
    const water = visibleFxTileCoords(state, cam, 800, 600, "water");
    const ore = visibleFxTileCoords(state, cam, 800, 600, "ore");
    expect(water.length).toBeGreaterThan(0);
    expect(water.length).toBeLessThan(48 * 48);
    expect(water.some((tile) => tile.x === 8 && tile.y === 8)).toBe(true);
    expect(water.some((tile) => tile.x === 46 && tile.y === 46)).toBe(false);
    expect(ore.some((tile) => tile.x === 2 && tile.y === 2)).toBe(true);
    expect(ore.some((tile) => tile.x === 46 && tile.y === 46)).toBe(false);
  });

  it("drops exhausted ore from the dynamic FX index without rescanning the map", () => {
    const state = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 2, 2, TILE_RESOURCE, 800);
    const cam = createCamera();
    expect(visibleFxTileCoords(state, cam, 800, 600, "ore")).toContainEqual({ x: 2, y: 2 });
    state.tiles[2 * state.width + 2] = TILE_CLEAR;
    state.tick += 1;
    expect(visibleFxTileCoords(state, cam, 800, 600, "ore")).not.toContainEqual({ x: 2, y: 2 });
  });

  it("skips caustic clipping on interior water tiles", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) {
        setTile(state, x, y, TILE_WATER);
      }
    }
    expect(waterFxNeedsClip(state, 3, 3)).toBe(false);
    expect(waterFxNeedsClip(state, 2, 3)).toBe(true);
  });
});

describe("terrain scroll cache key", () => {
  it("ignores camera translation and changes with zoom or fog bucket", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    const cam = createCamera();
    const a = terrainContentKey(state, cam, 640, 360);
    cam.x += 40;
    cam.y -= 18;
    expect(terrainContentKey(state, cam, 640, 360)).toBe(a);
    cam.zoom = 1.15;
    expect(terrainContentKey(state, cam, 640, 360)).not.toBe(a);
    cam.zoom = 1;
    state.tick = 16;
    expect(terrainContentKey(state, cam, 640, 360)).not.toBe(a);
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

  it("throttles overlay cache keys to every other sim tick", () => {
    const state = makeFixture({ width: 10, height: 10, win: { kind: "annihilate" }, seed: 832 });
    const view = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    state.tick = 2;
    const even = minimapCacheKeys(state, view, 96, 96);
    state.tick = 3;
    const odd = minimapCacheKeys(state, view, 96, 96);
    state.tick = 4;
    const next = minimapCacheKeys(state, view, 96, 96);
    expect(MINIMAP_OVERLAY_TICK_SHIFT).toBe(1);
    expect(odd.overlayKey).toBe(even.overlayKey);
    expect(next.overlayKey).not.toBe(even.overlayKey);

    const selected = minimapCacheKeys(state, view, 96, 96, new Set([1, 3]));
    expect(selected.overlayKey).not.toBe(next.overlayKey);
  });
});

function collectScatter(state: ReturnType<typeof makeFixture>) {
  const items = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      items.push(...scatterForTile(state, x, y));
    }
  }
  return items;
}

describe("terrain scatter artifacts", () => {
  it("is deterministic for a seed and cell", () => {
    const state = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" }, seed: 832 });
    const a = scatterForTile(state, 4, 5);
    expect(scatterForTile(state, 4, 5)).toEqual(a);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(scatterForTile({ ...state, seed: 3209 }, 4, 5)).not.toEqual(a);
  });

  it("varies across neighboring cells and biomes", () => {
    const state = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" }, seed: 832 });
    const signatures = new Set<string>();
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        signatures.add(JSON.stringify(scatterForTile(state, x, y)));
      }
    }
    expect(signatures.size).toBeGreaterThan(8);
    const jungle = { ...state, biome: "jungle wreckage" as BiomeName };
    expect(JSON.stringify(collectScatter(jungle))).not.toBe(JSON.stringify(collectScatter(state)));
  });

  it("skips water, concrete, ore, and blocked tiles", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    setTile(state, 1, 1, TILE_WATER);
    setTile(state, 2, 2, TILE_RESOURCE, 800);
    setTile(state, 3, 3, TILE_BLOCKED);
    state.surfaces[4 * state.width + 4] = SURFACE_CONCRETE;
    expect(scatterForTile(state, 1, 1)).toEqual([]);
    expect(scatterForTile(state, 2, 2)).toEqual([]);
    expect(scatterForTile(state, 3, 3)).toEqual([]);
    expect(scatterForTile(state, 4, 4)).toEqual([]);
  });

  it("keeps roads sparse and prefers biome-appropriate clutter", () => {
    const ground = makeFixture({ width: 16, height: 16, win: { kind: "annihilate" }, seed: 832 });
    const road = makeFixture({ width: 16, height: 16, win: { kind: "annihilate" }, seed: 832 });
    road.surfaces.fill(SURFACE_ROAD);
    expect(collectScatter(road).length).toBeLessThan(collectScatter(ground).length);

    const jungle = { ...ground, biome: "jungle wreckage" as BiomeName };
    const desert = { ...ground, biome: "glass desert" as BiomeName };
    const lushCount = collectScatter(jungle).filter((item) => LUSH_SCATTER.has(item.kind)).length;
    const jungleArid = collectScatter(jungle).filter((item) => ARID_SCATTER.has(item.kind)).length;
    const aridCount = collectScatter(desert).filter((item) => ARID_SCATTER.has(item.kind)).length;
    const desertLush = collectScatter(desert).filter((item) => LUSH_SCATTER.has(item.kind)).length;
    expect(lushCount).toBeGreaterThan(jungleArid);
    expect(aridCount).toBeGreaterThan(desertLush);
    expect(aridCount).toBeGreaterThan(0);
  });

  it("keeps blocker props deterministic and biome-keyed", () => {
    expect(blockerPropKind("ash plains", 9)).toBe(blockerPropKind("ash plains", 9));
    const jungle = new Set(Array.from({ length: 40 }, (_, v) => blockerPropKind("jungle wreckage", v)));
    const desert = new Set(Array.from({ length: 40 }, (_, v) => blockerPropKind("glass desert", v)));
    const tundra = new Set(Array.from({ length: 40 }, (_, v) => blockerPropKind("tundra grid", v)));
    expect(jungle.has("tree")).toBe(true);
    expect(desert.has("sandstone") || desert.has("deadShrub")).toBe(true);
    expect(tundra.has("pine") || tundra.has("snowRock")).toBe(true);
    expect(blockerPropKind("jungle wreckage", 3)).not.toBe(blockerPropKind("glass desert", 3));
  });

  it("is deterministic on skirt samples", () => {
    const state = makeFixture({ width: 8, height: 8, win: { kind: "annihilate" }, seed: 832 });
    const skirt = scatterForTile(state, -1, 2);
    expect(scatterForTile(state, -1, 2)).toEqual(skirt);
    expect(skirt.length).toBeLessThanOrEqual(3);
  });
});
