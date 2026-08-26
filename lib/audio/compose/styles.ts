import { createRng, type Rng } from "../../seed/rng";
import { BASS_RIFFS } from "./types";
import type {
  BassHit,
  MusicArrangementProfile,
  MusicBassRiffFamily,
  MusicCue,
  MusicDrumProfile,
  MusicGroove,
  MusicScaleName,
  MusicStyleName,
  MusicStyleProfile,
  MusicVoiceType,
} from "./types";

type Range = readonly [number, number];

type StyleBlueprint = {
  name: MusicStyleName;
  scales: readonly MusicScaleName[];
  grooves: readonly MusicGroove[];
  grooveVariants: readonly (0 | 1 | 2)[];
  progressionVariants: readonly (0 | 1 | 2 | 3)[];
  bassRiffFamily: MusicBassRiffFamily;
  tempoBias: Range;
  swing: Range;
  bassTypes: readonly MusicVoiceType[];
  pulseTypes: readonly MusicVoiceType[];
  melodyTypes: readonly MusicVoiceType[];
  counterTypes: readonly MusicVoiceType[];
  padTypes: readonly MusicVoiceType[];
  padDetunes: readonly (readonly [number, number, number, number])[];
  padLfoRate: Range;
  padLfoDepth: Range;
  padQ: Range;
  delayBeats: readonly number[];
  delayFeedback: Range;
  delayWet: Range;
  reverbSeconds: Range;
  reverbDecay: Range;
  reverbSend: Range;
  reverbWet: Range;
  cutoff: Range;
  bassStrides: readonly (2 | 4 | 8)[];
  pulseStrides: readonly (1 | 2 | 4)[];
  melodyOctaves: readonly (1 | 2)[];
  rhythmShifts: readonly (0 | 1 | 2)[];
  counterChance: Range;
  drumDensity: Range;
  drum: MusicDrumProfile;
};

