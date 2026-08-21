import { createRng, type Rng } from "../seed/rng";

export type MusicCue = "menu" | "briefing" | "mission" | "victory" | "defeat";
export type MusicVoiceType = "triangle" | "sawtooth";
export type MusicGroove = "march" | "pulse" | "break" | "stalk";

export const TITLE_MUSIC_SEED = 0;
export const TUTORIAL_MUSIC_MISSION = -1;
export const STEPS_PER_BAR = 16;
export const MUSIC_BARS = 32;
export const MUSIC_STEPS = STEPS_PER_BAR * MUSIC_BARS;

const MINOR_PENT = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const MIXOLYDIAN = [0, 2, 4, 7, 9, 10];
const MAJOR_PENT = [0, 2, 4, 7, 9];

const PROGRESSIONS: readonly number[][] = [
  [0, 0, 3, 0, 5, 2, 3, 0],
  [0, 3, 0, 4, 0, 3, 5, 0],
  [0, 0, 4, 4, 3, 3, 0, 0],
  [0, 5, 3, 0, 0, 5, 4, 0],
  [0, 2, 3, 0, 5, 3, 4, 0],
  [0, 0, 5, 3, 0, 4, 3, 0],
];

type BassHit = { tone: number; oct: number } | null;

const BASS_RIFFS: readonly BassHit[][] = [
  [
    { tone: 0, oct: 0 }, { tone: 0, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 0 },
    { tone: 0, oct: 0 }, { tone: 0, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 0 },
  ],
  [
    { tone: 0, oct: 0 }, null, { tone: 0, oct: 1 }, { tone: 2, oct: 0 },
    { tone: 0, oct: 0 }, null, { tone: 2, oct: 0 }, null,
  ],
  [
    { tone: 0, oct: 0 }, { tone: 0, oct: 0 }, { tone: 0, oct: 0 }, { tone: 1, oct: 0 },
    { tone: 2, oct: 0 }, { tone: 0, oct: 0 }, null, { tone: 0, oct: -1 },
  ],
  [
    { tone: 0, oct: 0 }, null, { tone: 2, oct: 0 }, null,
    { tone: 0, oct: 0 }, { tone: 1, oct: 0 }, { tone: 2, oct: 0 }, null,
  ],
  [
    { tone: 0, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 0 }, null,
    { tone: 0, oct: 1 }, { tone: 2, oct: 0 }, { tone: 0, oct: 0 }, null,
  ],
];

const MELODY_CONTOURS: readonly (number | null)[][] = [
  [0, null, 2, null, 3, 2, null, 0],
  [0, 1, 2, null, 4, null, 2, null],
  [2, null, 0, null, null, 1, 2, 0],
  [0, null, null, 2, 3, null, 2, null],
  [4, 2, 0, null, 2, null, 0, null],
  [0, null, 4, 3, 2, null, 0, null],
];

const ARP_FIGURES: readonly number[][] = [
  [0, 2, 1, 2, 0, 1, 2, 0],
  [0, 1, 2, 1, 0, 2, 1, 2],
  [0, 2, 0, 2, 1, 2, 0, 1],
];

const OPEN_HAT_FIGURES: readonly (readonly number[])[] = [[6], [14], [6, 14], []];

export type MusicPattern = {
  cue: MusicCue;
  seed: number;
  missionIndex: number;
  bpm: number;
  swing: number;
  bars: number;
  steps: number;
  rootHz: number;
  cutoff: number;
  bassType: MusicVoiceType;
  arpType: MusicVoiceType;
  melodyType: MusicVoiceType;
  delayBeats: number;
  bass: (number | null)[];
  arp: (number | null)[];
  melody: (number | null)[];
  counter: (number | null)[];
  kick: boolean[];
  snare: boolean[];
  hats: boolean[];
  openHats: boolean[];
  padRoot: number[];
  padFifth: number[];
};

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function musicLabel(cue: MusicCue, missionIndex: number): string {
  if (missionIndex === TUTORIAL_MUSIC_MISSION) return "music:tutorial";
  return `music:${cue}:${missionIndex}`;
}

function bpmFor(cue: MusicCue, roll: number, missionIndex: number): number {
  const mission = Math.max(0, missionIndex);
  if (cue === "menu") return 72 + (roll % 17);
  if (cue === "briefing") return 64 + (roll % 17);
  if (cue === "mission") return 96 + ((roll + mission) % 23);
  if (cue === "victory") return 100 + (roll % 21);
  return 56 + (roll % 15);
}

function scaleFor(cue: MusicCue, rng: Rng): readonly number[] {
  if (cue === "victory") return rng.pick([MAJOR_PENT, MIXOLYDIAN, DORIAN]);
  if (cue === "briefing") return rng.pick([PHRYGIAN, HARMONIC_MINOR, DORIAN]);
  if (cue === "defeat") return rng.pick([PHRYGIAN, HARMONIC_MINOR]);
  return rng.pick([MINOR_PENT, DORIAN, PHRYGIAN, HARMONIC_MINOR, MIXOLYDIAN]);
}

