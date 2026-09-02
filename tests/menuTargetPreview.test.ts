import { describe, expect, it } from "vitest";
import {
  PREVIEW_CYCLE_MS,
  PREVIEW_IDLE_MS,
  PREVIEW_LOCK_COUNT,
  PREVIEW_PLAY_MS,
  previewAt,
} from "../components/menu/menuBackdropSim/cycle";
import { CINEMA_SHOTS, cinemaShotCamera, PREVIEW_SHOT_COUNT } from "../components/menu/menuBackdropSim/shots";
import { stepCinemaScene } from "../components/menu/menuBackdropSim/render";
import { createCinemaScene } from "../components/menu/menuBackdropSim/scene";

describe("welcome target preview cycle", () => {
  it("expands for 5 seconds then idles for 3", () => {
    expect(PREVIEW_PLAY_MS).toBe(5000);
    expect(PREVIEW_IDLE_MS).toBe(3000);
    expect(previewAt(0)).toEqual({ expanded: true, lockIndex: 0, shotIndex: 0 });
    expect(previewAt(PREVIEW_PLAY_MS - 1)).toMatchObject({ expanded: true, lockIndex: 0, shotIndex: 0 });
    expect(previewAt(PREVIEW_PLAY_MS)).toMatchObject({ expanded: false, lockIndex: 0, shotIndex: 0 });
    expect(previewAt(PREVIEW_CYCLE_MS - 1)).toMatchObject({ expanded: false, lockIndex: 0 });
    expect(previewAt(PREVIEW_CYCLE_MS)).toEqual({ expanded: true, lockIndex: 1, shotIndex: 1 });
  });

  it("round-robins locks and advances to a different shot each play window", () => {
    const first = previewAt(0);
    const second = previewAt(PREVIEW_CYCLE_MS);
    const third = previewAt(PREVIEW_CYCLE_MS * 2);
    expect(first.lockIndex).toBe(0);
    expect(second.lockIndex).toBe(1);
    expect(third.lockIndex).toBe(2);
    expect(new Set([first.shotIndex, second.shotIndex, third.shotIndex]).size).toBe(3);
    expect(previewAt(PREVIEW_CYCLE_MS * PREVIEW_LOCK_COUNT).lockIndex).toBe(0);
    expect(previewAt(PREVIEW_CYCLE_MS * PREVIEW_SHOT_COUNT).shotIndex).toBe(0);
  });

  it("treats negative time as the opening play window", () => {
    expect(previewAt(-40)).toEqual(previewAt(0));
  });
});

describe("welcome target cinema shots", () => {
  it("keeps a playlist of distinct camera subjects", () => {
    expect(CINEMA_SHOTS.length).toBe(PREVIEW_SHOT_COUNT);
    expect(PREVIEW_SHOT_COUNT).toBeGreaterThanOrEqual(4);
    const keys = CINEMA_SHOTS.map((shot) => `${shot.type}:${shot.index}`);
    expect(new Set(keys).size).toBe(CINEMA_SHOTS.length);
  });

  it("frames different shots at different camera origins", () => {
    const scene = createCinemaScene();
    const cameras = CINEMA_SHOTS.map((_, index) => cinemaShotCamera(scene, index, 240, 152, 0));
    const origins = new Set(cameras.map((cam) => `${cam.x.toFixed(1)},${cam.y.toFixed(1)}`));
    expect(origins.size).toBe(CINEMA_SHOTS.length);
    expect(cameras.every((cam) => cam.zoom === cameras[0]!.zoom)).toBe(true);
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
});