const STYLE_BLUEPRINTS: readonly StyleBlueprint[] = [
  {
    name: "neon-arpeggio",
    scales: ["major", "mixolydian", "dorian"],
    grooves: ["pulse"],
    grooveVariants: [0, 1],
    progressionVariants: [0, 1],
    bassRiffFamily: "restless",
    tempoBias: [-1, 3],
    swing: [0.008, 0.026],
    bassTypes: ["sawtooth", "square"],
    pulseTypes: ["square", "sawtooth"],
    melodyTypes: ["sawtooth", "square"],
    counterTypes: ["triangle", "sine"],
    padTypes: ["sawtooth", "square"],
    padDetunes: [[-7, -15, 11, 5], [-4, -11, 8, 3]],
    padLfoRate: [0.42, 0.66],
    padLfoDepth: [120, 210],
    padQ: [0.7, 1.1],
    delayBeats: [0.5, 0.75, 1],
    delayFeedback: [0.22, 0.34],
    delayWet: [0.2, 0.32],
    reverbSeconds: [0.8, 1.25],
    reverbDecay: [2.1, 2.8],
    reverbSend: [0.16, 0.24],
    reverbWet: [0.16, 0.25],
    cutoff: [720, 1220],
    bassStrides: [2],
    pulseStrides: [1, 2],
    melodyOctaves: [2],
    rhythmShifts: [0, 1],
    counterChance: [0.52, 0.8],
    drumDensity: [0.92, 1],
    drum: {
      kickStart: 188, kickEnd: 42, kickTail: 0.16,
      snareBody: 210, snareNoise: 1900, hatFrequency: 7200, openHatFrequency: 3300,
      tomStart: 180, tomEnd: 110, impactStart: 108, impactEnd: 31, noisePan: -0.08,
    },
  },
  {
    name: "industrial-march",
    scales: ["natural minor", "dorian"],
    grooves: ["march"],
    grooveVariants: [0, 2],
    progressionVariants: [1, 3],
    bassRiffFamily: "industrial",
    tempoBias: [-2, 1],
    swing: [0.002, 0.014],
    bassTypes: ["square", "sawtooth"],
    pulseTypes: ["square", "triangle"],
    melodyTypes: ["sawtooth", "triangle"],
    counterTypes: ["triangle", "square"],
    padTypes: ["sawtooth", "triangle"],
    padDetunes: [[-9, -17, 14, 6], [-6, -13, 10, 4]],
    padLfoRate: [0.28, 0.48],
    padLfoDepth: [90, 160],
    padQ: [0.9, 1.4],
    delayBeats: [0.5, 0.75],
    delayFeedback: [0.16, 0.27],
    delayWet: [0.14, 0.23],
    reverbSeconds: [0.65, 1.05],
    reverbDecay: [2.6, 3.3],
    reverbSend: [0.12, 0.2],
    reverbWet: [0.13, 0.21],
    cutoff: [500, 900],
    bassStrides: [2, 4],
    pulseStrides: [2, 4],
    melodyOctaves: [1, 2],
    rhythmShifts: [0, 2],
    counterChance: [0.32, 0.58],
    drumDensity: [0.9, 1],
    drum: {
      kickStart: 204, kickEnd: 36, kickTail: 0.2,
      snareBody: 176, snareNoise: 1600, hatFrequency: 6100, openHatFrequency: 2800,
      tomStart: 160, tomEnd: 92, impactStart: 122, impactEnd: 27, noisePan: 0.02,
    },
  },
  {
    name: "acid-grid",
    scales: ["natural minor", "mixolydian", "dorian"],
    grooves: ["pulse"],
    grooveVariants: [1, 2],
    progressionVariants: [2, 3],
    bassRiffFamily: "syncopated",
    tempoBias: [1, 5],
    swing: [0.018, 0.04],
    bassTypes: ["sawtooth", "square"],
    pulseTypes: ["sawtooth", "square"],
    melodyTypes: ["square", "sawtooth"],
    counterTypes: ["square", "triangle"],
    padTypes: ["square", "sawtooth"],
    padDetunes: [[-12, -21, 17, 8], [-8, -18, 13, 6]],
    padLfoRate: [0.62, 0.95],
    padLfoDepth: [160, 280],
    padQ: [1.1, 1.8],
    delayBeats: [0.375, 0.5, 0.75],
    delayFeedback: [0.28, 0.42],
    delayWet: [0.24, 0.38],
    reverbSeconds: [0.55, 0.95],
    reverbDecay: [1.7, 2.4],
    reverbSend: [0.13, 0.22],
    reverbWet: [0.14, 0.23],
    cutoff: [850, 1450],
    bassStrides: [2],
    pulseStrides: [1],
    melodyOctaves: [2],
    rhythmShifts: [1, 2],
    counterChance: [0.44, 0.7],
    drumDensity: [0.94, 1],
    drum: {
      kickStart: 220, kickEnd: 48, kickTail: 0.13,
      snareBody: 236, snareNoise: 2350, hatFrequency: 8200, openHatFrequency: 3900,
      tomStart: 196, tomEnd: 124, impactStart: 94, impactEnd: 34, noisePan: -0.14,
    },
  },
  {
    name: "orbital-drift",
    scales: ["dorian", "major", "mixolydian"],
    grooves: ["pulse", "march"],
    grooveVariants: [0, 1],
    progressionVariants: [0, 2],
    bassRiffFamily: "sparse",
    tempoBias: [-4, 0],
    swing: [0.012, 0.032],
    bassTypes: ["sine", "triangle"],
    pulseTypes: ["sine", "triangle"],
    melodyTypes: ["triangle", "sine"],
    counterTypes: ["sine", "triangle"],
    padTypes: ["triangle", "sine"],
    padDetunes: [[-3, -8, 7, 2], [-2, -6, 5, 1]],
    padLfoRate: [0.18, 0.36],
    padLfoDepth: [70, 145],
    padQ: [0.45, 0.85],
    delayBeats: [0.75, 1, 1.5],
    delayFeedback: [0.32, 0.48],
    delayWet: [0.28, 0.42],
    reverbSeconds: [1.25, 1.8],
    reverbDecay: [2.8, 4],
    reverbSend: [0.25, 0.38],
    reverbWet: [0.24, 0.38],
    cutoff: [430, 840],
    bassStrides: [4, 8],
    pulseStrides: [2, 4],
    melodyOctaves: [1, 2],
    rhythmShifts: [0, 1],
    counterChance: [0.62, 0.9],
    drumDensity: [0.58, 0.82],
    drum: {
      kickStart: 150, kickEnd: 52, kickTail: 0.25,
      snareBody: 188, snareNoise: 1300, hatFrequency: 5100, openHatFrequency: 2400,
      tomStart: 142, tomEnd: 86, impactStart: 82, impactEnd: 24, noisePan: 0.16,
    },
  },
  {
    name: "cinematic-tension",
    scales: ["natural minor", "dorian"],
    grooves: ["march"],
    grooveVariants: [0, 1],
    progressionVariants: [1, 2],
    bassRiffFamily: "descending",
    tempoBias: [-5, -1],
    swing: [0, 0.012],
    bassTypes: ["triangle", "sawtooth"],
    pulseTypes: ["triangle", "square"],
    melodyTypes: ["sawtooth", "triangle"],
    counterTypes: ["triangle", "sine"],
    padTypes: ["triangle", "sawtooth"],
    padDetunes: [[-5, -10, 9, 3], [-7, -12, 11, 4]],
    padLfoRate: [0.22, 0.42],
    padLfoDepth: [100, 200],
    padQ: [0.7, 1.25],
    delayBeats: [0.5, 0.75, 1],
    delayFeedback: [0.2, 0.34],
    delayWet: [0.16, 0.28],
    reverbSeconds: [1.05, 1.6],
    reverbDecay: [3.1, 4.4],
    reverbSend: [0.24, 0.36],
    reverbWet: [0.22, 0.35],
    cutoff: [380, 760],
    bassStrides: [4, 8],
    pulseStrides: [4],
    melodyOctaves: [1, 2],
    rhythmShifts: [0, 2],
    counterChance: [0.7, 0.96],
    drumDensity: [0.48, 0.7],
    drum: {
      kickStart: 172, kickEnd: 38, kickTail: 0.3,
      snareBody: 202, snareNoise: 1450, hatFrequency: 5600, openHatFrequency: 2600,
      tomStart: 172, tomEnd: 96, impactStart: 116, impactEnd: 28, noisePan: -0.2,
    },
  },
  {
    name: "signal-chase",
    scales: ["mixolydian", "major", "dorian"],
    grooves: ["pulse", "march"],
    grooveVariants: [1, 2],
    progressionVariants: [2, 3],
    bassRiffFamily: "octave",
    tempoBias: [2, 6],
    swing: [0.004, 0.022],
    bassTypes: ["square", "sawtooth"],
    pulseTypes: ["square", "sawtooth"],
    melodyTypes: ["square", "sawtooth"],
    counterTypes: ["square", "triangle"],
    padTypes: ["sawtooth", "square"],
    padDetunes: [[-10, -19, 16, 7], [-6, -14, 12, 5]],
    padLfoRate: [0.52, 0.82],
    padLfoDepth: [140, 250],
    padQ: [0.9, 1.6],
    delayBeats: [0.375, 0.5, 0.75],
    delayFeedback: [0.25, 0.4],
    delayWet: [0.2, 0.34],
    reverbSeconds: [0.7, 1.15],
    reverbDecay: [2, 2.9],
    reverbSend: [0.14, 0.24],
    reverbWet: [0.14, 0.25],
    cutoff: [680, 1320],
    bassStrides: [2, 4],
    pulseStrides: [1, 2],
    melodyOctaves: [2],
    rhythmShifts: [1, 2],
    counterChance: [0.38, 0.68],
    drumDensity: [0.84, 1],
    drum: {
      kickStart: 232, kickEnd: 44, kickTail: 0.14,
      snareBody: 250, snareNoise: 2700, hatFrequency: 9000, openHatFrequency: 4200,
      tomStart: 210, tomEnd: 128, impactStart: 102, impactEnd: 36, noisePan: 0.12,
    },
  },
];

