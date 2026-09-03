import { describe, expect, it } from "vitest";
import {
  EXCLUDED_SCENARIO_KINDS,
  PREVIEW_CYCLE_MS,
  PREVIEW_IDLE_MS,
  PREVIEW_INITIAL_DELAY_MS,
  PREVIEW_LOCK_COUNT,
  PREVIEW_PLAY_MS,
  normalMissionIndices,
  previewAt,
  previewMissionIndex,
  previewSeed,
} from "../components/menu/menuBackdropSim/cycle";
import { CINEMA_SHOTS, cinemaShotCamera, PIP_ZOOM, PREVIEW_SHOT_COUNT } from "../components/menu/menuBackdropSim/shots";
import { cinemaGroundWorld } from "../components/menu/menuBackdropSim/paint";
import { stepCinemaScene } from "../components/menu/menuBackdropSim/render";
import { CINEMA_SEED, createCinemaScene } from "../components/menu/menuBackdropSim/scene";
import { createCampaign } from "../lib/gen/campaign";
import { createMission } from "../lib/sim/api";

describe("welcome target preview cycle", () => {
  it("waits 5 seconds before showing the first highlight, then plays for 5s and idles for 3s", () => {
    expect(PREVIEW_INITIAL_DELAY_MS).toBe(5000);
    expect(PREVIEW_PLAY_MS).toBe(5000);
    expect(PREVIEW_IDLE_MS).toBe(3000);
    expect(previewAt(0)).toEqual({ expanded: false, lockIndex: 0, shotIndex: 0, cycleIndex: 0, missionIndex: 0 });
    expect(previewAt(PREVIEW_INITIAL_DELAY_MS - 1)).toMatchObject({ expanded: false, lockIndex: 0, cycleIndex: 0 });
    expect(previewAt(PREVIEW_INITIAL_DELAY_MS)).toEqual({ expanded: true, lockIndex: 0, shotIndex: 0, cycleIndex: 0, missionIndex: 0 });
    expect(previewAt(PREVIEW_INITIAL_DELAY_MS + PREVIEW_PLAY_MS - 1)).toMatchObject({ expanded: true, lockIndex: 0, shotIndex: 0, cycleIndex: 0 });
    expect(previewAt(PREVIEW_INITIAL_DELAY_MS + PREVIEW_PLAY_MS)).toMatchObject({ expanded: false, lockIndex: 0, cycleIndex: 0 });
    expect(previewAt(PREVIEW_INITIAL_DELAY_MS + PREVIEW_CYCLE_MS - 1)).toMatchObject({ expanded: false, lockIndex: 0, cycleIndex: 0 });
    expect(previewAt(PREVIEW_INITIAL_DELAY_MS + PREVIEW_CYCLE_MS)).toMatchObject({ expanded: true, lockIndex: 1, shotIndex: 1, cycleIndex: 1 });
  });

  it("round-robins locks and advances to a different shot each play window", () => {
    const first = previewAt(PREVIEW_INITIAL_DELAY_MS);
    const second = previewAt(PREVIEW_INITIAL_DELAY_MS + PREVIEW_CYCLE_MS);
    const third = previewAt(PREVIEW_INITIAL_DELAY_MS + PREVIEW_CYCLE_MS * 2);
    expect(first.lockIndex).toBe(0);
    expect(second.lockIndex).toBe(1);
    expect(third.lockIndex).toBe(2);
    expect(new Set([first.shotIndex, second.shotIndex, third.shotIndex]).size).toBe(3);
    expect(previewAt(PREVIEW_INITIAL_DELAY_MS + PREVIEW_CYCLE_MS * PREVIEW_LOCK_COUNT).lockIndex).toBe(0);
    expect(previewAt(PREVIEW_INITIAL_DELAY_MS + PREVIEW_CYCLE_MS * PREVIEW_SHOT_COUNT).shotIndex).toBe(0);
  });

  it("treats negative time as the opening play window", () => {
    expect(previewAt(-40)).toEqual(previewAt(0));
  });

  it("uses a different theater seed each cycle and wraps the four-digit range", () => {
    expect(previewSeed(0)).toBe(CINEMA_SEED);
    expect(previewSeed(1)).not.toBe(previewSeed(0));
    expect(previewSeed(2)).not.toBe(previewSeed(1));
    expect(previewSeed(0)).toBeGreaterThanOrEqual(0);
    expect(previewSeed(0)).toBeLessThanOrEqual(9999);
    expect(previewSeed(10000)).toBe(previewSeed(0));
  });
});

