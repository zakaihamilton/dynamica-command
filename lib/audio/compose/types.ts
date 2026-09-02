import type { BiomeName, MissionKind } from "../../types";

export type MusicCue = "menu" | "briefing" | "mission" | "victory" | "defeat";
export type MusicIntensity = "calm" | "engaged" | "critical";
export type MusicVoiceType = "triangle" | "sawtooth" | "square" | "sine";
export type MusicGroove = "march" | "pulse" | "shuffle" | "half-time";
export type MusicScaleName =
  | "natural minor"
  | "dorian"
  | "mixolydian"
  | "major"
  | "phrygian"
  | "harmonic minor"
  | "minor pentatonic";
export type MusicBassRiffFamily =
  | "classic"
  | "industrial"
  | "syncopated"
  | "octave"
  | "sparse"
  | "descending"
  | "restless"
  | "walking"
  | "pedal";
export type MusicFillStyle = "snare-tom" | "kick-roll" | "hat-chatter" | "tom-only";
export type MusicArrangementName =
  | "slow-burn"
  | "forward-drive"
  | "syncopated-strike"
  | "ghost-signal"
  | "bass-siege"
  | "wide-open"
  | "panic-run"
  | "command-theme"
  | "half-time-break"
  | "call-and-echo"
  | "double-drop"
  | "anthem-lift"
  | "melody-late"
  | "drums-out"
  | "inverted-hold"
  | "echo-canon";
export type MusicStyleName =
  | "neon-arpeggio"
  | "industrial-march"
  | "acid-grid"
  | "orbital-drift"
  | "cinematic-tension"
  | "signal-chase"
  | "chrome-fanfare"
  | "low-orbit"
  | "glass-chime"
  | "foundry-stomp"
  | "night-raid"
  | "ice-protocol";
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

export type MusicDrumProfile = {
  kickStart: number;
  kickEnd: number;
  kickTail: number;
  snareBody: number;
  snareNoise: number;
  hatFrequency: number;
  openHatFrequency: number;
  tomStart: number;
  tomEnd: number;
  impactStart: number;
  impactEnd: number;
  noisePan: number;
};

export type MusicArrangementProfile = {
  name: MusicArrangementName;
  bassStrides: readonly (2 | 4 | 8)[];
  pulseStrides: readonly (1 | 2 | 4)[];
  melodyEnabled: readonly boolean[];
  pulseEnabled: readonly boolean[];
  counterEnabled: readonly boolean[];
  holdBass: readonly boolean[];
  hatStride: readonly (1 | 2 | 4)[];
  fillStyle: readonly MusicFillStyle[];
  echoMelody: boolean;
  melodyDegreeOffset: number;
  rhythmOffset: 0 | 1 | 2 | 3;
  drumDensity: readonly number[];
};

export type MusicStyleProfile = {
  name: MusicStyleName;
  scalePool: readonly MusicScaleName[];
  groove: MusicGroove;
  grooveVariant: 0 | 1 | 2;
  progressionVariant: 0 | 1 | 2 | 3;
  bassRiffFamily: MusicBassRiffFamily;
  arrangement: MusicArrangementProfile;
  tempoBias: number;
  swing: number;
  bassType: MusicVoiceType;
  pulseType: MusicVoiceType;
  melodyType: MusicVoiceType;
  counterType: MusicVoiceType;
  padType: MusicVoiceType;
  padDetune: readonly [number, number, number, number];
  padLfoRate: number;
  padLfoDepth: number;
  padQ: number;
  delayBeats: number;
  delayFeedback: number;
  delayWet: number;
  reverbSeconds: number;
  reverbDecay: number;
  reverbSend: number;
  reverbWet: number;
  cutoffMin: number;
  cutoffMax: number;
  bassStride: 2 | 4 | 8;
  pulseStride: 1 | 2 | 4;
  melodyOctave: 1 | 2;
  rhythmShift: 0 | 1 | 2;
  counterChance: number;
  drumDensity: number;
  drum: MusicDrumProfile;
};

export const TITLE_MUSIC_SEED = 0;
export const TUTORIAL_MUSIC_MISSION = -1;
export const STEPS_PER_BAR = 16;
export const BARS_PER_SECTION = 16;
export const SECTION_COUNT = 8;
export const MUSIC_BARS = SECTION_COUNT * BARS_PER_SECTION;
export const MUSIC_STEPS = STEPS_PER_BAR * MUSIC_BARS;

export const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];
export const DORIAN = [0, 2, 3, 5, 7, 9, 10];
export const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
export const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
export const MINOR_PENTATONIC = [0, 3, 5, 7, 10];

