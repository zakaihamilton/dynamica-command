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
import { fbm, warpedFbm, mixSalt } from "./noise";
import {
  idx,
  inBounds,
  meanderingRoute,
  carveRoute,
  flattenArea,
  paintBase,
  smoothWater,
  pruneWaterIslands,
  relaxHeights,
  reachable,
} from "./terrain";

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
};

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

export function generateMap(
  seed: number,
  mission: Pick<MissionDef, "index" | "win" | "mapSize" | "biome">,
): GeneratedMap {
  const rng = createRng(seed, `map:${mission.index}`);
  const biome = mission.biome;
  const tuning = biomeTuning(biome);
  const width = mission.mapSize;
  const height = mission.mapSize;
  const tiles = new Array<number>(width * height).fill(TILE_CLEAR);
  const heights = new Array<number>(width * height).fill(1);
  const surfaces = new Array<SurfaceKind>(width * height).fill(SURFACE_NONE);
  const resourceAmount = new Array<number>(width * height).fill(0);
  const salt = mixSalt(rng);

  const playerStart: Vec2 = {
    x: 6 + rng.int(3),
    y: 6 + rng.int(3),
  };
  const enemyStart: Vec2 = {
    x: width - 9 - rng.int(3),
    y: height - 9 - rng.int(3),
  };

  const startClear = 8;
  const protectedStart = (x: number, y: number) =>
    Math.hypot(x - playerStart.x, y - playerStart.y) < startClear
    || Math.hypot(x - enemyStart.x, y - enemyStart.y) < startClear;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (protectedStart(x, y)) {
        tiles[i] = TILE_CLEAR;
        continue;
      }
      const localWet = warpedFbm(x * 0.72, y * 0.72, salt);
      const basinWet = warpedFbm(x * 0.3, y * 0.3, salt + 13);
      const channel = Math.abs(warpedFbm(x * 0.16, y * 0.16, salt + 37) - 0.5);
      const waterScore = localWet * 0.48 + basinWet * 0.52;
      const basin = waterScore < tuning.water * 0.98;
      const river = channel < 0.035 + tuning.water * 0.025 && basinWet < tuning.water + 0.16;
      if (basin || river) tiles[i] = TILE_WATER;
    }
  }
  smoothWater(tiles, width, height, protectedStart);
  pruneWaterIslands(tiles, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const shore = warpedFbm(x * 0.72, y * 0.72, salt);
      if (tiles[i] === TILE_WATER) {
        heights[i] = 0;
        continue;
      }
      const plateau = warpedFbm(x * 0.38, y * 0.38, salt + 91);
      const ridge = warpedFbm(x * 0.16, y * 0.16, salt + 127);
      if (shore < tuning.water + 0.07) {
        heights[i] = 0;
      } else {
        if (plateau > tuning.mountain || ridge > 0.69) heights[i] = 3;
        else if (plateau > tuning.mountain - 0.18 || ridge > 0.59) heights[i] = 2;
        else heights[i] = 1;
      }
      const grove = warpedFbm(x * 0.3, y * 0.3, salt + 211);
      const detail = fbm(x * 1.55, y * 1.55, salt + 223);
      if (grove > tuning.blockers - 0.05 && detail > 0.5 && heights[i]! < 3 && tiles[i] !== TILE_WATER) {
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
  if (mission.index >= 4) {
    carveRoute(tiles, heights, surfaces, width, height, meanderingRoute(playerStart, enemyStart, width, height, salt + 27), 1, salt + 23);
  }
  if (!reachable(tiles, heights, width, height, playerStart, enemyStart)) {
    carveRoute(tiles, heights, surfaces, width, height, [playerStart, enemyStart], 2, salt, false);
  }
  pruneWaterIslands(tiles, width, height, heights);

  const safeP = { x: Math.min(width - 5, playerStart.x + 10), y: Math.min(height - 5, playerStart.y + 4) };
  const safeE = { x: Math.max(4, enemyStart.x - 10), y: Math.max(4, enemyStart.y - 4) };
  const center = { x: Math.round(width / 2), y: Math.round(height / 2) };
  resourcePatch(tiles, resourceAmount, surfaces, width, height, safeP, 3, rng);
  resourcePatch(tiles, resourceAmount, surfaces, width, height, safeE, 3, rng);
  resourcePatch(tiles, resourceAmount, surfaces, width, height, center, 3 + (mission.index >= 4 ? 1 : 0), rng);

  const extraPatches = 3 + mission.index + (mission.win.kind === "harvestQuota" ? 3 : 0);
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
  for (let m = 0; m < markCount; m++) {
    const spot = {
      x: Math.max(2, enemyStart.x - 4 - m * 3),
      y: Math.max(2, enemyStart.y - 6 + (m % 2) * 2),
    };
    paintBase(tiles, heights, surfaces, width, height, spot, 3);
    markedSpots.push(spot);
  }

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
  };
}
