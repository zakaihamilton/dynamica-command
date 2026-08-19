import { beforeEach, describe, expect, it } from "vitest";
import { createMission } from "../lib/sim/api";
import {
  computeUnitDynamicTransform,
  resetUnitTransformTracker,
  updateUnitHistory,
} from "../lib/render/gl/unitTransformTracker";

describe("unitTransformTracker sub-tick interpolation and dynamics", () => {
  beforeEach(() => {
    resetUnitTransformTracker();
  });
  it("interpolates unit position smoothly with subTickAlpha", () => {
    const state = createMission({ seed: 101, missionIndex: 0 });
    const unit = state.entities.find((e) => e.class === "unit");
    if (!unit) throw new Error("Expected at least one unit in mission");

    updateUnitHistory(state, 1000);

    // Simulate unit stepping to next tile on new tick
    state.tick += 1;
    unit.x += 1;
    unit.y += 0;
    updateUnitHistory(state, 1083);

    // subTickAlpha at 0.5 should be exactly halfway
    const mid = computeUnitDynamicTransform(unit, state, 0.5, 1041);
    expect(mid.x).toBeCloseTo(unit.x - 0.5, 2);

    // subTickAlpha at 1.0 should be at current position
    const end = computeUnitDynamicTransform(unit, state, 1.0, 1083);
    expect(end.x).toBeCloseTo(unit.x, 2);
  });

  it("calculates terrain pitch and roll smoothly", () => {
    const state = createMission({ seed: 101, missionIndex: 0 });
    const unit = state.entities.find((e) => e.class === "unit");
    if (!unit) throw new Error("Expected unit in mission");

    updateUnitHistory(state, 1000);
    const dyn = computeUnitDynamicTransform(unit, state, 0, 1000);

    expect(typeof dyn.pitch).toBe("number");
    expect(typeof dyn.roll).toBe("number");
    expect(typeof dyn.yaw).toBe("number");
    expect(isNaN(dyn.pitch)).toBe(false);
    expect(isNaN(dyn.roll)).toBe(false);
  });

  it("tracks target turret yaw independently from chassis", () => {
    const state = createMission({ seed: 101, missionIndex: 0 });
    const unit = state.entities.find((e) => e.class === "unit");
    if (!unit) throw new Error("Expected unit");

    unit.kind = "tank";
    const target = {
      id: 9999,
      owner: (unit.owner === 0 ? 1 : 0) as 0 | 1,
      class: "unit" as const,
      kind: "tank" as const,
      x: unit.x + 5,
      y: unit.y + 5,
      hp: 100,
      maxHp: 100,
      cooldown: 0,
      path: [],
      carry: 0,
      constructing: 0,
      queue: [],
      marked: false,
      idle: true,
    };
    state.entities.push(target);
    unit.attackTarget = target.id;

    updateUnitHistory(state, 1000);
    // Allow turret rotation to converge over a few frames
    computeUnitDynamicTransform(unit, state, 0, 1050);
    computeUnitDynamicTransform(unit, state, 0, 1100);
    const dyn = computeUnitDynamicTransform(unit, state, 0, 1200);

    // Expected angle towards (unit.x + 5, unit.y + 5) is Math.atan2(5, 5) - Math.PI / 4 = 0
    expect(dyn.turretYaw).toBeCloseTo(0, 1);
  });

  it("animates leg angles during movement", () => {
    const state = createMission({ seed: 101, missionIndex: 0 });
    const unit = state.entities.find((e) => e.class === "unit");
    if (!unit) throw new Error("Expected unit");

    unit.kind = "infantry";
    unit.path = [{ x: unit.x + 10, y: unit.y }];

    updateUnitHistory(state, 1000);
    const step1 = computeUnitDynamicTransform(unit, state, 0.5, 1100);
    const step2 = computeUnitDynamicTransform(unit, state, 0.5, 1200);

    expect(step1.legLAngle).not.toBe(0);
    expect(step1.legLAngle).toBeCloseTo(-step1.legRAngle, 3);
    expect(step1.legLAngle).not.toBe(step2.legLAngle);
  });
});
