import { createRng, type Rng } from "../seed/rng";

export type MusicCue = "menu" | "briefing" | "mission" | "victory" | "defeat";
export type MusicVoiceType = "triangle" | "sawtooth";
export type MusicGroove = "march" | "pulse" | "break" | "stalk";

export const TITLE_MUSIC_SEED = 0;
export const TUTORIAL_MUSIC_MISSION = -1;
export const STEPS_PER_BAR = 16;
export const MUSIC_BARS = 8;
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

function grooveHits(groove: MusicGroove): { kick: number[]; snare: number[] } {
  if (groove === "pulse") return { kick: [0, 4, 8, 12], snare: [4, 12] };
  if (groove === "break") return { kick: [0, 6, 10], snare: [4, 12, 14] };
  if (groove === "stalk") return { kick: [0], snare: [12] };
  return { kick: [0, 8], snare: [4, 12] };
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

function sectionOf(bar: number): "intro" | "arp" | "lead" | "break" | "fill" {
  if (bar >= 7) return "fill";
  if (bar === 6) return "break";
  if (bar >= 4) return "lead";
  if (bar >= 2) return "arp";
  return "intro";
}

function sparseCue(cue: MusicCue): boolean {
  return cue === "menu" || cue === "briefing" || cue === "defeat";
}

export function composeMusic(seed: number, cue: MusicCue, missionIndex = 0): MusicPattern {
  const rng = createRng(seed, musicLabel(cue, missionIndex));
  const scale = scaleFor(cue, rng);
  const rootMidi = cue === "defeat" ? rng.intRange(33, 40) : rng.intRange(36, 46);
  const groove = grooveFor(cue, rng, missionIndex);
  const progression = rng.pick(PROGRESSIONS);
  const hits = grooveHits(groove);
  const riff = rng.pick(BASS_RIFFS);
  const contour = rng.pick(MELODY_CONTOURS);
  const arpFigure = rng.pick(ARP_FIGURES);
  const openHatSteps = rng.pick([[6], [14], [6, 14], []] as const);
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
    const chord = progression[bar] ?? 0;
    const section = sectionOf(bar);
    const origin = bar * STEPS_PER_BAR;
    const fill = section === "fill";
    const drums = section !== "break" || cue === "victory";
    const useArp = (!sparseCue(cue) && (section === "arp" || section === "lead"))
      || (cue === "menu" && section === "arp");
    const useMelody = section === "lead" || section === "fill" || (sparseCue(cue) && (bar === 4 || bar === 5 || fill));
    const useCounter = section === "lead" && !sparseCue(cue);

    padRoot.push(midiToHz(chordToneMidi(rootMidi, scale, chord, 0, 1)));
    padFifth.push(midiToHz(chordToneMidi(rootMidi, scale, chord, 2, 1)));

    if (drums) {
      for (const step of hits.kick) kick[origin + step] = true;
      for (const step of hits.snare) snare[origin + step] = true;
      for (let i = 0; i < STEPS_PER_BAR; i += 2) {
        if (fill ? i % 4 === 0 || i >= 8 : i % 4 === 0 || (groove !== "stalk" && i % 4 === 2)) hats[origin + i] = true;
      }
      if (section !== "break") {
        for (const step of openHatSteps) {
          hats[origin + step] = false;
          openHats[origin + step] = true;
        }
      }
    }
    if (fill) {
      for (const step of [8, 10, 12, 14]) snare[origin + step] = true;
      kick[origin] = true;
      kick[origin + 8] = groove !== "stalk";
    }

    if (section === "break") {
      bass[origin] = midiToHz(chordToneMidi(rootMidi, scale, chord, 0, -1));
      bass[origin + 8] = midiToHz(chordToneMidi(rootMidi, scale, chord, 0, 0));
    } else {
      for (let i = 0; i < 8; i++) {
        const hit = riff[i];
        if (!hit) continue;
        bass[origin + i * 2] = midiToHz(chordToneMidi(rootMidi, scale, chord, hit.tone, hit.oct));
      }
    }

    if (useArp) {
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 1 && section !== "lead") continue;
        arp[origin + i * 2] = midiToHz(chordToneMidi(rootMidi, scale, chord, arpFigure[i]!, 1));
      }
    }

    if (useMelody) {
      const sequence = section === "lead" ? 2 : 0;
      for (let i = 0; i < 8; i++) {
        const degree = contour[i];
        if (degree === null) continue;
        melody[origin + i * 2] = midiToHz(scaleToneMidi(rootMidi, scale, chord, degree + sequence, 2));
      }
    }
    if (useCounter) {
      for (let i = 0; i < 8; i++) {
        if (contour[i] !== null) continue;
        if (i % 2 === 1) continue;
        counter[origin + i * 2] = midiToHz(chordToneMidi(rootMidi, scale, chord, 2, 2));
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
