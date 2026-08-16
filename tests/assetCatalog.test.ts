import { describe, expect, it } from "vitest";
import { BUILDING_KINDS, UNIT_KINDS } from "../lib/catalog";
import { listGeneratedAssets } from "../lib/gen/assetCatalog";
import { BIOMES } from "../lib/gen/names";

describe("generated asset catalog", () => {
  it("lists every unit, building, tile, wreck, and rubble", () => {
    const assets = listGeneratedAssets();
    expect(assets.filter((a) => a.category === "unit")).toHaveLength(UNIT_KINDS.length);
    expect(assets.filter((a) => a.category === "building")).toHaveLength(BUILDING_KINDS.length);
    expect(assets.filter((a) => a.category === "tile")).toHaveLength(BIOMES.length * 4);
    expect(assets.filter((a) => a.category === "wreck")).toHaveLength(UNIT_KINDS.length);
    expect(assets.filter((a) => a.category === "rubble")).toHaveLength(BUILDING_KINDS.length);
    expect(new Set(assets.map((a) => a.id)).size).toBe(assets.length);
  });
});