export const MINOR_PROGRESSIONS: readonly number[][] = [
  [0, 5, 2, 6, 0, 5, 3, 4],
  [0, 6, 5, 6, 0, 5, 2, 6],
  [0, 3, 5, 4, 2, 6, 0, 4],
  [0, 5, 3, 4, 0, 6, 5, 4],
  [0, 4, 6, 2, 5, 3, 1, 4],
  [0, 2, 4, 6, 3, 5, 2, 0],
  [0, 3, 6, 4, 1, 5, 3, 4],
  [6, 5, 0, 3, 4, 2, 0, 5],
];

export const MAJOR_PROGRESSIONS: readonly number[][] = [
  [0, 4, 5, 3, 0, 4, 5, 4],
  [0, 4, 3, 5, 0, 4, 5, 3],
  [0, 3, 4, 5, 0, 3, 5, 4],
  [5, 3, 0, 4, 0, 4, 5, 3],
  [0, 2, 5, 4, 0, 3, 4, 5],
  [0, 5, 3, 4, 0, 2, 6, 4],
  [2, 5, 0, 4, 3, 0, 5, 4],
  [0, 3, 5, 1, 0, 4, 2, 5],
];

export const MIXOLYDIAN_PROGRESSIONS: readonly number[][] = [
  [0, 6, 3, 0, 0, 6, 3, 4],
  [0, 3, 6, 3, 0, 4, 6, 3],
  [0, 4, 6, 3, 0, 3, 6, 4],
  [0, 6, 5, 3, 0, 6, 3, 4],
  [0, 2, 5, 3, 0, 6, 4, 2],
  [0, 5, 4, 2, 0, 3, 6, 4],
  [2, 6, 0, 4, 3, 5, 0, 6],
  [0, 3, 5, 6, 0, 4, 2, 5],
];

export const PHRYGIAN_PROGRESSIONS: readonly number[][] = [
  [0, 1, 6, 5, 0, 1, 3, 4],
  [0, 6, 1, 0, 3, 1, 6, 5],
  [0, 1, 3, 1, 0, 6, 5, 4],
  [1, 0, 6, 0, 1, 3, 5, 4],
  [0, 3, 1, 6, 0, 5, 1, 4],
  [0, 1, 5, 6, 3, 0, 1, 4],
  [6, 1, 0, 3, 1, 6, 0, 5],
  [0, 5, 1, 6, 0, 1, 3, 4],
];

export const HARMONIC_MINOR_PROGRESSIONS: readonly number[][] = [
  [0, 4, 5, 3, 0, 4, 6, 3],
  [0, 5, 3, 4, 0, 6, 4, 3],
  [0, 3, 6, 4, 1, 5, 3, 4],
  [6, 4, 0, 3, 5, 4, 0, 3],
  [0, 4, 6, 2, 5, 3, 4, 0],
  [0, 6, 4, 5, 0, 3, 4, 6],
  [3, 0, 4, 6, 5, 0, 4, 3],
  [0, 5, 4, 3, 6, 4, 0, 5],
];

export const PENTATONIC_PROGRESSIONS: readonly number[][] = [
  [0, 2, 4, 2, 0, 3, 4, 2],
  [0, 3, 2, 4, 0, 2, 3, 4],
  [0, 4, 3, 2, 0, 4, 2, 3],
  [2, 0, 4, 3, 0, 2, 4, 0],
  [0, 2, 3, 4, 2, 0, 4, 3],
  [4, 2, 0, 3, 4, 0, 2, 4],
  [0, 3, 4, 0, 2, 4, 3, 2],
  [0, 4, 2, 0, 3, 2, 4, 0],
];

export type BassHit = { tone: number; oct: number } | null;