function grooveFor(cue: MusicCue, rng: Rng, missionIndex: number): MusicGroove {
  if (cue === "briefing" || cue === "defeat") return rng.pick(["stalk", "stalk", "march"]);
  if (cue === "menu") return rng.pick(["stalk", "pulse", "march"]);
  if (cue === "victory") return rng.pick(["march", "pulse"]);
  if (missionIndex >= 4) return rng.pick(["pulse", "break", "march"]);
  return rng.pick(["march", "pulse", "break", "stalk"]);
}

function grooveHits(groove: MusicGroove, variation: 0 | 1): { kick: number[]; snare: number[] } {
  if (groove === "pulse") {
    return variation === 0
      ? { kick: [0, 4, 8, 12], snare: [4, 12] }
      : { kick: [0, 3, 4, 8, 10, 12], snare: [4, 10, 12, 14] };
  }
  if (groove === "break") {
    return variation === 0
      ? { kick: [0, 6, 10], snare: [4, 12, 14] }
      : { kick: [0, 3, 8, 10], snare: [4, 12, 15] };
  }
  if (groove === "stalk") {
    return variation === 0
      ? { kick: [0], snare: [12] }
      : { kick: [0, 6], snare: [10, 14] };
  }
  return variation === 0
    ? { kick: [0, 8], snare: [4, 12] }
    : { kick: [0, 6, 8, 14], snare: [4, 12] };
}

function emptyNotes(): (number | null)[] {
  return Array.from({ length: MUSIC_STEPS }, () => null);
}

function emptyHits(): boolean[] {
  return Array.from({ length: MUSIC_STEPS }, () => false);
}

function wrapDegree(scale: readonly number[], degree: number): number {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return scale[idx]! + oct * 12;
}

function chordToneMidi(rootMidi: number, scale: readonly number[], chord: number, tone: number, octave: number): number {
  return rootMidi + wrapDegree(scale, chord + tone * 2) + octave * 12;
}

function scaleToneMidi(rootMidi: number, scale: readonly number[], chord: number, offset: number, octave: number): number {
  return rootMidi + wrapDegree(scale, chord + offset) + octave * 12;
}

function sectionOf(bar: number): "intro" | "groove" | "lead" | "break" | "climax" | "fill" {
  if (bar % 8 === 7) return "fill";
  if (bar >= 24) return "climax";
  if (bar >= 16) return "break";
  if (bar >= 8) return "lead";
  if (bar >= 4) return "groove";
  return "intro";
}

function sparseCue(cue: MusicCue): boolean {
  return cue === "menu" || cue === "briefing" || cue === "defeat";
}

function pickDifferent<T>(rng: Rng, options: readonly T[], current: T): T {
  if (options.length < 2) return current;
  let next = rng.pick(options);
  while (next === current) next = rng.pick(options);
  return next;
}

