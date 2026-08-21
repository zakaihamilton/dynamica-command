import { afterEach, describe, expect, it } from "vitest";
import {
  composeMusic,
  midiToHz,
  MUSIC_BARS,
  MUSIC_STEPS,
  TUTORIAL_MUSIC_MISSION,
} from "../lib/audio/compose";
import { isMusicEnabled, musicCueFromPath, setMusicEnabled, setMusicIntensity } from "../lib/audio/music";
import { beep, isSfxEnabled, playSfx, setSfxEnabled } from "../lib/audio/synth";
import { spatialAudioForWorld } from "../lib/audio/spatial";
import { createCamera } from "../lib/render/iso";

describe("generated audio", () => {
  afterEach(() => {
    setSfxEnabled(true);
    setMusicEnabled(true);
  });

  it("composes the same pattern for the same seed, cue, and mission", () => {
    expect(composeMusic(421, "mission", 3)).toEqual(composeMusic(421, "mission", 3));
    expect(composeMusic(421, "menu")).not.toEqual(composeMusic(421, "mission"));
    expect(composeMusic(1, "mission")).not.toEqual(composeMusic(2, "mission"));
  });

  it("varies the arrangement across missions of the same seed", () => {
    expect(composeMusic(421, "mission", 0)).not.toEqual(composeMusic(421, "mission", 1));
    expect(composeMusic(421, "mission", 0)).not.toEqual(composeMusic(421, "mission", 7));
    expect(composeMusic(421, "mission", 0)).not.toEqual(composeMusic(421, "mission", TUTORIAL_MUSIC_MISSION));
  });

  it("keeps cue tempos in their industrial ranges and fills 16-bar lanes", () => {
    const ranges = {
      menu: [72, 88],
      briefing: [64, 80],
      mission: [96, 118],
      victory: [100, 120],
      defeat: [56, 70],
    } as const;
    for (const seed of [0, 1, 421, 9999]) {
      for (const [cue, [lo, hi]] of Object.entries(ranges)) {
        const pattern = composeMusic(seed, cue as keyof typeof ranges, cue === "mission" ? 3 : 0);
        expect(pattern.bpm).toBeGreaterThanOrEqual(lo);
        expect(pattern.bpm).toBeLessThanOrEqual(hi);
        expect(pattern.bars).toBe(MUSIC_BARS);
        expect(pattern.steps).toBe(MUSIC_STEPS);
        expect(pattern.bass).toHaveLength(MUSIC_STEPS);
        expect(pattern.arp).toHaveLength(MUSIC_STEPS);
        expect(pattern.melody).toHaveLength(MUSIC_STEPS);
        expect(pattern.counter).toHaveLength(MUSIC_STEPS);
        expect(pattern.kick).toHaveLength(MUSIC_STEPS);
        expect(pattern.snare).toHaveLength(MUSIC_STEPS);
        expect(pattern.hats).toHaveLength(MUSIC_STEPS);
        expect(pattern.openHats).toHaveLength(MUSIC_STEPS);
        expect(pattern.padRoot).toHaveLength(MUSIC_BARS);
        expect(pattern.padFifth).toHaveLength(MUSIC_BARS);
        expect(pattern.bass.some((note) => note !== null)).toBe(true);
        expect(pattern.kick.some(Boolean)).toBe(true);
        expect(pattern.snare.some(Boolean)).toBe(true);
        const melodyHits = pattern.melody.filter((note) => note !== null).length;
        expect(melodyHits).toBeGreaterThan(0);
        expect(melodyHits).toBeLessThan(MUSIC_STEPS / 2);
        expect(pattern.rootHz).toBeGreaterThan(midiToHz(30));
      }
    }
  });

  it("maps routes onto music cues", () => {
    expect(musicCueFromPath("/")).toBeNull();
    expect(musicCueFromPath("/briefing")).toBe("briefing");
    expect(musicCueFromPath("/play")).toBe("mission");
    expect(musicCueFromPath("/tutorial")).toBe("mission");
    expect(musicCueFromPath("/campaign-complete")).toBe("victory");
  });

  it("skips synthesized cues when sound effects are disabled", () => {
    setSfxEnabled(false);
    expect(isSfxEnabled()).toBe(false);
    expect(() => beep("select")).not.toThrow();
    setSfxEnabled(true);
    expect(isSfxEnabled()).toBe(true);
  });

  it("exposes semantic layered cues without requiring an audio device", () => {
    expect(() => {
      playSfx("uiConfirm");
      playSfx("smallArms", { pan: -0.8 });
      playSfx("cannon", { pan: 0.8 });
      playSfx("destruction");
      setMusicIntensity("critical");
    }).not.toThrow();
  });

  it("maps world positions to bounded stereo placement and audible range", () => {
    const camera = createCamera();
    camera.x = 400;
    camera.y = 80;
    expect(spatialAudioForWorld(0, 0, camera, 800, 500).pan).toBeLessThanOrEqual(0.85);
    expect(spatialAudioForWorld(0, 0, camera, 800, 500).pan).toBeGreaterThanOrEqual(-0.85);
    expect(spatialAudioForWorld(6, 6, camera, 800, 500).audible).toBe(true);
  });

  it("tracks the music enable flag without requiring an audio device", () => {
    setMusicEnabled(false);
    expect(isMusicEnabled()).toBe(false);
    setMusicEnabled(true);
    expect(isMusicEnabled()).toBe(true);
  });
});
