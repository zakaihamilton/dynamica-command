import { mixSeed } from "../seed/rng";
import type { BuildingKind, SimState, UnitKind, WinCategory } from "../types";
import { TILE_CLEAR, TILE_RESOURCE, TILE_WATER } from "../types";
import { emptyRoleCounts, spawnBuilding, spawnUnit } from "./world";

export type FixtureOpts = {
  width?: number;
  height?: number;
  win: WinCategory;
  seed?: number;
};

export function makeFixture(opts: FixtureOpts): SimState {
  const width = opts.width ?? 12;
  const height = opts.height ?? 12;
  const tiles = new Array(width * height).fill(TILE_CLEAR);
  const resourceAmount = new Array(width * height).fill(0);
  const state: SimState = {
    seed: opts.seed ?? 0,
    missionIndex: 0,
    tick: 0,
    width,
    height,
    tiles,
    resourceAmount,
    fog: new Array(width * height).fill(2),
    entities: [],
    nextId: 1,
    credits: [5000, 2000],
    creditsEarned: [0, 0],
    unitsProduced: [0, 0],
    unitsProducedByRole: emptyRoleCounts(),
    buildingsCompleted: [0, 0],
    buildingsCompletedByKind: {},
    win: { ...opts.win },
    result: "playing",
    rngState: mixSeed(opts.seed ?? 0, "fixture") || 1,
    factions: [
      {
        id: 0,
        name: "TestA",
        adjective: "test",
        palette: {
          primary: "#4a7",
          secondary: "#253",
          accent: "#fd0",
          outline: "#111",
          light: "#8c8",
          dark: "#131",
        },
      },
      {
        id: 1,
        name: "TestB",
        adjective: "foe",
        palette: {
          primary: "#a45",
          secondary: "#412",
          accent: "#f80",
          outline: "#111",
          light: "#c88",
          dark: "#311",
        },
      },
    ],
    missionName: "Fixture",
  };
  return state;
}

export function setTile(state: SimState, x: number, y: number, kind: number, amount = 0): void {
  const i = y * state.width + x;
  state.tiles[i] = kind;
  state.resourceAmount[i] = amount;
}

export function addUnit(state: SimState, owner: 0 | 1, kind: UnitKind, x: number, y: number) {
  return spawnUnit(state, owner, kind, x, y);
}

export function addBuilding(
  state: SimState,
  owner: 0 | 1,
  kind: BuildingKind,
  x: number,
  y: number,
  constructing = 0,
  marked = false,
) {
  return spawnBuilding(state, owner, kind, x, y, constructing, marked);
}

export { TILE_CLEAR, TILE_RESOURCE, TILE_WATER };
