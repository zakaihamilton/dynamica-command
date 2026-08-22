import { createRng, type Rng } from "../seed/rng";

export type MusicCue = "menu" | "briefing" | "mission" | "victory" | "defeat";
export type MusicIntensity = "calm" | "engaged" | "critical";
export type MusicVoiceType = "triangle" | "sawtooth" | "square" | "sine";
export type MusicGroove = "march" | "pulse" | "break" | "stalk";
export type MusicSectionName =
  | "intro"
  | "groove"
  | "hook"
  | "development"
  | "breakdown"
  | "escalation"
  | "climax"
  | "turnaround";
export type MusicStem = "bass" | "pulse" | "melody" | "counter";
export type MusicDrumKind = "kick" | "snare" | "clap" | "hat" | "openHat" | "tom" | "impact";

export const TITLE_MUSIC_SEED = 0;
export const TUTORIAL_MUSIC_MISSION = -1;
export const STEPS_PER_BAR = 16;
export const MUSIC_BARS = 64;
export const MUSIC_STEPS = STEPS_PER_BAR * MUSIC_BARS;

const MINOR_PENT = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const MIXOLYDIAN = [0, 2, 4, 7, 9, 10];
const MAJOR_PENT = [0, 2, 4, 7, 9];

const PROGRESSIONS: readonly number[][] = [
  [0, 5, 3, 4, 0, 5, 3, 4],
  [0, 3, 5, 4, 0, 3, 5, 4],
  [0, 5, 6, 4, 0, 5, 6, 4],
  [0, 3, 4, 5, 0, 3, 4, 5],
  [0, 6, 4, 5, 0, 6, 4, 5],
  [0, 4, 5, 3, 0, 4, 5, 3],
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
  [0, 2, 4, 2, 3, 2, 0, null],
  [0, 1, 3, 4, 2, 4, 3, 0],
  [2, 4, 2, 0, null, 1, 3, 2],
  [0, null, 2, 4, 3, 2, 4, null],
  [4, 2, 0, 2, 4, 3, 2, 0],
  [0, 2, 4, 3, 2, 4, 3, 0],
];

const ARP_FIGURES: readonly number[][] = [
  [0, 2, 1, 2, 0, 1, 2, 0],
  [0, 1, 2, 1, 0, 2, 1, 2],
  [0, 2, 0, 2, 1, 2, 0, 1],
];

const OPEN_HAT_FIGURES: readonly (readonly number[])[] = [[6], [14], [6, 14], []];

const HOOK_RHYTHMS: readonly number[][] = [
  [0, 2, 4, 7, 8, 10, 12, 14],
  [0, 1, 4, 6, 8, 11, 12, 15],
  [0, 2, 5, 7, 8, 10, 13, 14],
];

const SECTION_ORDER: readonly MusicSectionName[] = [
  "intro",
  "groove",
  "hook",
  "development",
  "breakdown",
  "escalation",
  "climax",
  "turnaround",
];

export type MusicNoteEvent = {
  step: number;
  midi: number;
  duration: number;
  velocity: number;
  accent?: boolean;
};

export type MusicDrumEvent = {
  step: number;
  kind: MusicDrumKind;
  velocity: number;
  accent?: boolean;
};

export type MusicMotif = {
  degrees: (number | null)[];
  rhythm: number[];
  accentSteps: number[];
  variant: number;
};

export type MusicSection = {
  name: MusicSectionName;
  startBar: number;
  endBar: number;
  energy: number;
};

export type MusicTheme = {
  rootMidi: number;
  scale: number[];
  scaleName: string;
  groove: MusicGroove;
  progressionA: number[];
  progressionB: number[];
  bassRiffA: BassHit[];
  bassRiffB: BassHit[];
  motif: MusicMotif;
  hook: MusicMotif;
};

export type MusicPattern = {
  cue: MusicCue;
  seed: number;
  missionIndex: number;
  bpm: number;
  swing: number;
  bars: number;
  steps: number;
  rootHz: number;
  rootMidi: number;
  scaleName: string;
  cutoff: number;
  bassType: MusicVoiceType;
  arpType: MusicVoiceType;
  melodyType: MusicVoiceType;
  delayBeats: number;
  theme: MusicTheme;
  motif: MusicMotif;
  sections: MusicSection[];
  notes: Record<MusicStem, MusicNoteEvent[]>;
  drums: MusicDrumEvent[];
  bass: (number | null)[];
  arp: (number | null)[];
  melody: (number | null)[];
  counter: (number | null)[];
  kick: boolean[];
  snare: boolean[];
  hats: boolean[];
  openHats: boolean[];
  padRoot: number[];
  padThird: number[];
  padFifth: number[];
  padSeventh: number[];
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
  if (cue === "menu") return 92 + (roll % 15);
  if (cue === "briefing") return 82 + (roll % 15);
  if (cue === "mission") return 112 + ((roll + mission) % 13);
  if (cue === "victory") return 118 + (roll % 11);
  return 72 + (roll % 13);
}

