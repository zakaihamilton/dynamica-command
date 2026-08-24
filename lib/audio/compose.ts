import { createRng, type Rng } from "../seed/rng";

export type MusicCue = "menu" | "briefing" | "mission" | "victory" | "defeat";
export type MusicIntensity = "calm" | "engaged" | "critical";
export type MusicVoiceType = "triangle" | "sawtooth" | "square" | "sine";
export type MusicGroove = "march" | "pulse";
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

const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

const MINOR_PROGRESSIONS: readonly number[][] = [
  [0, 5, 2, 6, 0, 5, 3, 4],
  [0, 6, 5, 6, 0, 5, 2, 6],
  [0, 3, 5, 4, 2, 6, 0, 4],
  [0, 5, 3, 4, 0, 6, 5, 4],
];

const MAJOR_PROGRESSIONS: readonly number[][] = [
  [0, 4, 5, 3, 0, 4, 5, 4],
  [0, 4, 3, 5, 0, 4, 5, 3],
  [0, 3, 4, 5, 0, 3, 5, 4],
  [5, 3, 0, 4, 0, 4, 5, 3],
];

const MIXOLYDIAN_PROGRESSIONS: readonly number[][] = [
  [0, 6, 3, 0, 0, 6, 3, 4],
  [0, 3, 6, 3, 0, 4, 6, 3],
  [0, 4, 6, 3, 0, 3, 6, 4],
  [0, 6, 5, 3, 0, 6, 3, 4],
];

type BassHit = { tone: number; oct: number } | null;

