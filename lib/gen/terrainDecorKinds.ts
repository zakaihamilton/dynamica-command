import type { BiomeName } from "../types";

export type BlockerPropKind =
  | "boulder"
  | "tree"
  | "pine"
  | "deadTree"
  | "crystalOutcrop"
  | "wreckage"
  | "spire"
  | "sandstone"
  | "deadShrub"
  | "snowRock";

export function blockerPropKind(biome: BiomeName, variant: number): BlockerPropKind {
  const roll = variant % 8;
  switch (biome) {
    case "jungle wreckage":
      return roll === 0 ? "boulder" : "tree";
    case "salt marshes":
      return roll <= 1 ? "boulder" : "tree";
    case "tundra grid":
      return roll <= 2 ? "snowRock" : "pine";
    case "glass desert":
      return roll <= 3 ? "sandstone" : "deadShrub";
    case "crystal flats":
      return roll <= 1 ? "boulder" : "crystalOutcrop";
    case "rust canyons":
      return roll <= 2 ? "boulder" : "wreckage";
    case "volcanic shelf":
      return roll <= 2 ? "boulder" : "spire";
    default:
      return roll === 0 ? "deadTree" : "boulder";
  }
}
