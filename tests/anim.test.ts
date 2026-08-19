import { describe, expect, it } from "vitest";
import {
  animClock,
  animFrame,
  buildingAnim,
  constructionProgress,
  damageFlicker,
  selectionPulse,
  toFacing,
  unitAnim,
  unitPose,
  waterShimmer,
} from "../lib/render/anim";
import { UNIT_STATS } from "../lib/catalog";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";

describe("animation helpers", () => {
  it("maps deltas to eight facings", () => {
    expect(toFacing(1, 0)).toBe(0);
    expect(toFacing(0, 1)).toBe(2);
    expect(toFacing(-1, 0)).toBe(4);
    expect(toFacing(0, -1)).toBe(6);
  });

  it("cycles four frames without leaving the range", () => {
    const seen = new Set<number>();
    for (let t = 0; t < 400; t += 30) {
      const frame = animFrame(t, 90, 4, 3);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(4);
      seen.add(frame);
    }
    expect(seen.size).toBe(4);
  });

  it("picks move, work, attack, and idle poses from entity state", () => {
    const s = makeFixture({ win: { kind: "annihilate" } });
    const infantry = addUnit(s, 0, "infantry", 2, 2);
    expect(unitPose(infantry)).toBe("idle");
    infantry.path = [{ x: 3, y: 2 }];
    expect(unitPose(infantry)).toBe("move");
    expect(unitAnim(infantry, 12).frame).toBeGreaterThanOrEqual(0);

    infantry.path = [];
    infantry.attackTarget = 9;
    expect(unitPose(infantry)).toBe("attack");
    infantry.cooldown = UNIT_STATS.infantry.cooldown;
    expect(unitAnim(infantry, 12).frame).toBe(2);
    expect(unitAnim(infantry, 12).recoil).toBeGreaterThan(0);
    infantry.cooldown = 0;
    expect(unitAnim(infantry, 12).frame).toBe(0);

    const harvester = addUnit(s, 0, "harvester", 4, 4);
    harvester.gatherX = 5;
    harvester.gatherY = 5;
    harvester.carry = 10;
    expect(unitPose(harvester)).toBe("work");
    expect(unitAnim(harvester, 8).bobY).toBe(0);

    const idle = addUnit(s, 0, "tank", 6, 6);
    expect(unitAnim(idle, 12).bobY).toBe(0);
    idle.path = [{ x: 7, y: 6 }];
    infantry.path = [{ x: 3, y: 2 }];
    const infantryMove = new Set([0, 90, 180, 270].map((clock) => unitAnim(infantry, 12, clock).bobY));
    const tankMove = new Set([0, 90, 180, 270].map((clock) => unitAnim(idle, 12, clock).bobY));
    expect(infantryMove.size).toBeGreaterThan(1);
    expect(tankMove.size).toBe(1);
    expect(new Set([0, 90, 180, 270].map((clock) => unitAnim(idle, 12, clock).frame)).size).toBeGreaterThan(1);
  });

  it("derives building activity from construction and production", () => {
    const s = makeFixture({ win: { kind: "annihilate" } });
    const barracks = addBuilding(s, 0, "barracks", 2, 2, 80);
    expect(constructionProgress(barracks)).toBeGreaterThan(0);
    expect(constructionProgress(barracks)).toBeLessThan(1);
    const constructing = buildingAnim(barracks, 20);
    expect(constructing.constructing).toBe(true);
    expect(constructing.spark).toBeGreaterThan(0);

    barracks.constructing = 0;
    barracks.producing = { kind: "infantry", remaining: 40 };
    const producing = buildingAnim(barracks, 40);
    expect(producing.producing).toBe(true);
    expect(producing.doorOpen).toBeTypeOf("boolean");

    barracks.producing = undefined;
    barracks.hp = barracks.maxHp * 0.5;
    barracks.repairing = true;
    const repairing = buildingAnim(barracks, 20);
    expect(repairing.repairing).toBe(true);
    expect(repairing.spark).toBeGreaterThan(0);
  });

  it("keeps overlay helpers in range", () => {
    expect(animClock(12)).toBe(12 * (1000 / 12));
    expect(animClock(12, 500)).toBe(500);
    const shimmer = waterShimmer(1200, 3, 8);
    expect(shimmer.alpha).toBeGreaterThan(0);
    expect(shimmer.alpha).toBeLessThan(1);
    expect(selectionPulse(800)).toBeGreaterThan(0);
    expect(damageFlicker(400, 2, 0)).toBe(1);
    expect(damageFlicker(400, 2, 2)).toBeLessThan(1);
  });
});