function scaleFor(cue: MusicCue, rng: Rng): { notes: readonly number[]; name: string } {
  if (cue === "victory") {
    return rng.pick([
      { notes: MAJOR_PENT, name: "major pentatonic" },
      { notes: MIXOLYDIAN, name: "mixolydian" },
      { notes: DORIAN, name: "dorian" },
    ]);
  }
  if (cue === "briefing") {
    return rng.pick([
      { notes: PHRYGIAN, name: "phrygian" },
      { notes: HARMONIC_MINOR, name: "harmonic minor" },
      { notes: DORIAN, name: "dorian" },
    ]);
  }
  if (cue === "defeat") {
    return rng.pick([
      { notes: PHRYGIAN, name: "phrygian" },
      { notes: HARMONIC_MINOR, name: "harmonic minor" },
    ]);
  }
  return rng.pick([
    { notes: MINOR_PENT, name: "minor pentatonic" },
    { notes: DORIAN, name: "dorian" },
    { notes: PHRYGIAN, name: "phrygian" },
    { notes: HARMONIC_MINOR, name: "harmonic minor" },
    { notes: MIXOLYDIAN, name: "mixolydian" },
  ]);
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

function sectionEnergy(name: MusicSectionName): number {
  if (name === "intro" || name === "breakdown") return 0.24;
  if (name === "groove") return 0.55;
  if (name === "hook") return 0.72;
  if (name === "development") return 0.62;
  if (name === "escalation") return 0.78;
  if (name === "climax") return 1;
  return 0.86;
}

function isSparseCue(cue: MusicCue): boolean {
  return cue === "menu" || cue === "briefing" || cue === "defeat";
}

function pickDifferent<T>(rng: Rng, options: readonly T[], current: T): T {
  if (options.length < 2) return current;
  let next = rng.pick(options);
  while (next === current) next = rng.pick(options);
  return next;
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

function noteEvent(
  notes: MusicNoteEvent[],
  step: number,
  midi: number,
  duration: number,
  velocity: number,
  accent = false,
): void {
  notes.push({ step, midi, duration, velocity, ...(accent ? { accent: true } : {}) });
}

function drumEvent(drums: MusicDrumEvent[], step: number, kind: MusicDrumKind, velocity: number, accent = false): void {
  drums.push({ step, kind, velocity, ...(accent ? { accent: true } : {}) });
}

function legacyNotes(events: MusicNoteEvent[]): (number | null)[] {
  const lane = Array.from({ length: MUSIC_STEPS }, () => null as number | null);
  for (const event of events) lane[event.step] = midiToHz(event.midi);
  return lane;
}

function legacyHits(drums: MusicDrumEvent[], kind: MusicDrumKind): boolean[] {
  const lane = Array.from({ length: MUSIC_STEPS }, () => false);
  for (const event of drums) {
    if (event.kind === kind) lane[event.step] = true;
  }
  return lane;
}

function makeSections(): MusicSection[] {
  return SECTION_ORDER.map((name, index) => ({
    name,
    startBar: index * 8,
    endBar: index * 8 + 8,
    energy: sectionEnergy(name),
  }));
}

function motifFor(rng: Rng): MusicMotif {
  const contour = rng.pick(MELODY_CONTOURS);
  const rhythm = rng.pick(HOOK_RHYTHMS);
  const accents = rng.pick([
    [0, 3, 6],
    [0, 4, 7],
    [0, 2, 5, 7],
  ]);
  return { degrees: [...contour], rhythm: [...rhythm], accentSteps: [...accents], variant: rng.int(8) };
}

export function composeMusic(seed: number, cue: MusicCue, missionIndex = 0): MusicPattern {
  const rng = createRng(seed, musicLabel(cue, missionIndex));
  const scalePick = scaleFor(cue, rng);
  const rootMidi = cue === "defeat" ? rng.intRange(33, 40) : rng.intRange(36, 46);
  const groove = grooveFor(cue, rng, missionIndex);
  const progressionA = rng.pick(PROGRESSIONS);
  const progressionB = pickDifferent(rng, PROGRESSIONS, progressionA);
  const bassRiffA = rng.pick(BASS_RIFFS);
  const bassRiffB = pickDifferent(rng, BASS_RIFFS, bassRiffA);
  const motif = motifFor(rng);
  const arpFigureA = rng.pick(ARP_FIGURES);
  const arpFigureB = pickDifferent(rng, ARP_FIGURES, arpFigureA);
  const openHatA = rng.pick(OPEN_HAT_FIGURES);
  const openHatB = pickDifferent(rng, OPEN_HAT_FIGURES, openHatA);
  const sparse = isSparseCue(cue);
  const sections = makeSections();
  const notes: Record<MusicStem, MusicNoteEvent[]> = { bass: [], pulse: [], melody: [], counter: [] };
  const drums: MusicDrumEvent[] = [];
  const padRoot: number[] = [];
  const padThird: number[] = [];
  const padFifth: number[] = [];
  const padSeventh: number[] = [];

  for (let bar = 0; bar < MUSIC_BARS; bar++) {
    const section = sections[Math.floor(bar / 8)]!;
    const origin = bar * STEPS_PER_BAR;
    const phraseBar = bar % 8;
    const secondHalf = bar >= MUSIC_BARS / 2;
    const progression = secondHalf ? progressionB : progressionA;
    const chord = phraseBar === 7 ? 0 : progression[phraseBar] ?? 0;
    const riff = secondHalf ? bassRiffB : bassRiffA;
    const arpFigure = secondHalf ? arpFigureB : arpFigureA;
    const openHatSteps = secondHalf ? openHatB : openHatA;
    const fill = phraseBar === 7;
    const intro = section.name === "intro";
    const breakdown = section.name === "breakdown";
    const leadSection = section.name === "hook" || section.name === "development" || section.name === "escalation" || section.name === "climax" || section.name === "turnaround";
    const fullDrums = !sparse && (cue === "victory" || (!breakdown && (!intro || phraseBar >= 4)));
    const lightDrums = sparse && !breakdown && (!intro || phraseBar >= 4);
    const sparsePulse = sparse && cue !== "defeat" && (section.name === "groove" || section.name === "hook" || section.name === "turnaround");
    const usePulse = (!sparse && (section.name === "groove" || leadSection || section.name === "turnaround")) || sparsePulse;
    const useMelody = leadSection || (sparse && (section.name === "hook" || section.name === "turnaround"));
    const useCounter = !sparse && (section.name === "development" || section.name === "climax");

    padRoot.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 0, 1)));
    padThird.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 1, 1)));
    padFifth.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 2, 1)));
    padSeventh.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 3, 1)));

    const bassStride = breakdown ? 8 : intro ? 4 : 2;
    if (breakdown) {
      noteEvent(notes.bass, origin, chordToneMidi(rootMidi, scalePick.notes, chord, 0, -1), 8, 0.55, true);
      if (bar % 2 === 1) noteEvent(notes.bass, origin + 8, chordToneMidi(rootMidi, scalePick.notes, chord, 0, 0), 6, 0.42);
    } else {
      for (let i = 0; i < 8; i++) {
        if (i % (bassStride / 2) !== 0 && bassStride > 2) continue;
        const hit = riff[i];
        if (!hit) continue;
        const octave = section.name === "climax" && i % 3 === 2 ? hit.oct + 1 : hit.oct;
        noteEvent(
          notes.bass,
          origin + i * 2,
          chordToneMidi(rootMidi, scalePick.notes, chord, hit.tone, octave),
          section.name === "intro" ? 3 : 2,
          i === 0 || i === 4 ? 0.9 : 0.66,
          i === 0 || i === 4,
        );
      }
    }

    if (usePulse) {
      const pulseStride = section.name === "climax" ? 1 : sparsePulse ? 4 : 2;
      for (let i = 0; i < STEPS_PER_BAR; i += pulseStride) {
        const figureIndex = Math.floor(i / 2) % arpFigure.length;
        const step = origin + i;
        const velocity = section.name === "climax" ? (i % 2 === 0 ? 0.68 : 0.34) : section.name === "hook" || section.name === "escalation" ? 0.54 : 0.46;
        noteEvent(notes.pulse, step, chordToneMidi(rootMidi, scalePick.notes, chord, arpFigure[figureIndex]!, 1), 1, velocity, i % 4 === 0);
      }
    }

    if (useMelody) {
      const variant = section.name === "climax" ? 3 : section.name === "escalation" ? 2 : section.name === "development" ? 1 : 0;
      const response = phraseBar % 2 === 1;
      for (let i = 0; i < motif.degrees.length; i++) {
        const degree = motif.degrees[i];
        if (degree === null) continue;
        if (section.name === "development" && i % 5 === 2) continue;
        const motifStep = motif.rhythm[i % motif.rhythm.length] ?? i * 2;
        const step = origin + motifStep;
        const inverted = response ? 4 - degree : degree;
        const transposed = inverted + variant + (section.name === "climax" && i % 3 === 0 ? 1 : 0);
        const duration = section.name === "climax" ? 2 : response ? 3 : 2;
        const velocity = section.name === "climax" ? 0.96 : section.name === "hook" || section.name === "turnaround" ? 0.82 : 0.72;
        noteEvent(notes.melody, step, scaleToneMidi(rootMidi, scalePick.notes, chord, transposed, 2), duration, velocity, motif.accentSteps.includes(i));
      }
      if (section.name === "climax" || section.name === "turnaround") {
        noteEvent(notes.melody, origin + 15, scaleToneMidi(rootMidi, scalePick.notes, chord, 0, 2), 1, 0.9, true);
      }
    }

    if (useCounter) {
      for (let i = 0; i < 8; i++) {
        if (motif.degrees[i % motif.degrees.length] !== null || i % 2 === 1) continue;
        noteEvent(notes.counter, origin + i * 2, chordToneMidi(rootMidi, scalePick.notes, chord, section.name === "climax" ? 1 : 2, 2), 2, section.name === "climax" ? 0.55 : 0.38);
      }
    }

    if (fullDrums || lightDrums) {
      const hits = grooveHits(groove, secondHalf ? 1 : 0);
      for (const step of hits.kick) drumEvent(drums, origin + step, "kick", fullDrums ? (step === 0 ? 0.95 : 0.7) : 0.44, step === 0);
      for (const step of hits.snare) {
        const accent = step === 4 || step === 12;
        drumEvent(drums, origin + step, "snare", fullDrums ? (accent ? 0.86 : 0.58) : 0.38, accent);
        if (fullDrums && !breakdown) drumEvent(drums, origin + step, "clap", accent ? 0.72 : 0.44, accent);
      }
      const hatStride = section.name === "climax" ? 1 : intro || breakdown || groove === "stalk" ? 4 : 2;
      for (let step = 0; step < STEPS_PER_BAR; step += hatStride) {
        if (step % 4 === 0 || (groove !== "stalk" && step % 4 === 2)) drumEvent(drums, origin + step, "hat", fullDrums ? 0.34 : 0.2);
      }
      if (!breakdown) {
        for (const step of openHatSteps) drumEvent(drums, origin + step, "openHat", fullDrums ? 0.42 : 0.24);
      }
    }

    if ((section.name === "escalation" || section.name === "climax") && phraseBar === 0) {
      drumEvent(drums, origin, "impact", section.name === "climax" ? 0.9 : 0.62, true);
    }

    if (fill) {
      if (sparse) {
        drumEvent(drums, origin + 12, "snare", 0.48, true);
        drumEvent(drums, origin + 14, "openHat", 0.35);
      } else {
        const fillSteps = bar === MUSIC_BARS - 1 ? [6, 8, 10, 11, 12, 13, 14, 15] : [8, 10, 12, 13, 14, 15];
        for (const step of fillSteps) drumEvent(drums, origin + step, step >= 12 ? "tom" : "snare", step >= 12 ? 0.74 : 0.6, step >= 12);
        drumEvent(drums, origin, "kick", 0.92, true);
        if (groove !== "stalk") drumEvent(drums, origin + 8, "kick", 0.7);
        if (bar === MUSIC_BARS - 1) {
          drumEvent(drums, origin + 4, "kick", 0.78);
          drumEvent(drums, origin + 12, "kick", 0.88, true);
          drumEvent(drums, origin + 12, "impact", 0.86, true);
        }
      }
    }
  }

  const theme: MusicTheme = {
    rootMidi,
    scale: [...scalePick.notes],
    scaleName: scalePick.name,
    groove,
    progressionA: [...progressionA],
    progressionB: [...progressionB],
    bassRiffA: [...bassRiffA],
    bassRiffB: [...bassRiffB],
    motif,
    hook: motif,
  };

  return {
    cue,
    seed,
    missionIndex,
    bpm: bpmFor(cue, rng.int(64), missionIndex),
    swing: groove === "break" || groove === "stalk" ? 0.06 + rng.next() * 0.16 : rng.next() * 0.08,
    bars: MUSIC_BARS,
    steps: MUSIC_STEPS,
    rootHz: midiToHz(rootMidi),
    rootMidi,
    scaleName: scalePick.name,
    cutoff: 420 + rng.int(cue === "mission" ? 560 : 360),
    bassType: rng.pick(["sawtooth", "square"]),
    arpType: "square",
    melodyType: rng.pick(["square", "sawtooth"]),
    delayBeats: rng.pick([0.5, 0.75]),
    theme,
    motif,
    sections,
    notes,
    drums,
    bass: legacyNotes(notes.bass),
    arp: legacyNotes(notes.pulse),
    melody: legacyNotes(notes.melody),
    counter: legacyNotes(notes.counter),
    kick: legacyHits(drums, "kick"),
    snare: legacyHits(drums, "snare"),
    hats: legacyHits(drums, "hat"),
    openHats: legacyHits(drums, "openHat"),
    padRoot,
    padThird,
    padFifth,
    padSeventh,
  };
}