export const BASS_RIFFS: readonly BassHit[][] = [
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
  [
    { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, null, { tone: 3, oct: 0 },
    { tone: 0, oct: 0 }, { tone: 2, oct: 1 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 },
  ],
  [
    { tone: 0, oct: 0 }, null, { tone: 0, oct: 1 }, { tone: 2, oct: 0 },
    { tone: 3, oct: 0 }, null, { tone: 0, oct: 1 }, { tone: 1, oct: 0 },
  ],
  [
    { tone: 0, oct: 0 }, { tone: 1, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 1 },
    { tone: 0, oct: 0 }, { tone: 2, oct: 0 }, null, { tone: 0, oct: 1 },
  ],
  [
    { tone: 0, oct: 0 }, { tone: 1, oct: 0 }, { tone: 2, oct: 0 }, { tone: 3, oct: 0 },
    { tone: 0, oct: 1 }, { tone: 2, oct: 0 }, { tone: 1, oct: 0 }, { tone: 0, oct: 0 },
  ],
  [
    { tone: 0, oct: 0 }, null, { tone: 0, oct: 0 }, { tone: 4, oct: 0 },
    { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, null, { tone: 3, oct: 0 },
  ],
];

export const VERSE_CONTOURS: readonly (number | null)[][] = [
  [0, 0, 2, 4, 2, 0, null],
  [0, 2, 3, 2, 0, 2, 4],
  [2, 0, 2, 4, 3, 2, 0],
  [0, 1, 3, 2, 4, 2, 0],
  [0, 2, 0, 4, 2, 3, 0],
  [4, 3, 2, 0, 2, 3, 4],
  [0, null, 3, 2, 4, null, 0],
  [4, 2, 0, 2, 4, 3, 1],
  [0, 1, 4, 3, 1, 0, null],
  [2, 4, 5, 4, 2, 0, 2],
  [0, 3, null, 4, 2, 5, 0],
  [5, 4, 2, 4, 0, 2, null],
  [1, 3, 4, 2, 0, 4, 3],
  [0, 4, null, 2, 5, 3, 0],
  [3, 5, 4, 2, 0, null, 2],
  [2, null, 4, 5, 3, 1, 0],
  [0, 2, 4, null, 5, 4, 2],
];

export const HOOK_CONTOURS: readonly (number | null)[][] = [
  [4, 4, 5, 2, 0],
  [7, 5, 4, 2, 0],
  [4, 6, 4, 0, 2],
  [5, 4, 7, 5, 4],
  [4, 2, 4, 5, 4],
  [2, 4, 7, 5, 4],
  [0, 2, 5, 4, 2],
  [7, 6, 4, 2, 0],
  [4, 5, 4, 2, 7],
  [5, 7, 4, 2, 0],
  [7, 4, 5, 2, 4],
  [4, 7, 5, 4, 2],
  [0, 4, 7, 4, 2],
  [5, 2, 4, 7, 0],
  [7, 5, 2, 4, 0],
];

export const VERSE_RHYTHMS: readonly number[][] = [
  [0, 2, 3, 6, 8, 10, 12],
  [0, 1, 4, 6, 8, 11, 12],
  [0, 2, 4, 7, 8, 10, 13],
  [0, 3, 5, 7, 10, 12, 15],
  [0, 1, 5, 8, 9, 12, 14],
  [0, 2, 6, 7, 11, 13, 15],
  [0, 4, 5, 8, 10, 12, 14],
  [1, 2, 6, 8, 9, 12, 15],
  [0, 3, 4, 8, 11, 12, 14],
  [1, 4, 6, 9, 10, 13, 15],
];

export const HOOK_RHYTHMS: readonly number[][] = [
  [0, 4, 8, 12, 14],
  [0, 3, 8, 12, 14],
  [0, 4, 7, 10, 12],
  [0, 2, 7, 11, 14],
  [0, 3, 6, 10, 15],
  [0, 5, 8, 11, 13],
  [0, 4, 6, 12, 15],
  [0, 2, 8, 10, 13],
];

export const ARP_FIGURES: readonly number[][] = [
  [0, 2, 1, 2, 0, 1, 2, 0],
  [0, 1, 2, 1, 0, 2, 1, 2],
  [0, 2, 0, 2, 1, 2, 0, 1],
  [0, 1, 0, 2, 1, 0, 2, 1],
  [2, 1, 0, 1, 2, 0, 1, 2],
  [0, 2, 3, 2, 0, 1, 2, 0],
  [1, 2, 0, 2, 1, 0, 2, 1],
  [0, 0, 2, 1, 0, 2, 1, 2],
  [0, 3, 1, 2, 0, 2, 3, 1],
  [2, 0, 1, 0, 2, 3, 1, 0],
  [0, 1, 3, 1, 2, 0, 1, 3],
];

export const OPEN_HAT_FIGURES: readonly (readonly number[])[] = [
  [6, 14],
  [6],
  [14, 6],
  [2, 10],
  [6, 10, 14],
  [4, 12],
];

export const SECTION_ORDER: readonly MusicSectionName[] = [
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
  progressionC: number[];
  progressionD: number[];
  bassRiffA: BassHit[];
  bassRiffB: BassHit[];
  bassRiffC: BassHit[];
  bassRiffD: BassHit[];
  motif: MusicMotif;
  hook: MusicMotif;
};

export type MusicPattern = {
  cue: MusicCue;
  seed: number;
  missionIndex: number;
  biome?: BiomeName;
  missionKind?: MissionKind;
  bpm: number;
  swing: number;
  bars: number;
  steps: number;
  rootHz: number;
  rootMidi: number;
  scaleName: string;
  cutoff: number;
  style: MusicStyleProfile;
  bassType: MusicVoiceType;
  arpType: MusicVoiceType;
  melodyType: MusicVoiceType;
  counterType: MusicVoiceType;
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
