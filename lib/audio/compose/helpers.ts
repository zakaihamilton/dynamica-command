import type { Rng } from "../../seed/rng";
import {
  type MusicCue,
  type MusicDrumKind,
  type MusicDrumEvent,
  type MusicGroove,
  type MusicNoteEvent,
  type MusicSectionName,
  MUSIC_STEPS,
  TUTORIAL_MUSIC_MISSION,
  NATURAL_MINOR,
  DORIAN,
  MIXOLYDIAN,
  MAJOR,
  MINOR_PROGRESSIONS,
  MAJOR_PROGRESSIONS,
  MIXOLYDIAN_PROGRESSIONS,
} from "./types";

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function musicLabel(cue: MusicCue, missionIndex: number): string {
  if (missionIndex === TUTORIAL_MUSIC_MISSION) return "music:tutorial";
  return `music:${cue}:${missionIndex}`;
}

export function bpmFor(cue: MusicCue, roll: number, missionIndex: number): number {
  const mission = Math.max(0, missionIndex);
  if (cue === "menu") return 112 + (roll % 13);
  if (cue === "briefing") return 104 + (roll % 13);
  if (cue === "mission") return 118 + ((roll + mission) % 11);
  if (cue === "victory") return 124 + (roll % 9);
  return 88 + (roll % 11);
}

export function scaleFor(cue: MusicCue, rng: Rng): { notes: readonly number[]; name: string } {
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

export function grooveFor(cue: MusicCue, rng: Rng): MusicGroove {
  if (cue === "defeat") return "march";
  if (cue === "victory") return rng.pick(["march", "pulse"]);
  return rng.pick(["pulse", "march"]);
}

export function progressionsFor(scaleName: string): readonly number[][] {
  if (scaleName === "major") return MAJOR_PROGRESSIONS;
  if (scaleName === "mixolydian") return MIXOLYDIAN_PROGRESSIONS;
  return MINOR_PROGRESSIONS;
}

export function grooveHits(groove: MusicGroove, variation: 0 | 1): { kick: number[]; snare: number[] } {
  if (groove === "pulse") {
    return variation === 0
      ? { kick: [0, 4, 8, 12], snare: [4, 12] }
      : { kick: [0, 4, 8, 10, 12], snare: [4, 12] };
  }
  return variation === 0
    ? { kick: [0, 8], snare: [4, 12] }
    : { kick: [0, 6, 8], snare: [4, 12] };
}

export function sectionEnergy(name: MusicSectionName): number {
  if (name === "intro" || name === "breakdown") return 0.24;
  if (name === "groove") return 0.55;
  if (name === "hook") return 0.72;
  if (name === "development") return 0.62;
  if (name === "escalation") return 0.78;
  if (name === "climax") return 1;
  return 0.86;
}

export function isSparseCue(cue: MusicCue): boolean {
  return cue === "menu" || cue === "briefing" || cue === "defeat";
}

export function pickDifferent<T>(rng: Rng, options: readonly T[], current: T): T {
  if (options.length < 2) return current;
  let next = rng.pick(options);
  while (next === current) next = rng.pick(options);
  return next;
}

export function wrapDegree(scale: readonly number[], degree: number): number {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return scale[idx]! + oct * 12;
}

export function chordToneMidi(rootMidi: number, scale: readonly number[], chord: number, tone: number, octave: number): number {
  return rootMidi + wrapDegree(scale, chord + tone * 2) + octave * 12;
}

export function scaleToneMidi(rootMidi: number, scale: readonly number[], chord: number, offset: number, octave: number): number {
  return rootMidi + wrapDegree(scale, chord + offset) + octave * 12;
}

export function noteEvent(
  notes: MusicNoteEvent[],
  step: number,
  midi: number,
  duration: number,
  velocity: number,
  accent = false,
): void {
  notes.push({ step, midi, duration, velocity, ...(accent ? { accent: true } : {}) });
}

export function drumEvent(drums: MusicDrumEvent[], step: number, kind: MusicDrumKind, velocity: number, accent = false): void {
  drums.push({ step, kind, velocity, ...(accent ? { accent: true } : {}) });
}

export function legacyNotes(events: MusicNoteEvent[]): (number | null)[] {
  const lane = Array.from({ length: MUSIC_STEPS }, () => null as number | null);
  for (const event of events) lane[event.step] = midiToHz(event.midi);
  return lane;
}

export function legacyHits(drums: MusicDrumEvent[], kind: MusicDrumKind): boolean[] {
  const lane = Array.from({ length: MUSIC_STEPS }, () => false);
  for (const event of drums) {
    if (event.kind === kind) lane[event.step] = true;
  }
  return lane;
}
