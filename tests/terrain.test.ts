import { describe, expect, it } from "vitest";
import { generateMap } from "../lib/gen/map";
import { createMission } from "../lib/sim/api";
import { buildingAt } from "../lib/sim/world";
import { BUILDING_STATS, footprintOf } from "../lib/catalog";
import type { BuildingKind } from "../lib/types";

describe("terrain height", () => {
  it("generated maps have a heightmap with varied elevation", () => {
    const map = generateMap(0, { index: 0, win: { kind: "annihilate" }, mapSize: 48 });
    expect(map.heights).toHaveLength(48 * 48);
    const stats = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const h of map.heights) {
      const k = Math.max(0, Math.min(3, h)) as 0 | 1 | 2 | 3;
      stats[k] += 1;
    }
    expect(stats[0] + stats[1]).toBeGreaterThan(0);
    expect(stats[1]).toBeGreaterThan(0);
    expect(stats[2] + stats[3]).toBeGreaterThan(0);
  });

  it("start areas are flat enough to place a construction yard", () => {
    const map = generateMap(42, { index: 0, win: { kind: "razeAll" }, mapSize: 48 });
    const fp = BUILDING_STATS.constructionYard.footprint;
    const h0 = map.heights[map.playerStart.y * map.width + map.playerStart.x];
    for (let oy = 0; oy < fp.h; oy++) {
      for (let ox = 0; ox < fp.w; ox++) {
        expect(map.heights[(map.playerStart.y + oy) * map.width + map.playerStart.x + ox]).toBe(h0);
      }
    }
  });
});

describe("mission footprints", () => {
  it("starting buildings do not overlap", () => {
    const s = createMission({ seed: 0, missionIndex: 0 });
    const buildings = s.entities.filter((e) => e.class === "building" && e.hp > 0);
    for (const b of buildings) {
      const fp = footprintOf(b.kind as BuildingKind);
      for (let oy = 0; oy < fp.h; oy++) {
        for (let ox = 0; ox < fp.w; ox++) {
          const hit = buildingAt(s, b.x + ox, b.y + oy);
          expect(hit?.id).toBe(b.id);
        }
      }
    }
  });
});
