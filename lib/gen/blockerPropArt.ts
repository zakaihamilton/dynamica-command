import type { BiomeName } from "../types";
import type { BlockerPropKind } from "./terrainDecorKinds";
import {
  type BlockerTone,
  type PropPrim,
  boulderPrims,
  crystalPrims,
  deadShrubPrims,
  deadTreePrims,
  lushBiome,
  pinePrims,
  sandstonePrims,
  spirePrims,
  treePrims,
  wreckagePrims,
} from "./blockerProps";

export function blockerPropPrims(
  kind: BlockerPropKind,
  v: number,
  tone: BlockerTone,
  biome: BiomeName,
): PropPrim[] {
  const lush = lushBiome(biome);
  switch (kind) {
    case "tree":
      return treePrims(v, tone, biome);
    case "pine":
      return pinePrims(v, tone, biome === "tundra grid");
    case "deadTree":
      return deadTreePrims(v, tone);
    case "crystalOutcrop":
      return crystalPrims(v, tone);
    case "wreckage":
      return wreckagePrims(v, tone);
    case "spire":
      return spirePrims(v, tone);
    case "deadShrub":
      return deadShrubPrims(v, tone);
    case "sandstone":
      return sandstonePrims(v, tone);
    case "snowRock":
      return boulderPrims(v, tone, false, true);
    case "boulder":
      return boulderPrims(v, tone, lush, false);
  }
}

export * from "./blockerProps";
