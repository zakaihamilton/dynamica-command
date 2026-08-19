import { describe, expect, it } from "vitest";
import { BUILDING_KINDS, UNIT_KINDS } from "../lib/catalog";
import { listGeneratedAssets } from "../lib/gen/assetCatalog";

describe("generated asset catalog", () => {
  it("lists live units, buildings, wrecks, and rubble", () => {
    const assets = listGeneratedAssets();
    expect(assets.filter((a) => a.category === "unit")).toHaveLength(UNIT_KINDS.length);
    expect(assets.filter((a) => a.category === "building")).toHaveLength(BUILDING_KINDS.length);
    expect(assets.filter((a) => a.category === "wreck")).toHaveLength(UNIT_KINDS.length);
    expect(assets.filter((a) => a.category === "rubble")).toHaveLength(BUILDING_KINDS.length);
    expect(assets.some((a) => a.id.startsWith("tile:"))).toBe(false);
    expect(new Set(assets.map((a) => a.id)).size).toBe(assets.length);
  });
});
