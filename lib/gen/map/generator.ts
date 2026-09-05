import { createRng, type Rng } from "../../seed/rng";
import {
  SURFACE_CONCRETE,
  SURFACE_NONE,
  TILE_BLOCKED,
  TILE_CLEAR,
  TILE_RESOURCE,
  TILE_WATER,
  type BiomeName,
  type MissionDef,
  type SurfaceKind,
  type Vec2,
} from "../../types";
import { biomeTuning } from "./config";
import { terrainFeatureAt, type TerrainFeatureSample } from "./features";
import { resolveMissionProfile } from "../profile";
import { fbm, warpedFbm, mixSalt } from "./noise";
import {
  idx,
  inBounds,
  meanderingRoute,
  carveRoute,
  neighbors8,
  paintBase,
  smoothWater,
  pruneWaterIslands,
  relaxHeights,
} from "./terrain";

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

type MapCorner = "bottomRight" | "bottomLeft" | "topRight";

function startPointForCorner(
  corner: MapCorner,
  width: number,
  height: number,
  xInset: number,
  yInset: number,
): Vec2 {
  return {
    x: corner === "bottomLeft" ? xInset : width - 1 - xInset,
    y: corner === "topRight" ? yInset : height - 1 - yInset,
  };
}

function clampPoint(point: Vec2, width: number, height: number): Vec2 {
  return {
    x: Math.max(3, Math.min(width - 4, Math.round(point.x))),
    y: Math.max(3, Math.min(height - 4, Math.round(point.y))),
  };
}

function walkDistances(tiles: number[], heights: number[], width: number, height: number, start: Vec2): Int32Array {
  const distances = new Int32Array(width * height);
  distances.fill(-1);
  if (!inBounds(start.x, start.y, width, height)) return distances;
  const queue: Vec2[] = [{ x: Math.round(start.x), y: Math.round(start.y) }];
  distances[idx(queue[0]!.x, queue[0]!.y, width)] = 0;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    const currentDistance = distances[idx(current.x, current.y, width)]!;
    for (const next of neighbors8(current.x, current.y)) {
      if (!inBounds(next.x, next.y, width, height)) continue;
      const nextIndex = idx(next.x, next.y, width);
      if (distances[nextIndex] >= 0 || tiles[nextIndex] === TILE_WATER || tiles[nextIndex] === TILE_BLOCKED) continue;
      if (Math.abs((heights[nextIndex] ?? 1) - (heights[idx(current.x, current.y, width)] ?? 1)) > 1) continue;
      if (next.x !== current.x && next.y !== current.y) {
        const sideA = idx(next.x, current.y, width);
        const sideB = idx(current.x, next.y, width);
        if (tiles[sideA] === TILE_WATER || tiles[sideA] === TILE_BLOCKED || tiles[sideB] === TILE_WATER || tiles[sideB] === TILE_BLOCKED) continue;
      }
      distances[nextIndex] = currentDistance + 1;
      queue.push(next);
    }
  }
  return distances;
}

function routeLength(
  points: Vec2[],
): number {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;
    length += Math.hypot(to.x - from.x, to.y - from.y);
  }
  return Math.round(length);
}

function routeReachable(distances: Int32Array, width: number, points: Vec2[]): boolean {
  return points.every((point) => distances[idx(Math.round(point.x), Math.round(point.y), width)] >= 0);
}

export function mapSizeForMission(index: number): number {
  if (index <= 1) return 48;
  if (index <= 4) return 72;
  return 96;
}

function resourcePatch(
  tiles: number[],
  resourceAmount: number[],
  surfaces: SurfaceKind[],
  w: number,
  h: number,
  center: Vec2,
  radius: number,
  rng: Rng,
): void {
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (!inBounds(x, y, w, h)) continue;
      if (Math.hypot(x - center.x, y - center.y) > radius + rng.next() * 0.35) continue;
      const i = idx(x, y, w);
      if (tiles[i] !== TILE_CLEAR || surfaces[i] === SURFACE_CONCRETE) continue;
      tiles[i] = TILE_RESOURCE;
      surfaces[i] = SURFACE_NONE;
      resourceAmount[i] = 480 + rng.int(421);
    }
  }
}