const ARRANGEMENTS: readonly MusicArrangementProfile[] = [
  {
    name: "slow-burn",
    bassStrides: [8, 8, 4, 4, 8, 4, 4, 4],
    pulseStrides: [4, 4, 2, 2, 4, 2, 2, 2],
    melodyEnabled: [false, true, true, true, false, true, true, true],
    melodyDegreeOffset: 0,
    rhythmOffset: 0,
    drumDensity: [0.45, 0.62, 0.9, 0.86, 0.3, 0.78, 1, 0.82],
  },
  {
    name: "forward-drive",
    bassStrides: [2, 2, 2, 2, 4, 2, 2, 2],
    pulseStrides: [2, 2, 2, 2, 4, 2, 1, 2],
    melodyEnabled: [false, true, true, true, false, true, true, true],
    melodyDegreeOffset: 1,
    rhythmOffset: 1,
    drumDensity: [0.78, 0.94, 1, 0.96, 0.45, 1, 1, 0.95],
  },
  {
    name: "syncopated-strike",
    bassStrides: [4, 2, 2, 2, 4, 2, 2, 2],
    pulseStrides: [2, 1, 1, 2, 4, 1, 1, 1],
    melodyEnabled: [false, true, true, true, false, true, true, true],
    melodyDegreeOffset: -1,
    rhythmOffset: 2,
    drumDensity: [0.72, 1, 0.96, 1, 0.4, 1, 1, 1],
  },
  {
    name: "ghost-signal",
    bassStrides: [8, 8, 8, 4, 8, 4, 4, 2],
    pulseStrides: [4, 4, 4, 2, 4, 2, 2, 1],
    melodyEnabled: [false, true, true, true, false, true, true, true],
    melodyDegreeOffset: 2,
    rhythmOffset: 3,
    drumDensity: [0.28, 0.42, 0.62, 0.55, 0.2, 0.58, 0.8, 0.68],
  },
  {
    name: "bass-siege",
    bassStrides: [2, 2, 2, 2, 2, 2, 2, 2],
    pulseStrides: [4, 4, 2, 2, 4, 2, 2, 1],
    melodyEnabled: [false, true, true, true, false, true, true, true],
    melodyDegreeOffset: 0,
    rhythmOffset: 0,
    drumDensity: [0.72, 0.86, 0.92, 0.9, 0.46, 0.92, 1, 0.9],
  },
  {
    name: "wide-open",
    bassStrides: [8, 4, 4, 4, 8, 4, 2, 4],
    pulseStrides: [4, 2, 2, 2, 4, 2, 1, 2],
    melodyEnabled: [false, true, true, true, false, true, true, true],
    melodyDegreeOffset: -2,
    rhythmOffset: 1,
    drumDensity: [0.4, 0.72, 0.8, 0.74, 0.3, 0.78, 0.92, 0.76],
  },
  {
    name: "panic-run",
    bassStrides: [2, 2, 2, 2, 2, 2, 2, 2],
    pulseStrides: [2, 1, 1, 1, 2, 1, 1, 1],
    melodyEnabled: [false, true, true, true, true, true, true, true],
    melodyDegreeOffset: 2,
    rhythmOffset: 2,
    drumDensity: [0.92, 1, 1, 1, 0.72, 1, 1, 1],
  },
  {
    name: "command-theme",
    bassStrides: [4, 2, 4, 2, 4, 2, 2, 2],
    pulseStrides: [2, 2, 1, 2, 4, 2, 1, 1],
    melodyEnabled: [false, true, true, true, false, true, true, true],
    melodyDegreeOffset: 1,
    rhythmOffset: 3,
    drumDensity: [0.68, 0.9, 0.86, 0.92, 0.38, 0.9, 1, 0.94],
  },
];