export function composeMusic(seed: number, cue: MusicCue, missionIndex = 0): MusicPattern {
  const rng = createRng(seed, musicLabel(cue, missionIndex));
  const scale = scaleFor(cue, rng);
  const rootMidi = cue === "defeat" ? rng.intRange(33, 40) : rng.intRange(36, 46);
  const groove = grooveFor(cue, rng, missionIndex);
  const progressionA = rng.pick(PROGRESSIONS);
  const progressionB = pickDifferent(rng, PROGRESSIONS, progressionA);
  const riffA = rng.pick(BASS_RIFFS);
  const riffB = pickDifferent(rng, BASS_RIFFS, riffA);
  const contourA = rng.pick(MELODY_CONTOURS);
  const contourB = pickDifferent(rng, MELODY_CONTOURS, contourA);
  const arpFigureA = rng.pick(ARP_FIGURES);
  const arpFigureB = pickDifferent(rng, ARP_FIGURES, arpFigureA);
  const openHatA = rng.pick(OPEN_HAT_FIGURES);
  const openHatB = pickDifferent(rng, OPEN_HAT_FIGURES, openHatA);
  const padRoot: number[] = [];
  const padFifth: number[] = [];

  const bass = emptyNotes();
  const arp = emptyNotes();
  const melody = emptyNotes();
  const counter = emptyNotes();
  const kick = emptyHits();
  const snare = emptyHits();
  const hats = emptyHits();
  const openHats = emptyHits();

  for (let bar = 0; bar < MUSIC_BARS; bar++) {
    const section = sectionOf(bar);
    const origin = bar * STEPS_PER_BAR;
    const secondHalf = bar >= MUSIC_BARS / 2;
    const phraseBar = bar % 8;
    const progression = secondHalf ? progressionB : progressionA;
    const chord = phraseBar === 7 ? 0 : progression[phraseBar] ?? 0;
    const riff = secondHalf ? riffB : riffA;
    const contour = secondHalf ? contourB : contourA;
    const arpFigure = secondHalf ? arpFigureB : arpFigureA;
    const openHatSteps = secondHalf ? openHatB : openHatA;
    const fill = section === "fill";
    const hits = grooveHits(groove, secondHalf ? 1 : 0);
    const sparseDrums = section === "groove" || (section === "lead" && phraseBar % 2 === 0);
    const drums = sparseCue(cue)
      ? sparseDrums
      : cue === "victory" || (section !== "break" && (section !== "intro" || cue === "mission"));
    const useArp = (!sparseCue(cue) && (section === "groove" || section === "lead" || section === "climax"))
      || (cue === "menu" && section === "groove");
    const useMelody = (!sparseCue(cue) && (section === "lead" || section === "climax" || fill))
      || (sparseCue(cue) && (phraseBar === 4 || phraseBar === 5 || fill));
    const useCounter = (section === "lead" || section === "climax") && !sparseCue(cue);

    padRoot.push(midiToHz(chordToneMidi(rootMidi, scale, chord, 0, 1)));
    padFifth.push(midiToHz(chordToneMidi(rootMidi, scale, chord, 2, 1)));

    if (drums) {
      for (const step of hits.kick) kick[origin + step] = true;
      for (const step of hits.snare) snare[origin + step] = true;
      const hatStride = section === "intro" || section === "break" || groove === "stalk" ? 4 : 2;
      for (let i = 0; i < STEPS_PER_BAR; i += hatStride) {
        if (fill || i % 4 === 0 || (groove !== "stalk" && i % 4 === 2)) hats[origin + i] = true;
      }
      if (section !== "break") {
        for (const step of openHatSteps) {
          hats[origin + step] = false;
          openHats[origin + step] = true;
        }
      }
    }
    if (fill) {
      if (sparseCue(cue)) {
        snare[origin + 12] = true;
        openHats[origin + 14] = true;
      } else {
        const fillSteps = bar === MUSIC_BARS - 1 ? [6, 8, 10, 11, 12, 13, 14, 15] : [8, 10, 12, 13, 14, 15];
        for (const step of fillSteps) snare[origin + step] = true;
        kick[origin] = true;
        kick[origin + 8] = groove !== "stalk";
        if (bar === MUSIC_BARS - 1) {
          kick[origin + 4] = true;
          kick[origin + 12] = true;
        }
      }
    }

    if (section === "break") {
      bass[origin] = midiToHz(chordToneMidi(rootMidi, scale, chord, 0, -1));
      bass[origin + 8] = midiToHz(chordToneMidi(rootMidi, scale, chord, 0, 0));
    } else {
      for (let i = 0; i < 8; i++) {
        const hit = riff[i];
        if (!hit) continue;
        const octave = section === "climax" && i % 3 === 2 ? hit.oct + 1 : hit.oct;
        bass[origin + i * 2] = midiToHz(chordToneMidi(rootMidi, scale, chord, hit.tone, octave));
      }
    }

    if (useArp) {
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 1 && section !== "lead" && section !== "climax") continue;
        arp[origin + i * 2] = midiToHz(chordToneMidi(rootMidi, scale, chord, arpFigure[i]!, 1));
        if (section === "climax" && i % 2 === 0) {
          arp[origin + i * 2 + 1] = midiToHz(chordToneMidi(rootMidi, scale, chord, arpFigure[i]!, 1));
        }
      }
    }

    if (useMelody) {
      const sequence = section === "climax" ? 3 : section === "lead" ? 2 : 0;
      for (let i = 0; i < 8; i++) {
        const degree = contour[i];
        if (degree === null) continue;
        melody[origin + i * 2] = midiToHz(scaleToneMidi(rootMidi, scale, chord, degree + sequence, 2));
      }
      if (section === "climax") {
        melody[origin + 15] = midiToHz(scaleToneMidi(rootMidi, scale, chord, 0, 2));
      }
    }
    if (useCounter) {
      for (let i = 0; i < 8; i++) {
        if (contour[i] !== null) continue;
        if (i % 2 === 1) continue;
        const tone = section === "climax" ? 1 : 2;
        counter[origin + i * 2] = midiToHz(chordToneMidi(rootMidi, scale, chord, tone, 2));
      }
    }
  }

  return {
    cue,
    seed,
    missionIndex,
    bpm: bpmFor(cue, rng.int(64), missionIndex),
    swing: groove === "break" || groove === "stalk" ? 0.06 + rng.next() * 0.16 : rng.next() * 0.08,
    bars: MUSIC_BARS,
    steps: MUSIC_STEPS,
    rootHz: midiToHz(rootMidi),
    cutoff: 380 + rng.int(cue === "mission" ? 520 : 320),
    bassType: rng.pick(["triangle", "sawtooth"]),
    arpType: "sawtooth",
    melodyType: rng.pick(["triangle", "sawtooth"]),
    delayBeats: rng.pick([0.5, 0.75]),
    bass,
    arp,
    melody,
    counter,
    kick,
    snare,
    hats,
    openHats,
    padRoot,
    padFifth,
  };
}
