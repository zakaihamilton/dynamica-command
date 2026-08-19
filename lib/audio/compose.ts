import { createRng, type Rng } from "../seed/rng";

export type MusicCue = "menu" | "briefing" | "mission" | "victory" | "defeat";
export type MusicVoiceType = "triangle" | "square" | "sawtooth";
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

function sectionOf(bar: number): "A" | "B" | "break" | "fill" {
  if (bar >= 7) return "fill";
  if (bar === 6) return "break";
  if (bar >= 4) return "B";
  return "A";
}

export function composeMusic(seed: number, cue: MusicCue, missionIndex = 0): MusicPattern {
  const rng = createRng(seed, musicLabel(cue, missionIndex));
  const scale = scaleFor(cue, rng);
  const rootMidi = cue === "defeat" ? rng.intRange(33, 40) : rng.intRange(36, 46);
  const groove = grooveFor(cue, rng, missionIndex);
  const progression = rng.pick(PROGRESSIONS);
  const hits = grooveHits(groove);
  const busy = cue === "mission" ? 0.08 * Math.max(0, missionIndex) : 0;
  const hatEvery = rng.pick(cue === "mission" || cue === "victory" ? [1, 2] : [2, 2, 4]);
  const hatMask = Array.from({ length: STEPS_PER_BAR }, (_, i) => {
    if (i % hatEvery !== 0) return false;
    const density = (cue === "mission" ? 0.72 : cue === "victory" ? 0.6 : cue === "defeat" ? 0.28 : 0.4) + busy;
    return rng.chance(Math.min(0.92, density));
  });
  const kickSkip = Array.from({ length: STEPS_PER_BAR }, () => rng.chance(0.12));
  const snareGhost = Array.from({ length: STEPS_PER_BAR }, (_, i) => i % 2 === 1 && rng.chance(groove === "break" ? 0.22 : 0.08));

  const ostinatoLen = rng.pick([4, 8]);
  const ostinato = Array.from({ length: ostinatoLen }, () => rng.int(3));
  const ostinatoRest = Array.from({ length: ostinatoLen }, () => rng.chance(0.12));
  const arpFigure = Array.from({ length: 8 }, (_, i) => [0, 2, 1, 2, 0, 1, 2, 0][i]!);
  const arpRest = Array.from({ length: 8 }, () => rng.chance(cue === "mission" ? 0.08 : 0.22));
  const melodyMotif: (number | null)[] = Array.from({ length: 8 }, () => (rng.chance(0.55) ? rng.intRange(0, 4) : null));
  if (!melodyMotif.some((note) => note !== null)) melodyMotif[0] = 0;
  if (melodyMotif.filter((note) => note !== null).length < 3) {
    melodyMotif[2] = 2;
    melodyMotif[6] = 1;
  }

  const bass = emptyNotes();
  const arp = emptyNotes();
  const melody = emptyNotes();
  const counter = emptyNotes();
  const kick = emptyHits();
  const snare = emptyHits();
  const hats = emptyHits();

  for (let bar = 0; bar < MUSIC_BARS; bar++) {
    const chord = progression[bar] ?? 0;
    const section = sectionOf(bar);
    const origin = bar * STEPS_PER_BAR;
    const dropKick = section === "break" && cue !== "victory";
    const fill = section === "fill";

    for (const step of hits.kick) {
      if (!dropKick && !kickSkip[step]) kick[origin + step] = true;
    }
    for (const step of hits.snare) {
      if (section !== "break" || fill) snare[origin + step] = true;
    }
    for (let i = 0; i < STEPS_PER_BAR; i++) {
      hats[origin + i] = fill ? i % 2 === 0 || hatMask[i]! : section === "break" ? i % 4 === 0 && hatMask[i]! : hatMask[i]!;
      if (!fill && snareGhost[i] && section !== "break") snare[origin + i] = true;
    }
    if (fill) {
      for (const step of [8, 10, 12, 13, 14, 15]) snare[origin + step] = true;
      kick[origin] = true;
      kick[origin + 8] = groove !== "stalk";
    }

    if (section !== "break") {
      for (let i = 0; i < 8; i++) {
        const motif = ostinato[i % ostinatoLen]!;
        if (ostinatoRest[i % ostinatoLen]) continue;
        bass[origin + i * 2] = midiToHz(chordToneMidi(rootMidi, scale, chord, motif, 0));
      }
      if (section === "B") {
        for (let i = 0; i < 8; i++) {
          if ((i + bar) % 3 !== 0) continue;
          const motif = ostinato[i % ostinatoLen]!;
          bass[origin + i * 2 + 1] = midiToHz(chordToneMidi(rootMidi, scale, chord, motif, 0));
        }
      }
    } else {
      bass[origin] = midiToHz(chordToneMidi(rootMidi, scale, chord, 0, -1));
      bass[origin + 8] = midiToHz(chordToneMidi(rootMidi, scale, chord, 0, 0));
    }

    const arpSparse = cue === "briefing" || cue === "defeat" || section === "break";
    for (let i = 0; i < 8; i++) {
      if (arpRest[i] || (arpSparse && i % 2 === 1)) continue;
      const step = origin + i * 2;
      arp[step] = midiToHz(chordToneMidi(rootMidi, scale, chord, arpFigure[i]!, 1));
    }
    if (section === "B" && !arpSparse) {
      for (let i = 0; i < 8; i++) {
        if (i % 2 !== 0) continue;
        arp[origin + i * 2 + 1] = midiToHz(chordToneMidi(rootMidi, scale, chord, arpFigure[i]!, 1));
      }
    }

    const sequence = section === "B" ? 2 : 0;
    const melodyOct = 2;
    if (section !== "fill") {
      for (let i = 0; i < 8; i++) {
        const degree = melodyMotif[i];
        if (degree === null) continue;
        if (section === "A" && i % 2 === 1) continue;
        if (section === "break" && i % 2 === 1) continue;
        melody[origin + i * 2] = midiToHz(scaleToneMidi(rootMidi, scale, chord, degree + sequence, melodyOct));
      }
    }
    if (section === "B") {
      for (let i = 0; i < 8; i++) {
        if (melodyMotif[i] !== null) continue;
        counter[origin + i * 2] = midiToHz(chordToneMidi(rootMidi, scale, chord, 2, 2));
      }
    }
  }

  const voice = (options: MusicVoiceType[]) => rng.pick(options);

  return {
    cue,
    seed,
    missionIndex,
    bpm: bpmFor(cue, rng.int(64), missionIndex),
    swing: groove === "break" || groove === "stalk" ? 0.08 + rng.next() * 0.22 : rng.next() * 0.12,
    bars: MUSIC_BARS,
    steps: MUSIC_STEPS,
    rootHz: midiToHz(rootMidi),
    cutoff: 420 + rng.int(cue === "mission" ? 1100 : 700),
    bassType: voice(["triangle", "sawtooth"]),
    arpType: voice(["square", "triangle"]),
    melodyType: voice(["triangle", "square", "sawtooth"]),
    delayBeats: rng.pick([0.5, 0.75]),
    bass,
    arp,
    melody,
    counter,
    kick,
    snare,
    hats,
  };
}
