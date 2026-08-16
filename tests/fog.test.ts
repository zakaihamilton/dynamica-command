import { describe, expect, it } from "vitest";
import { MAP_SKIRT } from "../lib/gen/map";
import { expandFog, fogAt, fogGridHeight, fogGridWidth, makeFog, tickFog } from "../lib/sim/fog";
import { addUnit, makeFixture } from "../lib/sim/fixtures";
import { deserializeState, serializeState } from "../lib/persist/save";

describe("out of bounds shroud", () => {
  it("stores fog across the map skirt", () => {
    const s = makeFixture({ width: 10, height: 8, win: { kind: "annihilate" } });
    expect(s.fog).toHaveLength(fogGridWidth(10) * fogGridHeight(8));
    expect(fogAt(s, 0, 0)).toBe(2);
    expect(fogAt(s, -1, 3)).toBe(2);
    expect(fogAt(s, 10 + MAP_SKIRT, 0)).toBe(0);
  });

  it("reveals skirt tiles in sight and shrouds them after vision leaves", () => {
    const s = makeFixture({ width: 12, height: 12, win: { kind: "annihilate" } });
    s.fog = makeFog(12, 12, 0);
    addUnit(s, 0, "infantry", 1, 1);
    tickFog(s);
    expect(fogAt(s, 0, 0)).toBe(2);
    expect(fogAt(s, -2, 1)).toBe(2);
    expect(fogAt(s, -MAP_SKIRT, 1)).toBe(0);

    s.entities[0]!.x = 10;
    s.entities[0]!.y = 10;
    tickFog(s);
    expect(fogAt(s, -2, 1)).toBe(1);
    expect(fogAt(s, 10, 10)).toBe(2);
  });

  it("expands legacy in-map fog onto the skirt", () => {
    const s = makeFixture({ width: 6, height: 6, win: { kind: "annihilate" } });
    const legacy = JSON.parse(serializeState(s)) as { fog: number[]; width: number; height: number };
    legacy.fog = new Array(36).fill(1);
    legacy.fog[0] = 2;
    const loaded = deserializeState(JSON.stringify(legacy));
    expect(loaded.fog).toHaveLength(fogGridWidth(6) * fogGridHeight(6));
    expect(fogAt(loaded, 0, 0)).toBe(2);
    expect(fogAt(loaded, 1, 0)).toBe(1);
    expect(fogAt(loaded, -1, 0)).toBe(0);
    expect(expandFog(legacy.fog, 6, 6)).toHaveLength(loaded.fog.length);
  });
});
