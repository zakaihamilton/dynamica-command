import { expect } from "vitest";
import { createCampaign } from "../../../lib/gen/campaign";
import { generateMap, reachable } from "../../../lib/gen/map";
import { scenarioAffordances } from "../../../lib/sim/scenarios";
import { createMission } from "../../../lib/sim/api";
import { TILE_BLOCKED, TILE_WATER } from "../../../lib/types";

export function assertProfileMapsValid(startSeed: number, endSeed: number): Set<string> {
  const seen = new Set<string>();
  for (let seed = startSeed; seed < endSeed; seed += 1) {
    const campaign = createCampaign(seed);
    for (const mission of campaign.missions) {
      const map = generateMap(seed, mission);
      seen.add(mission.profile!.variant);
      expect([TILE_WATER, TILE_BLOCKED]).not.toContain(map.tiles[map.playerStart.y * map.width + map.playerStart.x]);
      expect([TILE_WATER, TILE_BLOCKED]).not.toContain(map.tiles[map.enemyStart.y * map.width + map.enemyStart.x]);
      expect(reachable(map.tiles, map.heights, map.width, map.height, map.playerStart, map.enemyStart)).toBe(true);
      expect(map.resourceAmount.reduce((sum, amount) => sum + amount, 0)).toBeGreaterThanOrEqual(4_000);
      expect(map.affordances.laneCount).toBeGreaterThanOrEqual(2);
      expect(map.affordances.routeLengths.every(Number.isFinite)).toBe(true);
      expect(map.affordances.baselineRouteLength).toBeGreaterThan(0);
      expect(map.affordances.alternateRouteLength).toBeGreaterThanOrEqual(map.affordances.baselineRouteLength);
      expect(map.affordances.reachableResourceValue).toBeGreaterThanOrEqual(4_000);
      expect(map.affordances.nearestResourceDistance).toBeLessThan(32);

      const scenario = scenarioAffordances(createMission({ seed, missionIndex: mission.index }));
      expect(scenario.targetReachable).toBe(true);
      expect(scenario.routeLength).toBeGreaterThan(0);
      expect(scenario.targetDepth).toBeGreaterThanOrEqual(0);
      expect(scenario.targetDepth).toBeLessThanOrEqual(1);
    }
  }
  return seen;
}