describe("welcome target cinema shots", () => {
  it("keeps a playlist of distinct camera subjects", () => {
    expect(CINEMA_SHOTS.length).toBe(PREVIEW_SHOT_COUNT);
    expect(PREVIEW_SHOT_COUNT).toBeGreaterThanOrEqual(4);
    const keys = CINEMA_SHOTS.map((shot) => `${shot.type}:${shot.index}`);
    expect(new Set(keys).size).toBe(CINEMA_SHOTS.length);
  });

  it("frames different shots at a mid zoom between the original close-up and the wide crop", () => {
    const scene = createCinemaScene();
    const cameras = CINEMA_SHOTS.map((_, index) => cinemaShotCamera(scene, index, 768, 512, 0));
    const origins = new Set(cameras.map((cam) => `${cam.x.toFixed(1)},${cam.y.toFixed(1)}`));
    expect(origins.size).toBe(CINEMA_SHOTS.length);
    expect(cameras.every((cam) => cam.zoom === PIP_ZOOM)).toBe(true);
    expect(PIP_ZOOM).toBe(1.5);
  });

  it("builds different theaters from different seeds", () => {
    const first = createCinemaScene(previewSeed(0));
    const second = createCinemaScene(previewSeed(1));
    expect(first.seed).not.toBe(second.seed);
    const sameTiles = first.map.tiles.every((tile, index) => tile === second.map.tiles[index]);
    const samePalette = first.us.palette.primary === second.us.palette.primary
      && first.them.palette.primary === second.them.palette.primary;
    expect(sameTiles && first.map.biome === second.map.biome && samePalette).toBe(false);
  });

  it("uses mission 0 biome, size, and tiles for the theater seed", () => {
    const scene = createCinemaScene(previewSeed(0));
    const mission = createMission({ seed: scene.seed, missionIndex: 0 });
    expect(scene.map.biome).toBe(mission.biome);
    expect(scene.map.width).toBe(mission.width);
    expect(scene.map.height).toBe(mission.height);
    expect(scene.map.tiles).toEqual(mission.tiles);
    expect(cinemaGroundWorld(scene)).toBe(scene.ground);
    expect(cinemaGroundWorld(scene).seed).toBe(scene.seed);
  });

  it("steps actors independently of rendering", () => {
    const scene = createCinemaScene();
    const shots: { ax: number; ay: number; bx: number; by: number; life: number }[] = [];
    const before = scene.actors.map((actor) => ({ x: actor.x, y: actor.y, wi: actor.wi }));
    stepCinemaScene(scene, shots, 1);
    const moved = scene.actors.some((actor, index) => actor.x !== before[index]!.x || actor.y !== before[index]!.y);
    expect(moved).toBe(true);
    stepCinemaScene(scene, shots, 48);
    expect(shots.length).toBeGreaterThan(0);
  });

  it("shares the same atlas-compatible ground world used by gameplay", () => {
    const scene = createCinemaScene(previewSeed(0));
    const world = cinemaGroundWorld(scene);
    const mission = createMission({ seed: scene.seed, missionIndex: 0 });
    expect(world).toBe(scene.ground);
    expect(world.seed).toBe(mission.seed);
    expect(world.biome).toBe(mission.biome);
    expect(world.tiles).toEqual(mission.tiles);
    expect(world.surfaces).toEqual(mission.surfaces);
  });

  it("cycles mission index across normal combat missions, excluding scenario kinds", () => {
    const campaign = createCampaign(CINEMA_SEED);
    const normal = normalMissionIndices(CINEMA_SEED);
    expect(normal.length).toBeGreaterThan(0);
    for (const idx of normal) {
      expect(EXCLUDED_SCENARIO_KINDS).not.toContain(campaign.missions[idx]!.win.kind);
    }
    expect(previewMissionIndex(0, CINEMA_SEED)).toBe(normal[0]);
    expect(previewMissionIndex(1, CINEMA_SEED)).toBe(normal[1 % normal.length]);
    expect(previewMissionIndex(normal.length, CINEMA_SEED)).toBe(normal[0]);
  });

  it("clears fog of war and primes frontline combat units in cinema scenes", () => {
    const scene = createCinemaScene(1847, 2);
    expect(scene.missionIndex).toBe(2);
    expect(scene.state).toBeDefined();
    expect(scene.state.fog.every((val) => val === 2)).toBe(true);
    const combatUnits = scene.state.entities.filter((e) => e.class === "unit" && e.hp > 0);
    expect(combatUnits.length).toBeGreaterThanOrEqual(6);
    expect(scene.combatEpicenter).toBeDefined();
  });
});