function arrangementFor(cue: MusicCue, seed: number, missionIndex: number): MusicArrangementProfile {
  const offset = createRng(seed, `music-arrangement-offset:${cue}`).int(ARRANGEMENTS.length);
  const index = missionIndex >= 0 && missionIndex < ARRANGEMENTS.length
    ? (missionIndex + offset) % ARRANGEMENTS.length
    : createRng(seed, `music-arrangement:${cue}:${missionIndex}`).int(ARRANGEMENTS.length);
  return ARRANGEMENTS[index]!;
}

const BASS_RIFF_FAMILIES: Record<MusicBassRiffFamily, readonly (readonly BassHit[])[]> = {
  classic: BASS_RIFFS,
  industrial: [
    [{ tone: 0, oct: 0 }, null, { tone: 0, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 0 }, null, { tone: 3, oct: 0 }, { tone: 0, oct: 1 }],
    [{ tone: 0, oct: 0 }, { tone: 0, oct: 0 }, null, { tone: 2, oct: 0 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, null, { tone: 2, oct: 0 }],
    [{ tone: 0, oct: 0 }, null, null, { tone: 2, oct: 0 }, { tone: 0, oct: 0 }, null, { tone: 1, oct: 0 }, { tone: 0, oct: 1 }],
  ],
  syncopated: [
    [{ tone: 0, oct: 0 }, null, { tone: 2, oct: 0 }, null, { tone: 0, oct: 1 }, { tone: 3, oct: 0 }, null, { tone: 2, oct: 0 }],
    [{ tone: 0, oct: 0 }, { tone: 2, oct: 0 }, null, { tone: 0, oct: 1 }, null, { tone: 3, oct: 0 }, { tone: 2, oct: 0 }, null],
    [{ tone: 0, oct: 0 }, null, { tone: 1, oct: 0 }, { tone: 2, oct: 0 }, null, { tone: 0, oct: 1 }, { tone: 3, oct: 0 }, null],
  ],
  octave: [
    [{ tone: 0, oct: 0 }, { tone: 0, oct: 1 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 }, { tone: 2, oct: 0 }, { tone: 2, oct: 1 }, { tone: 0, oct: 0 }, { tone: 0, oct: 1 }],
    [{ tone: 0, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 1 }, { tone: 2, oct: 1 }, { tone: 0, oct: 0 }, { tone: 3, oct: 0 }, { tone: 0, oct: 1 }, { tone: 2, oct: 0 }],
  ],
  sparse: [
    [{ tone: 0, oct: 0 }, null, null, { tone: 2, oct: 0 }, null, { tone: 0, oct: 1 }, null, null],
    [{ tone: 0, oct: 0 }, null, { tone: 3, oct: 0 }, null, null, { tone: 2, oct: 0 }, null, { tone: 0, oct: 1 }],
  ],
  descending: [
    [{ tone: 0, oct: 0 }, { tone: 3, oct: 0 }, { tone: 2, oct: 0 }, { tone: 1, oct: 0 }, { tone: 0, oct: 1 }, { tone: 3, oct: 0 }, { tone: 2, oct: 0 }, { tone: 0, oct: 0 }],
    [{ tone: 0, oct: 0 }, null, { tone: 3, oct: 0 }, { tone: 2, oct: 0 }, { tone: 1, oct: 0 }, null, { tone: 0, oct: 1 }, { tone: 0, oct: 0 }],
  ],
  restless: [
    [{ tone: 0, oct: 0 }, { tone: 2, oct: 0 }, null, { tone: 1, oct: 1 }, { tone: 3, oct: 0 }, { tone: 0, oct: 1 }, { tone: 2, oct: 0 }, { tone: 0, oct: 1 }],
    [{ tone: 0, oct: 0 }, null, { tone: 2, oct: 0 }, { tone: 3, oct: 0 }, { tone: 0, oct: 1 }, { tone: 1, oct: 0 }, null, { tone: 2, oct: 0 }],
  ],
};

export function bassRiffsFor(family: MusicBassRiffFamily): readonly (readonly BassHit[])[] {
  return BASS_RIFF_FAMILIES[family];
}

function rangeValue(rng: Rng, range: Range): number {
  return range[0] + rng.next() * (range[1] - range[0]);
}

function integerValue(rng: Rng, range: Range): number {
  return Math.round(rangeValue(rng, range));
}

function stylePoolFor(cue: MusicCue): readonly StyleBlueprint[] {
  if (cue === "defeat") {
    return STYLE_BLUEPRINTS.filter((style) => ["industrial-march", "cinematic-tension"].includes(style.name));
  }
  if (cue === "victory") {
    return STYLE_BLUEPRINTS.filter((style) => ["neon-arpeggio", "orbital-drift", "signal-chase"].includes(style.name));
  }
  if (cue === "briefing") {
    return STYLE_BLUEPRINTS.filter((style) => ["orbital-drift", "cinematic-tension", "neon-arpeggio"].includes(style.name));
  }
  return STYLE_BLUEPRINTS;
}

export function createMusicStyle(cue: MusicCue, rng: Rng, seed = 0, missionIndex = 0): MusicStyleProfile {
  const familyRng = rng.fork("family");
  const textureRng = rng.fork("texture");
  const blueprint = familyRng.pick(stylePoolFor(cue));
  return {
    name: blueprint.name,
    scalePool: blueprint.scales,
    groove: textureRng.pick(blueprint.grooves),
    grooveVariant: textureRng.pick(blueprint.grooveVariants),
    progressionVariant: textureRng.pick(blueprint.progressionVariants),
    bassRiffFamily: blueprint.bassRiffFamily,
    arrangement: arrangementFor(cue, seed, missionIndex),
    tempoBias: integerValue(textureRng, blueprint.tempoBias),
    swing: rangeValue(textureRng, blueprint.swing),
    bassType: textureRng.pick(blueprint.bassTypes),
    pulseType: textureRng.pick(blueprint.pulseTypes),
    melodyType: textureRng.pick(blueprint.melodyTypes),
    counterType: textureRng.pick(blueprint.counterTypes),
    padType: textureRng.pick(blueprint.padTypes),
    padDetune: textureRng.pick(blueprint.padDetunes) as [number, number, number, number],
    padLfoRate: rangeValue(textureRng, blueprint.padLfoRate),
    padLfoDepth: rangeValue(textureRng, blueprint.padLfoDepth),
    padQ: rangeValue(textureRng, blueprint.padQ),
    delayBeats: textureRng.pick(blueprint.delayBeats),
    delayFeedback: rangeValue(textureRng, blueprint.delayFeedback),
    delayWet: rangeValue(textureRng, blueprint.delayWet),
    reverbSeconds: rangeValue(textureRng, blueprint.reverbSeconds),
    reverbDecay: rangeValue(textureRng, blueprint.reverbDecay),
    reverbSend: rangeValue(textureRng, blueprint.reverbSend),
    reverbWet: rangeValue(textureRng, blueprint.reverbWet),
    cutoffMin: blueprint.cutoff[0],
    cutoffMax: blueprint.cutoff[1],
    bassStride: textureRng.pick(blueprint.bassStrides),
    pulseStride: textureRng.pick(blueprint.pulseStrides),
    melodyOctave: textureRng.pick(blueprint.melodyOctaves),
    rhythmShift: textureRng.pick(blueprint.rhythmShifts),
    counterChance: rangeValue(textureRng, blueprint.counterChance),
    drumDensity: rangeValue(textureRng, blueprint.drumDensity),
    drum: blueprint.drum,
  };
}

export function styleRng(seed: number, cue: MusicCue, missionIndex: number): Rng {
  return createRng(seed, `music-style:${cue}:${missionIndex}`);
}
