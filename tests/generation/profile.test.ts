import { describe, expect, it } from "vitest";
import { createCampaign } from "../../lib/gen/campaign";
import { generateMap, reachable } from "../../lib/gen/map";
import { missionFamilyFor, missionProfileFor, profileContractFor, resolveMissionProfile } from "../../lib/gen/profile";
import { createMission } from "../../lib/sim/api";
import { scenarioAffordances } from "../../lib/sim/scenarios";
import { NEW_MISSION_KINDS } from "../../lib/catalog";
import { TILE_BLOCKED, TILE_WATER } from "../../lib/types";
import type { MissionKind, MissionProfileVariant } from "../../lib/types";

const FAMILY_CASES: Array<[MissionKind, string]> = [
  ["harvestQuota", "economy"],
  ["forceQuota", "economy"],
  ["structureQuota", "economy"],
  ["destroyMarked", "assault"],
  ["razeAll", "assault"],
  ["decapitate", "assault"],
  ["annihilate", "assault"],
  ["holdTheLine", "defense"],
  ["escort", "operation"],
  ["sabotage", "operation"],
  ["rescue", "operation"],
  ["extraction", "operation"],
];

describe("mission profiles", () => {
  it("maps every mission kind to its intended family", () => {
    for (const [kind, family] of FAMILY_CASES) expect(missionFamilyFor(kind)).toBe(family);
  });

  it("is deterministic and varies profile variants across seeds", () => {
    for (const [kind] of FAMILY_CASES) {
      const first = missionProfileFor(421, 2, kind);
      expect(missionProfileFor(421, 2, kind)).toEqual(first);
      const variants = new Set(Array.from({ length: 64 }, (_, seed) => missionProfileFor(seed, 2, kind).variant));
      expect(variants.size).toBe(2);
    }
  });

  it("varies the enemy base corner while keeping the player in the opposite upper-left theater", () => {
    const corners = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const campaign = createCampaign(seed);
      const mission = campaign.missions[0]!;
      const map = generateMap(seed, mission);
      corners.add(`${map.enemyStart.x > map.width / 2 ? "right" : "left"}-${map.enemyStart.y > map.height / 2 ? "bottom" : "top"}`);
      expect(map.playerStart.x).toBeLessThan(map.width / 2);
      expect(map.playerStart.y).toBeLessThan(map.height / 2);
    }
    expect(corners).toEqual(new Set(["right-bottom", "left-bottom", "right-top"]));
  });

  it("resolves legacy missions without profile data identically", () => {
    const campaign = createCampaign(421);
    for (const mission of campaign.missions) {
      const legacy = { ...mission };
      delete legacy.profile;
      expect(resolveMissionProfile(421, mission.index, mission.win.kind, legacy.profile))
        .toEqual(missionProfileFor(421, mission.index, mission.win.kind));
    }
  });

  it("defines a complete, readable contract for every profile variant", () => {
    const variants: MissionProfileVariant[] = [
      "resourceRace", "forwardIndustry", "surgicalStrike", "siege",
      "concentratedWaves", "crossfire", "directRoute", "contestedRoute",
    ];
    for (const variant of variants) {
      const family = variant === "resourceRace" || variant === "forwardIndustry" ? "economy"
        : variant === "surgicalStrike" || variant === "siege" ? "assault"
          : variant === "concentratedWaves" || variant === "crossfire" ? "defense" : "operation";
      const contract = profileContractFor({ family, variant });
      expect(contract.label).not.toBe("");
      expect(contract.emphasis).not.toBe("");
      expect(contract.openingOrder).not.toBe("");
      expect(contract.fallback).not.toBe("");
      expect(contract.routeHint).not.toBe("");
      expect(contract.reinforcements.length).toBeGreaterThan(0);
      expect(contract.reinforcementLimit).toBeGreaterThan(0);
      expect(contract.maxRecoveryDelay).toBe(180);
      expect(contract.finaleRatio).toBeGreaterThan(0.6);
      expect(contract.finaleRatio).toBeLessThan(0.9);
    }
  });

  it("exposes stable profiles and family-specific briefing hooks", () => {
    for (const seed of [0, 42, 421, 9999]) {
      const campaign = createCampaign(seed);
      expect(campaign.missions).toHaveLength(8);
      expect(campaign.missions.every((mission) => mission.profile)).toBe(true);
      const kinds = campaign.missions.map((mission) => mission.win.kind);
      const specialKinds = kinds.filter((kind) => NEW_MISSION_KINDS.includes(kind));
      expect(specialKinds).toHaveLength(4);
      expect(new Set(specialKinds)).toEqual(new Set(NEW_MISSION_KINDS));
      expect(kinds.filter((kind) => !NEW_MISSION_KINDS.includes(kind))).toHaveLength(4);

      const briefingLines = campaign.missions.flatMap((mission) => mission.briefing.map((line) => line.text));
      expect(new Set(briefingLines).size).toBe(briefingLines.length);
      for (const mission of campaign.missions) {
        const variant = mission.profile!.variant;
        const text = mission.briefing.map((line) => line.text).join(" ");
        const hook = variant === "resourceRace" ? /ore|harvest/i
          : variant === "forwardIndustry" ? /industry|refinery|power/i
            : variant === "surgicalStrike" ? /breach|precision/i
              : variant === "siege" ? /siege|layered|approach/i
                : variant === "concentratedWaves" ? /one line|concentrating/i
                  : variant === "crossfire" ? /two approach|split|flank/i
                    : variant === "directRoute" ? /shortest route|direct route/i
                      : /exposed|flanks|screen/i;
        expect(text).toMatch(hook);
      }
    }
  });

  it("keeps generated maps valid for every profile variant", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 32; seed++) {
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
    expect(seen).toEqual(new Set([
      "resourceRace", "forwardIndustry", "surgicalStrike", "siege",
      "concentratedWaves", "crossfire", "directRoute", "contestedRoute",
    ]));
  });
});
