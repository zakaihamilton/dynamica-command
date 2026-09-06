import type {
  MusicBassRiffFamily,
  MusicDrumKit,
  MusicDrumProfile,
  MusicGroove,
  MusicPulseRole,
  MusicScaleName,
  MusicStyleName,
  MusicVoiceEngine,
  MusicVoiceType,
} from "../types";

export type Range = readonly [number, number];

export type StyleBlueprint = {
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
  voiceEngine: MusicVoiceEngine;
  drumKit: MusicDrumKit;
  pulseRole: MusicPulseRole;
  saturation: Range;
  drum: MusicDrumProfile;
};
