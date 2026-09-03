import { describe, expect, it } from "vitest";
import {
  blockerPropPrims,
  type BlockerTone,
  type PropPrim,
} from "../../lib/gen/blockerPropArt";
import { blockerPropKind } from "../../lib/gen/terrainDecorKinds";

const TONE: BlockerTone = {
  dark: "#1d2420",
  mid: "#4e6354",
  high: "#6f8a62",
  light: "#c8d4c0",
  blocked: "#2a332c",
  ore: "#c4a040",
};

function ofKind<K extends PropPrim["k"]>(prims: PropPrim[], k: K): Array<Extract<PropPrim, { k: K }>> {
  return prims.filter((prim): prim is Extract<PropPrim, { k: K }> => prim.k === k);
}

describe("blocker prop art", () => {
  it("gives every tree variant a trunk and a highlight canopy lobe", () => {
    for (const v of [0, 1, 2, 3, 4, 5]) {
      const prims = blockerPropPrims("tree", v, TONE, "jungle wreckage");
      const ells = ofKind(prims, "ell");
      const canopy = ells.filter((prim) => prim.fill !== "rgba(6,10,12,0.38)");
      expect(ofKind(prims, "curve").length).toBeGreaterThanOrEqual(1);
      expect(canopy.length).toBeGreaterThanOrEqual(6);
      expect(canopy.some((prim) => prim.alpha === 0.55)).toBe(true);
    }
  });

  it("paints pine as an upward trunk plus five needle tiers", () => {
    const prims = blockerPropPrims("pine", 3, TONE, "tundra grid");
    const trunk = ofKind(prims, "line")[0];
    expect(trunk).toBeDefined();
    expect(trunk!.y1).toBeLessThan(trunk!.y0);
    expect(ofKind(prims, "poly").filter((prim) => prim.pts.length === 6).length).toBeGreaterThanOrEqual(5);
  });

  it("keeps tree and pine silhouettes distinct", () => {
    const tree = blockerPropPrims("tree", 3, TONE, "ash plains");
    const pine = blockerPropPrims("pine", 3, TONE, "ash plains");
    expect(tree).not.toEqual(pine);
    expect(ofKind(tree, "ell").length).toBeGreaterThan(ofKind(pine, "ell").length);
    expect(ofKind(pine, "poly").length).toBeGreaterThan(ofKind(tree, "poly").length);
  });

  it("stacks sandstone as at least three band polygons", () => {
    const prims = blockerPropPrims("sandstone", 2, TONE, "glass desert");
    expect(ofKind(prims, "poly").length).toBeGreaterThanOrEqual(4);
  });

  it("stays deterministic for a biome variant", () => {
    const kind = blockerPropKind("volcanic shelf", 4);
    expect(blockerPropPrims(kind, 4, TONE, "volcanic shelf")).toEqual(
      blockerPropPrims(kind, 4, TONE, "volcanic shelf"),
    );
  });
});
