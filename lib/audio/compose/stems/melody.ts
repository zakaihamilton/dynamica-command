import { noteEvent, scaleToneMidi } from "../helpers";
import { BARS_PER_SECTION, STEPS_PER_BAR, type MusicMotif, type MusicNoteEvent } from "../types";

export function nearestMelodyMidi(
  rootMidi: number,
  scale: readonly number[],
  chord: number,
  degree: number,
  octave: number,
  previousMidi: number | null,
): number {
  const target = scaleToneMidi(rootMidi, scale, chord, degree, octave);
  if (previousMidi === null) return target;
  const candidates = [target - 12, target, target + 12];
  const comfortable = candidates.filter((candidate) => Math.abs(candidate - previousMidi) <= 7);
  const bounded = comfortable.length > 0
    ? comfortable
    : candidates.filter((candidate) => Math.abs(candidate - previousMidi) <= 12);
  return [...(bounded.length > 0 ? bounded : candidates)].sort((a, b) => {
    const previousDelta = Math.abs(a - previousMidi) - Math.abs(b - previousMidi);
    return previousDelta === 0 ? Math.abs(a - target) - Math.abs(b - target) : previousDelta;
  })[0] ?? target;
}

export function smoothMelodyLine(events: MusicNoteEvent[]): void {
  const ordered = [...events].sort((a, b) => a.step - b.step);
  let previous: number | null = null;
  let previousSection = -1;
  let sectionOctaveShift = 0;
  for (const event of ordered) {
    const section = Math.floor(event.step / (BARS_PER_SECTION * STEPS_PER_BAR));
    if (section !== previousSection) {
      sectionOctaveShift = 0;
      if (previous !== null) {
        while (event.midi + sectionOctaveShift - previous > 12) sectionOctaveShift -= 12;
        while (previous - (event.midi + sectionOctaveShift) > 12) sectionOctaveShift += 12;
      }
      previousSection = section;
    }
    event.midi += sectionOctaveShift;
    if (previous !== null) {
      while (event.midi - previous > 12) event.midi -= 12;
      while (previous - event.midi > 12) event.midi += 12;
      if (Math.abs(event.midi - previous) > 12) {
        event.midi = previous + (event.midi > previous ? 12 : -12);
      }
    }
    previous = event.midi;
  }
}

export function placeMelody(
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
  harmonyNotes: MusicNoteEvent[] | null,
  cadence: boolean,
  previousMidi: number | null,
  stepShift = 0,
): number | null {
  const degrees = response ? motif.response : motif.degrees;
  const placements = degrees
    .map((degree, index) => {
      if (degree === null) return null;
      const motifStep = ((motif.rhythm[index] ?? index * 2) + stepShift) % STEPS_PER_BAR;
      if (motifStep < 0 || motifStep >= STEPS_PER_BAR) return null;
      return { degree, index, motifStep };
    })
    .filter((placement): placement is { degree: number; index: number; motifStep: number } => placement !== null)
    .sort((a, b) => a.motifStep - b.motifStep);
  let placed = 0;
  let lastMidi: number | null = previousMidi;
  for (const placement of placements) {
    const isLastSounding = placed === placements.length - 1;
    const melodicDegree = cadence && isLastSounding ? 0 : placement.degree + variant;
    const midi = nearestMelodyMidi(rootMidi, scale, chord, melodicDegree, octave, lastMidi);
    const duration = durationFor(placed, placements.length);
    noteEvent(notes, origin + placement.motifStep, midi, duration, velocity, motif.accentSteps.includes(placement.index));
    if (harmony && harmonyNotes) {
      noteEvent(
        harmonyNotes,
        origin + placement.motifStep,
        scaleToneMidi(rootMidi, scale, chord, melodicDegree + 2, octave),
        duration,
        velocity * 0.7,
      );
    }
    lastMidi = midi;
    placed += 1;
  }
  return lastMidi;
}

export function placeCounter(
  notes: MusicNoteEvent[],
  melody: MusicNoteEvent[],
  origin: number,
  motif: MusicMotif,
  response: boolean,
  rootMidi: number,
  scale: readonly number[],
  chord: number,
  variant: number,
  octave: number,
  interval: number,
  stepShift: number,
  duration: number,
  velocity: number,
): void {
  const degrees = response ? motif.response : motif.degrees;
  for (let i = 0; i < degrees.length; i++) {
    const degree = degrees[i];
    if (degree === null) continue;
    const motifStep = ((motif.rhythm[i] ?? i * 2) + stepShift) % STEPS_PER_BAR;
    if (motifStep % 2 === 1 || motifStep >= STEPS_PER_BAR) continue;
    const midi = scaleToneMidi(rootMidi, scale, chord, degree + variant + interval, octave);
    const step = origin + motifStep;
    if (melody.some((lead) => lead.step === step && lead.midi === midi)) continue;
    noteEvent(notes, step, midi, duration, velocity);
  }
}
