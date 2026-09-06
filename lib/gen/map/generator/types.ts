import type { BiomeName, SurfaceKind, Vec2 } from "../../../types";

export type MapAffordances = {
  routeLengths: number[];
  baselineRouteLength: number;
  alternateRouteLength: number;
  reachableResourceValue: number;
  nearestResourceDistance: number;
  laneCount: number;
};

export type GeneratedMap = {
  width: number;
  height: number;
  tiles: number[];
  heights: number[];
  surfaces: SurfaceKind[];
  biome: BiomeName;
  resourceAmount: number[];
  playerStart: Vec2;
  enemyStart: Vec2;
  markedSpots: Vec2[];
  affordances: MapAffordances;
};

export type MapCorner = "bottomRight" | "bottomLeft" | "topRight";