function resourceCenterNear(
  tiles: number[],
  surfaces: SurfaceKind[],
  distances: Int32Array,
  width: number,
  height: number,
  origin: Vec2,
  preferred: Vec2,
): Vec2 {
  let best: Vec2 | undefined;
  let bestDistance = Infinity;
  for (let y = Math.max(0, origin.y - 12); y <= Math.min(height - 1, origin.y + 12); y++) {
    for (let x = Math.max(0, origin.x - 12); x <= Math.min(width - 1, origin.x + 12); x++) {
      const distanceFromOrigin = Math.hypot(x - origin.x, y - origin.y);
      if (distanceFromOrigin < 7 || distanceFromOrigin > 12) continue;
      const i = idx(x, y, width);
      if (distances[i] < 0 || distances[i] > 28 || tiles[i] !== TILE_CLEAR || surfaces[i] === SURFACE_CONCRETE) continue;
      const distanceFromPreferred = Math.hypot(x - preferred.x, y - preferred.y);
      if (distanceFromPreferred < bestDistance) {
        bestDistance = distanceFromPreferred;
        best = { x, y };
      }
    }
  }
  return best ?? preferred;
}

export function generateMap(
  seed: number,
  mission: Pick<MissionDef, "index" | "win" | "mapSize" | "biome" | "profile">,
): GeneratedMap {
  const rng = createRng(seed, `map:${mission.index}`);
  const profile = resolveMissionProfile(seed, mission.index, mission.win.kind, mission.profile);
  const biome = mission.biome;
  const tuning = biomeTuning(biome);
  const width = mission.mapSize;
  const height = mission.mapSize;
  const tiles = new Array<number>(width * height).fill(TILE_CLEAR);
  const heights = new Array<number>(width * height).fill(1);
  const surfaces = new Array<SurfaceKind>(width * height).fill(SURFACE_NONE);
  const resourceAmount = new Array<number>(width * height).fill(0);
  const cornerRng = createRng(seed, `map-corner:${mission.index}`);
  const enemyCorner = (["bottomRight", "bottomLeft", "topRight"] as const)[cornerRng.int(3)]!;
  const salt = mixSalt(rng);
  const terrainFeatures = new Array<TerrainFeatureSample>(width * height);
  const terrainWorld = { seed, missionIndex: mission.index, biome, width, height };

  const playerStart: Vec2 = {
    x: 6 + rng.int(3),
    y: 6 + rng.int(3),
  };
  const enemyStart = startPointForCorner(
    enemyCorner,
    width,
    height,
    8 + rng.int(3),
    8 + rng.int(3),
  );

  const startClear = 8;
  const protectedStart = (x: number, y: number) =>
    Math.hypot(x - playerStart.x, y - playerStart.y) < startClear
    || Math.hypot(x - enemyStart.x, y - enemyStart.y) < startClear;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const feature = terrainFeatureAt(terrainWorld, x, y);
      terrainFeatures[i] = feature;
      if (protectedStart(x, y)) {
        tiles[i] = TILE_CLEAR;
        continue;
      }
      const localWet = warpedFbm(x * 0.72, y * 0.72, salt);
      const basinWet = warpedFbm(x * 0.3, y * 0.3, salt + 13);
      const channel = Math.abs(warpedFbm(x * 0.16, y * 0.16, salt + 37) - 0.5);
      const waterScore = localWet * 0.48 + basinWet * 0.52;
      const basin = waterScore < tuning.water * 0.98 + feature.wetness * 0.045;
      const river = channel < 0.035 + tuning.water * 0.025 + feature.wetness * 0.007 && basinWet < tuning.water + 0.16;
      if (basin || river) tiles[i] = TILE_WATER;
    }
  }
  smoothWater(tiles, width, height, protectedStart);
  pruneWaterIslands(tiles, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const feature = terrainFeatures[i] ?? terrainFeatureAt(terrainWorld, x, y);
      const shore = warpedFbm(x * 0.72, y * 0.72, salt);
      if (tiles[i] === TILE_WATER) {
        heights[i] = 0;
        continue;
      }
      const plateau = warpedFbm(x * 0.38, y * 0.38, salt + 91);
      const ridge = warpedFbm(x * 0.16, y * 0.16, salt + 127);
      const shapedPlateau = plateau + feature.elevation * 0.12;
      const shapedRidge = ridge + feature.elevation * 0.08;
      if (shore < tuning.water + 0.07 + feature.wetness * 0.03) {
        heights[i] = 0;
      } else {
        if (shapedPlateau > tuning.mountain || shapedRidge > 0.69) heights[i] = 3;
        else if (shapedPlateau > tuning.mountain - 0.18 || shapedRidge > 0.59) heights[i] = 2;
        else heights[i] = 1;
      }
      const grove = warpedFbm(x * 0.3, y * 0.3, salt + 211);
      const detail = fbm(x * 1.55, y * 1.55, salt + 223);
      if (grove > tuning.blockers - 0.05 - feature.blockers * 0.045 && detail > 0.5 && heights[i]! < 3 && tiles[i] !== TILE_WATER) {
        tiles[i] = TILE_BLOCKED;
      }
    }
  }
  relaxHeights(heights, tiles, width, height);

  paintBase(tiles, heights, surfaces, width, height, playerStart, startClear);
  paintBase(tiles, heights, surfaces, width, height, enemyStart, startClear);

  const upperRoute = meanderingRoute(playerStart, enemyStart, width, height, salt + 7);
  const lowerRoute = meanderingRoute(playerStart, enemyStart, width, height, salt + 17)
    .map((point, i) => i === 0 || i === 4 ? point : {
      x: Math.max(2, Math.min(width - 3, point.x + Math.round((height * 0.12) * (i % 2 ? -1 : 1)))),
      y: Math.max(2, Math.min(height - 3, point.y + Math.round((width * 0.08) * (i % 2 ? 1 : -1)))),
    });
  carveRoute(tiles, heights, surfaces, width, height, upperRoute, 1, salt);
  carveRoute(tiles, heights, surfaces, width, height, lowerRoute, 1, salt + 11);
  const routePlans = [upperRoute, lowerRoute];
  if (mission.index >= 4 || profile.variant === "crossfire") {
    const crossfireRoute = meanderingRoute(playerStart, enemyStart, width, height, salt + 27);
    carveRoute(tiles, heights, surfaces, width, height, crossfireRoute, 1, salt + 23);
    routePlans.push(crossfireRoute);
  }
  // The first pass uses two independently seeded lanes. If terrain smoothing
  // closes either one, a deterministic second pass restores that lane without
  // changing the rest of the map.
  let distances = walkDistances(tiles, heights, width, height, playerStart);
  let routeRepaired = false;
  for (const [index, route] of routePlans.entries()) {
    if (!routeReachable(distances, width, route)) {
      carveRoute(tiles, heights, surfaces, width, height, route, 2, salt + 101 + index, false);
      routeRepaired = true;
    }
  }
  if (routeRepaired) distances = walkDistances(tiles, heights, width, height, playerStart);
  const initialRouteLengths = routePlans.map((route) => routeLength(route));
  const initialBaseline = Math.min(...initialRouteLengths);
  const initialAlternate = Math.max(...initialRouteLengths);
  if (initialBaseline > 0 && initialAlternate > initialBaseline * 1.8) {
    const dx = enemyStart.x - playerStart.x;
    const dy = enemyStart.y - playerStart.y;
    const lineLength = Math.hypot(dx, dy) || 1;
    const offset = Math.round(Math.min(width, height) * 0.06);
    const fallbackRoute: Vec2[] = [
      playerStart,
      {
        x: Math.max(2, Math.min(width - 3, Math.round((playerStart.x + enemyStart.x) / 2 - (dy / lineLength) * offset))),
        y: Math.max(2, Math.min(height - 3, Math.round((playerStart.y + enemyStart.y) / 2 + (dx / lineLength) * offset))),
      },
      enemyStart,
    ];
    carveRoute(tiles, heights, surfaces, width, height, fallbackRoute, 1, salt + 401, false);
    routePlans.push(fallbackRoute);
  }
  if (distances[idx(enemyStart.x, enemyStart.y, width)] < 0) {
    carveRoute(tiles, heights, surfaces, width, height, [playerStart, enemyStart], 2, salt, false);
  }
  pruneWaterIslands(tiles, width, height, heights);

  const towardEnemy = {
    x: Math.sign(enemyStart.x - playerStart.x),
    y: Math.sign(enemyStart.y - playerStart.y),
  };
  const lateral = { x: -towardEnemy.y, y: towardEnemy.x };
  const safeP = clampPoint({
    x: playerStart.x + towardEnemy.x * 8 + lateral.x,
    y: playerStart.y + towardEnemy.y * 8 + lateral.y,
  }, width, height);
  const safeE = clampPoint({
    x: enemyStart.x - towardEnemy.x * 8 + lateral.x,
    y: enemyStart.y - towardEnemy.y * 8 + lateral.y,
  }, width, height);
  const playerResourceCenter = resourceCenterNear(tiles, surfaces, distances, width, height, playerStart, safeP);
  const enemyResourceCenter = resourceCenterNear(tiles, surfaces, distances, width, height, enemyStart, safeE);
  const center = { x: Math.round(width / 2), y: Math.round(height / 2) };
  const resourceRace = profile.variant === "resourceRace";
  const forwardIndustry = profile.variant === "forwardIndustry";
  resourcePatch(tiles, resourceAmount, surfaces, width, height, playerResourceCenter, resourceRace ? 2 : 3, rng);
  resourcePatch(tiles, resourceAmount, surfaces, width, height, enemyResourceCenter, resourceRace ? 2 : 3, rng);
  resourcePatch(
    tiles,
    resourceAmount,
    surfaces,
    width,
    height,
    center,
    3 + (mission.index >= 4 ? 1 : 0) + (forwardIndustry ? 1 : 0),
    rng,
  );

  const extraPatches = 3 + mission.index
    + (mission.win.kind === "harvestQuota" ? 3 : 0)
    + (resourceRace ? 2 : 0)
    - (forwardIndustry ? 1 : 0);
  for (let v = 0; v < extraPatches; v++) {
    for (let tries = 0; tries < 30; tries++) {
      const cx = 4 + rng.int(Math.max(1, width - 8));
      const cy = 4 + rng.int(Math.max(1, height - 8));
      const i = idx(cx, cy, width);
      if (tiles[i] !== TILE_CLEAR || surfaces[i] === SURFACE_CONCRETE) continue;
      if (Math.min(Math.hypot(cx - playerStart.x, cy - playerStart.y), Math.hypot(cx - enemyStart.x, cy - enemyStart.y)) < 9) continue;
      resourcePatch(tiles, resourceAmount, surfaces, width, height, { x: cx, y: cy }, 2 + rng.int(2), rng);
      break;
    }
  }

  const requiredResources = Math.max(
    14_000 + mission.index * 3_000,
    mission.win.kind === "harvestQuota" ? Math.ceil((mission.win.target ?? 0) * 1.5) : 0,
  );
  const resourceTiles = resourceAmount.map((amount, i) => amount > 0 ? i : -1).filter((i) => i >= 0);
  let totalResources = resourceAmount.reduce((sum, amount) => sum + amount, 0);
  for (let i = 0; totalResources < requiredResources && resourceTiles.length; i++) {
    const ri = resourceTiles[i % resourceTiles.length]!;
    const add = Math.min(250, requiredResources - totalResources);
    resourceAmount[ri] = (resourceAmount[ri] ?? 0) + add;
    totalResources += add;
  }

  const markedSpots: Vec2[] = [];
  const markCount =
    mission.win.kind === "destroyMarked" ? mission.win.targetCount ?? 1 : 0;
  const markedDepth = profile.variant === "siege" ? 8 : 6;
  const markedSpacing = profile.variant === "siege" ? 4 : 3;
  const towardPlayer = { x: -towardEnemy.x, y: -towardEnemy.y };
  const targetLateral = { x: -towardPlayer.y, y: towardPlayer.x };
  for (let m = 0; m < markCount; m++) {
    const laneOffset = (m % 2 === 0 ? -1 : 1) * (profile.variant === "siege" ? 3 : 2);
    const spot = clampPoint({
      x: enemyStart.x + towardPlayer.x * (markedDepth + m * markedSpacing) + targetLateral.x * laneOffset,
      y: enemyStart.y + towardPlayer.y * (markedDepth + m * markedSpacing) + targetLateral.y * laneOffset,
    }, width, height);
    paintBase(tiles, heights, surfaces, width, height, spot, 3);
    markedSpots.push(spot);
  }

  distances = walkDistances(tiles, heights, width, height, playerStart);
  const resourceDistances = resourceAmount
    .map((amount, i) => amount > 0 && distances[i] >= 0 ? distances[i] : -1)
    .filter((distance) => distance >= 0);
  const routeLengths = routePlans.map((route) => routeLength(route));
  const sortedRouteLengths = [...routeLengths].sort((a, b) => a - b);
  const affordances: MapAffordances = {
    routeLengths,
    baselineRouteLength: sortedRouteLengths[0] ?? 0,
    alternateRouteLength: sortedRouteLengths[1] ?? sortedRouteLengths[0] ?? 0,
    reachableResourceValue: resourceAmount.reduce((sum, amount, i) => sum + (distances[i] >= 0 ? amount : 0), 0),
    nearestResourceDistance: resourceDistances.length ? Math.min(...resourceDistances) : 0,
    laneCount: routePlans.length,
  };

  return {
    width,
    height,
    tiles,
    heights,
    surfaces,
    biome,
    resourceAmount,
    playerStart,
    enemyStart,
    markedSpots,
    affordances,
  };
}
