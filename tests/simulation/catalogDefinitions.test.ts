import { describe, expect, it } from "vitest";
import {
  BUILDING_DEFINITIONS,
  BUILDING_KINDS,
  BUILDING_STATS,
  UNIT_DEFINITIONS,
  UNIT_KINDS,
  UNIT_STATS,
} from "../../lib/catalog";

describe("authoritative catalogs", () => {
  it("defines every unit with deterministic gameplay and presentation metadata", () => {
    expect(Object.keys(UNIT_DEFINITIONS)).toEqual(UNIT_KINDS);
    for (const kind of UNIT_KINDS) {
      const definition = UNIT_DEFINITIONS[kind];
      expect(definition.label).toBeTruthy();
      expect(definition.renderKey).toBe(kind);
      expect(["economy", "combat", "support", "objective"]).toContain(definition.aiRole);
      expect(definition.hp).toBeGreaterThan(0);
      expect(definition.cost).toBeGreaterThanOrEqual(0);
      expect(definition.buildTicks).toBeGreaterThanOrEqual(0);
      expect(UNIT_STATS[kind]).toBe(definition);
    }
  });

  it("defines every building and retains stats as a compatibility view", () => {
    expect(Object.keys(BUILDING_DEFINITIONS)).toEqual(BUILDING_KINDS);
    for (const kind of BUILDING_KINDS) {
      const definition = BUILDING_DEFINITIONS[kind];
      expect(definition.label).toBeTruthy();
      expect(definition.renderKey).toBe(kind);
      expect(["base", "economy", "production", "defense", "objective"]).toContain(definition.aiRole);
      expect(definition.footprint.w).toBeGreaterThan(0);
      expect(definition.footprint.h).toBeGreaterThan(0);
      expect(definition.requiresFlatGround).toBe(true);
      expect(BUILDING_STATS[kind]).toBe(definition);
    }
  });

  it("is stable across repeated serialization", () => {
    const snapshot = JSON.stringify({ units: UNIT_DEFINITIONS, buildings: BUILDING_DEFINITIONS });
    expect(JSON.stringify({ units: UNIT_DEFINITIONS, buildings: BUILDING_DEFINITIONS })).toBe(snapshot);
  });
});
