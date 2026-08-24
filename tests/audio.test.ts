import { afterEach, describe, expect, it, vi } from "vitest";
import {
  composeMusic,
  midiToHz,
  MUSIC_BARS,
  MUSIC_STEPS,
  STEPS_PER_BAR,
  TUTORIAL_MUSIC_MISSION,
} from "../lib/audio/compose";
import { exportMissionSoundtrack, missionSoundtrackFilename, supportsM4aExport } from "../lib/audio/export";
import { isMusicEnabled, musicCueFromPath, setMusicEnabled, setMusicIntensity } from "../lib/audio/music";
import { beep, isSfxEnabled, playSfx, setSfxEnabled } from "../lib/audio/synth";
import { spatialAudioForWorld } from "../lib/audio/spatial";
import { createCamera } from "../lib/iso";

describe("generated audio", () => {
  afterEach(() => {
    setSfxEnabled(true);
    setMusicEnabled(true);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it("builds a long-form arrangement with contrasting phrases and fills", () => {
    expect(MUSIC_BARS).toBe(64);
    const half = STEPS_PER_BAR * (MUSIC_BARS / 2);
    const fillBars = [7, 15, 23, 31, 39, 47, 55, 63];

    for (const seed of [0, 421, 9999]) {
      const pattern = composeMusic(seed, "mission", 3);
      const firstHalf = [
        pattern.bass.slice(0, half),
        pattern.arp.slice(0, half),
        pattern.melody.slice(0, half),
        pattern.kick.slice(0, half),
        pattern.snare.slice(0, half),
        pattern.padRoot.slice(0, MUSIC_BARS / 2),
      ];
      const secondHalf = [
        pattern.bass.slice(half),
        pattern.arp.slice(half),
        pattern.melody.slice(half),
        pattern.kick.slice(half),
        pattern.snare.slice(half),
        pattern.padRoot.slice(MUSIC_BARS / 2),
      ];

      expect(firstHalf.some((lane, index) => JSON.stringify(lane) !== JSON.stringify(secondHalf[index]))).toBe(true);
      expect(new Set(pattern.padRoot).size).toBeGreaterThan(2);
      for (const bar of fillBars) {
        const start = bar * STEPS_PER_BAR;
        expect(pattern.snare.slice(start, start + STEPS_PER_BAR).filter(Boolean).length).toBeGreaterThan(0);
      }
      const penultimateFill = pattern.snare.slice(55 * STEPS_PER_BAR, 56 * STEPS_PER_BAR).filter(Boolean).length;
      const finalFill = pattern.snare.slice(63 * STEPS_PER_BAR, 64 * STEPS_PER_BAR).filter(Boolean).length;
      expect(finalFill).toBeGreaterThan(penultimateFill);
      expect(pattern.sections.map((section) => section.name)).toEqual([
        "intro", "groove", "hook", "development", "breakdown", "escalation", "climax", "turnaround",
      ]);
      expect(pattern.motif.degrees.length).toBeGreaterThan(4);
      expect(pattern.notes.melody.length).toBeGreaterThan(0);
      expect(pattern.notes.melody.every((note) => note.duration > 0 && note.velocity > 0)).toBe(true);
    }
  });

  it("keeps victory drums active through the breakdown", () => {
    const pattern = composeMusic(421, "victory");
    const breakdownStart = 32 * STEPS_PER_BAR;
    const breakdownEnd = 39 * STEPS_PER_BAR;

    expect(pattern.kick.slice(breakdownStart, breakdownEnd).some(Boolean)).toBe(true);
    expect(pattern.snare.slice(breakdownStart, breakdownEnd).some(Boolean)).toBe(true);
    expect(pattern.hats.slice(breakdownStart, breakdownEnd).some(Boolean)).toBe(true);
  });

  it("keeps cue tempos in upbeat 80s ranges and fills long-form lanes", () => {
    const ranges = {
      menu: [112, 124],
      briefing: [104, 116],
      mission: [118, 128],
      victory: [124, 132],
      defeat: [88, 98],
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
        expect(pattern.padThird).toHaveLength(MUSIC_BARS);
        expect(pattern.padFifth).toHaveLength(MUSIC_BARS);
        expect(pattern.padSeventh).toHaveLength(MUSIC_BARS);
        expect(pattern.bass.some((note) => note !== null)).toBe(true);
        expect(pattern.kick.some(Boolean)).toBe(true);
        expect(pattern.snare.some(Boolean)).toBe(true);
        const melodyHits = pattern.melody.filter((note) => note !== null).length;
        expect(melodyHits).toBeGreaterThan(0);
        expect(melodyHits).toBeLessThan(MUSIC_STEPS / 2);
        expect(pattern.rootHz).toBeGreaterThan(midiToHz(30));
        if (cue === "mission") {
          expect(["pulse", "march"]).toContain(pattern.theme.groove);
          expect(["natural minor", "dorian", "mixolydian", "major"]).toContain(pattern.scaleName);
        }
      }
    }
  });

  it("builds a recurring 80s synth-pop hook with gated drums", () => {
    const pattern = composeMusic(421, "mission", 3);
    const sectionNotes = (name: string, lane: "melody" | "pulse") => {
      const section = pattern.sections.find((entry) => entry.name === name);
      if (!section) return [];
      return pattern.notes[lane].filter((note) => note.step >= section.startBar * STEPS_PER_BAR && note.step < section.endBar * STEPS_PER_BAR);
    };
    const averageDuration = (notes: { duration: number }[]) =>
      notes.reduce((sum, note) => sum + note.duration, 0) / Math.max(1, notes.length);

    expect(pattern.theme.hook).not.toEqual(pattern.motif);
    expect(pattern.motif.rhythm.some((step) => step % 2 === 1)).toBe(true);
    expect(["pulse", "march"]).toContain(pattern.theme.groove);
    expect(["natural minor", "dorian", "mixolydian", "major"]).toContain(pattern.scaleName);
    expect(sectionNotes("hook", "melody").length).toBeGreaterThan(24);
    expect(sectionNotes("groove", "melody").length).toBeGreaterThan(0);
    expect(averageDuration(sectionNotes("hook", "melody"))).toBeGreaterThan(averageDuration(sectionNotes("groove", "melody")));
    expect(sectionNotes("climax", "melody").length).toBeGreaterThan(sectionNotes("hook", "melody").length);
    expect(sectionNotes("climax", "pulse").length).toBeGreaterThan(sectionNotes("hook", "pulse").length);
    expect(pattern.drums.some((event) => event.kind === "clap")).toBe(true);
    expect(pattern.drums.some((event) => event.kind === "impact")).toBe(true);
    expect(pattern.arpType).toBe("square");
    expect(new Set(pattern.padThird).size).toBeGreaterThan(2);
    expect(new Set(pattern.padSeventh).size).toBeGreaterThan(2);
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

  it("creates deterministic mission filenames and reports unsupported headless export", async () => {
    expect(missionSoundtrackFilename(421, 3)).toBe("genesis-protocol-0421-mission-04.m4a");
    expect(await supportsM4aExport()).toBe(false);
  });

  it("does not require optional offline suspend controls for export availability", async () => {
    const isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
    class OfflineAudioContextStub {}
    vi.stubGlobal("window", {
      AudioEncoder: { isConfigSupported },
      AudioData: class AudioDataStub {},
      OfflineAudioContext: OfflineAudioContextStub,
    });

    await expect(supportsM4aExport()).resolves.toBe(true);
    expect(isConfigSupported).toHaveBeenCalledOnce();
  });

  it("rejects a cancelled soundtrack export before starting browser work", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(exportMissionSoundtrack(421, 3, undefined, { signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
