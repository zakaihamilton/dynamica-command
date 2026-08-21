import { describe, expect, it } from "vitest";
import { burstsFromDestroyed, cullFx, fxAlive, fxProgress, FX_DURATION, type FxBurst } from "../lib/render/fx";
import { addBuilding, addUnit, makeFixture } from "../lib/sim/fixtures";

function burst(partial: Partial<FxBurst> & Pick<FxBurst, "kind">): FxBurst {
  return {
    id: 1,
    x: 2,
    y: 3,
    elev: 1,
    bornMs: 1000,
    durationMs: FX_DURATION[partial.kind],
    entityKind: "tank",
    entityClass: "unit",
    owner: 0,
    ...partial,
  };
}

describe("combat fx bursts", () => {
  it("reports progress and expiry from birth time", () => {
    const explosion = burst({ kind: "explosion", bornMs: 0, durationMs: 100 });
    expect(fxProgress(explosion, 0)).toBe(0);
    expect(fxProgress(explosion, 50)).toBe(0.5);
    expect(fxProgress(explosion, 100)).toBe(1);
    expect(fxAlive(explosion, 99)).toBe(true);
    expect(fxAlive(explosion, 100)).toBe(false);
  });

  it("culls expired bursts and caps the live list", () => {
    const live = burst({ id: 2, kind: "rubble", bornMs: 900 });
    const dead = burst({ id: 1, kind: "explosion", bornMs: 0, durationMs: 10 });
    expect(cullFx([dead, live], 1000).map((item) => item.id)).toEqual([2]);
    const many = Array.from({ length: 70 }, (_, i) => burst({ id: i, kind: "impact", bornMs: 990, durationMs: 200 }));
    expect(cullFx(many, 1000)).toHaveLength(64);
  });

  it("spawns explosions for units and rubble for buildings", () => {
    const state = makeFixture({ win: { kind: "annihilate" } });
    const tank = addUnit(state, 1, "tank", 4, 5);
    const yard = addBuilding(state, 1, "constructionYard", 6, 6);
    tank.hp = 0;
    yard.hp = 0;
    const { bursts, nextId } = burstsFromDestroyed(
      [
        { type: "destroyed", id: tank.id, kind: "tank", x: tank.x, y: tank.y },
        { type: "destroyed", id: yard.id, kind: "constructionYard", x: yard.x, y: yard.y },
      ],
      state,
      500,
      10,
    );
    expect(nextId).toBeGreaterThan(10);
    expect(bursts.some((item) => item.kind === "explosion" && item.entityKind === "tank")).toBe(true);
    expect(bursts.some((item) => item.kind === "rubble" && item.entityKind === "constructionYard")).toBe(true);
    expect(bursts.filter((item) => item.entityKind === "tank" && item.kind === "rubble")).toHaveLength(0);
    expect(bursts.find((item) => item.entityKind === "tank")?.x).toBe(4);
    expect(bursts.find((item) => item.entityKind === "constructionYard")?.y).toBe(6);
  });
});