const BASS_RIFFS: readonly BassHit[][] = [
  [
    { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 },
    { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, { tone: 2, oct: 0 }, { tone: 0, oct: 1 },
  ],
  [
    { tone: 0, oct: 0 }, { tone: 0, oct: 0 }, { tone: 0, oct: 0 }, { tone: 2, oct: 0 },
    { tone: 0, oct: 0 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, { tone: 2, oct: 0 },
  ],
  [
    { tone: 0, oct: 0 }, null, { tone: 2, oct: 0 }, { tone: 0, oct: 0 },
    null, { tone: 0, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 1 },
  ],
  [
    { tone: 0, oct: 0 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, { tone: 0, oct: 0 },
    { tone: 2, oct: 0 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, null,
  ],
  [
    { tone: 0, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 },
    { tone: 0, oct: 0 }, { tone: 2, oct: 0 }, { tone: 1, oct: 0 }, { tone: 0, oct: 0 },
  ],
];

const VERSE_CONTOURS: readonly (number | null)[][] = [
  [0, 0, 2, 4, 2, 0, null],
  [0, 2, 3, 2, 0, 2, 4],
  [2, 0, 2, 4, 3, 2, 0],
  [0, 1, 3, 2, 4, 2, 0],
  [0, 2, 0, 4, 2, 3, 0],
];

const HOOK_CONTOURS: readonly (number | null)[][] = [
  [4, 4, 5, 2, 0],
  [7, 5, 4, 2, 0],
  [4, 6, 4, 0, 2],
  [5, 4, 7, 5, 4],
  [4, 2, 4, 5, 4],
];

const VERSE_RHYTHMS: readonly number[][] = [
  [0, 2, 3, 6, 8, 10, 12],
  [0, 1, 4, 6, 8, 11, 12],
  [0, 2, 4, 7, 8, 10, 13],
];

const HOOK_RHYTHMS: readonly number[][] = [
  [0, 4, 8, 12, 14],
  [0, 3, 8, 12, 14],
  [0, 4, 7, 10, 12],
];

const ARP_FIGURES: readonly number[][] = [
  [0, 2, 1, 2, 0, 1, 2, 0],
  [0, 1, 2, 1, 0, 2, 1, 2],
  [0, 2, 0, 2, 1, 2, 0, 1],
];

const OPEN_HAT_FIGURES: readonly (readonly number[])[] = [[6, 14], [6], [14, 6]];

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
  response: (number | null)[];
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
  if (cue === "menu") return 112 + (roll % 13);
  if (cue === "briefing") return 104 + (roll % 13);
  if (cue === "mission") return 118 + ((roll + mission) % 11);
  if (cue === "victory") return 124 + (roll % 9);
  return 88 + (roll % 11);
}

function scaleFor(cue: MusicCue, rng: Rng): { notes: readonly number[]; name: string } {
  if (cue === "victory") {
    return rng.pick([
      { notes: MAJOR, name: "major" },
      { notes: MIXOLYDIAN, name: "mixolydian" },
      { notes: DORIAN, name: "dorian" },
    ]);
  }
  if (cue === "briefing") {
    return rng.pick([
      { notes: DORIAN, name: "dorian" },
      { notes: NATURAL_MINOR, name: "natural minor" },
    ]);
  }
  if (cue === "defeat") {
    return rng.pick([
      { notes: NATURAL_MINOR, name: "natural minor" },
      { notes: DORIAN, name: "dorian" },
    ]);
  }
  return rng.pick([
    { notes: NATURAL_MINOR, name: "natural minor" },
    { notes: DORIAN, name: "dorian" },
    { notes: MIXOLYDIAN, name: "mixolydian" },
    { notes: MAJOR, name: "major" },
  ]);
}

function grooveFor(cue: MusicCue, rng: Rng): MusicGroove {
  if (cue === "defeat") return "march";
  if (cue === "victory") return rng.pick(["march", "pulse"]);
  return rng.pick(["pulse", "march"]);
}

function progressionsFor(scaleName: string): readonly number[][] {
  if (scaleName === "major") return MAJOR_PROGRESSIONS;
  if (scaleName === "mixolydian") return MIXOLYDIAN_PROGRESSIONS;
  return MINOR_PROGRESSIONS;
}

function grooveHits(groove: MusicGroove, variation: 0 | 1): { kick: number[]; snare: number[] } {
  if (groove === "pulse") {
    return variation === 0
      ? { kick: [0, 4, 8, 12], snare: [4, 12] }
      : { kick: [0, 4, 8, 10, 12], snare: [4, 12] };
  }
  return variation === 0
    ? { kick: [0, 8], snare: [4, 12] }
    : { kick: [0, 6, 8], snare: [4, 12] };
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

function motifFrom(
  rng: Rng,
  contours: readonly (number | null)[][],
  rhythms: readonly number[][],
): MusicMotif {
  const contour = rng.pick(contours);
  const response = pickDifferent(rng, contours, contour);
  const rhythm = rng.pick(rhythms);
  const accents = rng.pick([
    [0, 2],
    [0, 3],
    [1, 4],
  ]);
  return {
    degrees: [...contour],
    response: [...response],
    rhythm: [...rhythm],
    accentSteps: [...accents],
    variant: rng.int(8),
  };
}

function placeMelody(
  notes: MusicNoteEvent[],
  origin: number,
  motif: MusicMotif,
  response: boolean,
  rootMidi: number,
  scale: readonly number[],
  chord: number,
  variant: number,
  octave: number,
  durationFor: (index: number, sounding: number) => number,
  velocity: number,
  harmony: boolean,
): void {
  const degrees = response ? motif.response : motif.degrees;
  let sounding = 0;
  for (const degree of degrees) {
    if (degree !== null) sounding += 1;
  }
  let placed = 0;
  for (let i = 0; i < degrees.length; i++) {
    const degree = degrees[i];
    if (degree === null) continue;
    const motifStep = motif.rhythm[i] ?? i * 2;
    if (motifStep < 0 || motifStep >= STEPS_PER_BAR) continue;
    const midi = scaleToneMidi(rootMidi, scale, chord, degree + variant, octave);
    const duration = durationFor(placed, sounding);
    noteEvent(notes, origin + motifStep, midi, duration, velocity, motif.accentSteps.includes(i));
    if (harmony) {
      noteEvent(
        notes,
        origin + motifStep,
        scaleToneMidi(rootMidi, scale, chord, degree + variant + 2, octave),
        duration,
        velocity * 0.7,
      );
    }
    placed += 1;
  }
}

export function composeMusic(seed: number, cue: MusicCue, missionIndex = 0): MusicPattern {
  const rng = createRng(seed, musicLabel(cue, missionIndex));
  const scalePick = scaleFor(cue, rng);
  const rootMidi = cue === "defeat" ? rng.intRange(33, 40) : rng.intRange(36, 46);
  const groove = grooveFor(cue, rng);
  const progressions = progressionsFor(scalePick.name);
  const progressionA = rng.pick(progressions);
  const progressionB = pickDifferent(rng, progressions, progressionA);
  const bassRiffA = rng.pick(BASS_RIFFS);
  const bassRiffB = pickDifferent(rng, BASS_RIFFS, bassRiffA);
  const motif = motifFrom(rng, VERSE_CONTOURS, VERSE_RHYTHMS);
  const hook = motifFrom(rng, HOOK_CONTOURS, HOOK_RHYTHMS);
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
    const chord = progression[phraseBar] ?? 0;
    const riff = secondHalf ? bassRiffB : bassRiffA;
    const arpFigure = secondHalf ? arpFigureB : arpFigureA;
    const openHatSteps = secondHalf ? openHatB : openHatA;
    const fill = phraseBar === 7;
    const intro = section.name === "intro";
    const breakdown = section.name === "breakdown";
    const climax = section.name === "climax";
    const hookSection = section.name === "hook" || section.name === "turnaround" || climax;
    const fullDrums = !sparse && (cue === "victory" || (!breakdown && (!intro || phraseBar >= 4)));
    const lightDrums = sparse && !breakdown && (!intro || phraseBar >= 4);
    const usePulse =
      (intro && phraseBar >= 4) ||
      section.name === "groove" ||
      section.name === "hook" ||
      section.name === "development" ||
      section.name === "escalation" ||
      climax ||
      section.name === "turnaround" ||
      (breakdown && phraseBar >= 6);
    const phraseSlot = phraseBar % 4;
    const response = phraseSlot === 1 || phraseSlot === 2;
    const restBar = !hookSection && phraseSlot === 3 && section.name !== "escalation";
    const useHookLead =
      hookSection ||
      (intro && phraseBar >= 6) ||
      (breakdown && phraseBar >= 4) ||
      (section.name === "escalation" && phraseBar >= 4);
    const useMelody =
      !restBar &&
      (section.name === "groove" ||
        section.name === "development" ||
        section.name === "escalation" ||
        hookSection ||
        (intro && phraseBar >= 6) ||
        (breakdown && phraseBar >= 4));
    const useCounter = !sparse && (section.name === "development" || climax);

    padRoot.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 0, 1)));
    padThird.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 1, 1)));
    padFifth.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 2, 1)));
    padSeventh.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 3, 1)));

    const bassStride = breakdown ? 8 : intro ? 4 : 2;
    if (breakdown) {
      noteEvent(notes.bass, origin, chordToneMidi(rootMidi, scalePick.notes, chord, 0, -1), 8, 0.58, true);
      if (bar % 2 === 1) noteEvent(notes.bass, origin + 8, chordToneMidi(rootMidi, scalePick.notes, chord, 0, 0), 6, 0.46);
    } else {
      for (let i = 0; i < 8; i++) {
        if (i % (bassStride / 2) !== 0 && bassStride > 2) continue;
        const hit = riff[i];
        if (!hit) continue;
        const octave = climax && i % 3 === 2 ? hit.oct + 1 : hit.oct;
        noteEvent(
          notes.bass,
          origin + i * 2,
          chordToneMidi(rootMidi, scalePick.notes, chord, hit.tone, octave),
          intro ? 3 : 2,
          i === 0 || i === 4 ? 0.92 : 0.7,
          i === 0 || i === 4,
        );
      }
    }

    if (usePulse) {
      const pulseStride = climax ? 1 : breakdown || (sparse && cue === "defeat") ? 4 : 2;
      for (let i = 0; i < STEPS_PER_BAR; i += pulseStride) {
        const figureIndex = Math.floor(i / Math.max(1, pulseStride === 1 ? 1 : 2)) % arpFigure.length;
        const velocity = climax
          ? i % 2 === 0 ? 0.7 : 0.36
          : section.name === "hook" || section.name === "escalation"
            ? 0.56
            : 0.48;
        noteEvent(
          notes.pulse,
          origin + i,
          chordToneMidi(rootMidi, scalePick.notes, chord, arpFigure[figureIndex]!, 1),
          1,
          velocity,
          i % 4 === 0,
        );
      }
    }

    if (useMelody) {
      const lead = useHookLead ? hook : motif;
      const variant = climax
        ? 0
        : section.name === "development"
          ? 1
          : section.name === "escalation" && !useHookLead
            ? 1
            : 0;
      const velocity = climax ? 0.96 : hookSection ? 0.86 : 0.74;
      const durationFor = (index: number, sounding: number) => {
        if (useHookLead) return index === sounding - 1 ? 3 : 4;
        return 2;
      };
      placeMelody(
        notes.melody,
        origin,
        lead,
        response,
        rootMidi,
        scalePick.notes,
        chord,
        variant,
        2,
        durationFor,
        velocity,
        climax,
      );
    }

    if (useCounter && useMelody) {
      const lead = useHookLead ? hook : motif;
      const degrees = response ? lead.response : lead.degrees;
      for (let i = 0; i < degrees.length; i++) {
        const degree = degrees[i];
        if (degree === null) continue;
        const motifStep = lead.rhythm[i] ?? i * 2;
        if (motifStep % 2 === 1 || motifStep >= STEPS_PER_BAR) continue;
        noteEvent(
          notes.counter,
          origin + motifStep,
          scaleToneMidi(rootMidi, scalePick.notes, chord, degree, 2),
          climax ? 4 : 2,
          climax ? 0.5 : 0.36,
        );
      }
    }

    if (fullDrums || lightDrums) {
      const hits = grooveHits(groove, secondHalf ? 1 : 0);
      const drumGain = fullDrums ? 1 : 0.58;
      for (const step of hits.kick) drumEvent(drums, origin + step, "kick", (step === 0 ? 0.95 : 0.72) * drumGain, step === 0);
      for (const step of hits.snare) {
        const accent = step === 4 || step === 12;
        drumEvent(drums, origin + step, "snare", (accent ? 0.9 : 0.62) * drumGain, accent);
        if (!breakdown) drumEvent(drums, origin + step, "clap", (accent ? 0.76 : 0.48) * drumGain, accent);
      }
      const hatStride = climax ? 1 : 2;
      for (let step = 0; step < STEPS_PER_BAR; step += hatStride) {
        const offbeat = climax ? step % 2 === 1 : step % 4 === 2;
        drumEvent(drums, origin + step, "hat", (offbeat ? 0.28 : 0.2) * drumGain);
      }
      if (!breakdown) {
        for (const step of openHatSteps) drumEvent(drums, origin + step, "openHat", 0.44 * drumGain);
      }
    }

    if ((section.name === "escalation" || climax) && phraseBar === 0) {
      drumEvent(drums, origin, "impact", climax ? 0.9 : 0.62, true);
    }

    if (fill) {
      if (sparse) {
        drumEvent(drums, origin + 12, "snare", 0.52, true);
        drumEvent(drums, origin + 14, "openHat", 0.38);
      } else {
        const fillSteps = bar === MUSIC_BARS - 1 ? [6, 8, 10, 11, 12, 13, 14, 15] : [8, 10, 12, 13, 14, 15];
        for (const step of fillSteps) drumEvent(drums, origin + step, step >= 12 ? "tom" : "snare", step >= 12 ? 0.74 : 0.6, step >= 12);
        drumEvent(drums, origin, "kick", 0.92, true);
        drumEvent(drums, origin + 8, "kick", 0.7);
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
    hook,
  };

  return {
    cue,
    seed,
    missionIndex,
    bpm: bpmFor(cue, rng.int(64), missionIndex),
    swing: rng.next() * 0.03,
    bars: MUSIC_BARS,
    steps: MUSIC_STEPS,
    rootHz: midiToHz(rootMidi),
    rootMidi,
    scaleName: scalePick.name,
    cutoff: 640 + rng.int(cue === "mission" ? 520 : 320),
    bassType: rng.pick(["square", "square", "sawtooth"]),
    arpType: "square",
    melodyType: rng.pick(["sawtooth", "sawtooth", "square"]),
    delayBeats: rng.pick([0.75, 0.75, 0.5]),
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
