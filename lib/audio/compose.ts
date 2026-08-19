import { createRng } from "../seed/rng";

export type MusicCue = "menu" | "briefing" | "mission" | "victory" | "defeat";

export const TITLE_MUSIC_SEED = 0;
export const MUSIC_STEPS = 16;

const MINOR_PENT = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const MAJOR_PENT = [0, 2, 4, 7, 9];

export type MusicPattern = {
  cue: MusicCue;
  seed: number;
  bpm: number;
  steps: number;
  rootHz: number;
  cutoff: number;
  bass: (number | null)[];
  arp: (number | null)[];
  melody: (number | null)[];
  hats: boolean[];
};

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function bpmFor(cue: MusicCue, roll: number): number {
  if (cue === "menu") return 72 + (roll % 17);
  if (cue === "briefing") return 64 + (roll % 17);
  if (cue === "mission") return 96 + (roll % 23);
  if (cue === "victory") return 100 + (roll % 21);
  return 56 + (roll % 15);
}

function scaleFor(cue: MusicCue, pick: number): readonly number[] {
  if (cue === "victory") return MAJOR_PENT;
  if (cue === "briefing" || cue === "defeat") return PHRYGIAN;
  return [MINOR_PENT, DORIAN, PHRYGIAN][pick % 3]!;
}

function densityFor(cue: MusicCue): { arp: number; melody: number; hats: number } {
  if (cue === "menu") return { arp: 0.28, melody: 0.12, hats: 0.22 };
  if (cue === "briefing") return { arp: 0.16, melody: 0.1, hats: 0.12 };
  if (cue === "mission") return { arp: 0.48, melody: 0.2, hats: 0.5 };
  if (cue === "victory") return { arp: 0.4, melody: 0.28, hats: 0.38 };
  return { arp: 0.1, melody: 0.08, hats: 0.08 };
}

function tone(rootMidi: number, scale: readonly number[], degree: number, octave: number): number {
  return midiToHz(rootMidi + scale[degree % scale.length]! + octave * 12);
}

export function composeMusic(seed: number, cue: MusicCue): MusicPattern {
  const rng = createRng(seed, `music:${cue}`);
  const scale = scaleFor(cue, rng.int(3));
  const rootMidi = cue === "defeat" ? rng.intRange(33, 40) : rng.intRange(36, 46);
  const density = densityFor(cue);
  const bass: (number | null)[] = Array.from({ length: MUSIC_STEPS }, () => null);
  const anchors = cue === "mission" || cue === "victory" ? [0, 4, 8, 12] : [0, 8];
  for (const step of anchors) {
    bass[step] = tone(rootMidi, scale, rng.int(Math.min(3, scale.length)), rng.chance(0.35) ? -1 : 0);
  }
  for (let i = 0; i < MUSIC_STEPS; i++) {
    if (bass[i] !== null) continue;
    if (rng.chance(cue === "mission" ? 0.18 : 0.08)) bass[i] = tone(rootMidi, scale, rng.int(scale.length), 0);
  }

  const arp = Array.from({ length: MUSIC_STEPS }, () => (
    rng.chance(density.arp) ? tone(rootMidi, scale, rng.int(scale.length), 1) : null
  ));
  const melody = Array.from({ length: MUSIC_STEPS }, () => (
    rng.chance(density.melody) ? tone(rootMidi, scale, rng.int(scale.length), 2) : null
  ));
  const hats = Array.from({ length: MUSIC_STEPS }, () => rng.chance(density.hats));

  return {
    cue,
    seed,
    bpm: bpmFor(cue, rng.int(64)),
    steps: MUSIC_STEPS,
    rootHz: midiToHz(rootMidi),
    cutoff: 420 + rng.int(cue === "mission" ? 1100 : 700),
    bass,
    arp,
    melody,
    hats,
  };
}
