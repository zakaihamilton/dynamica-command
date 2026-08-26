import { createRng, type Rng } from "../../seed/rng";
import {
  type MusicCue,
  type MusicMotif,
  type MusicPattern,
  type MusicSection,
  type MusicStem,
  type MusicNoteEvent,
  type MusicDrumEvent,
  type MusicTheme,
  MUSIC_BARS,
  MUSIC_STEPS,
  STEPS_PER_BAR,
  VERSE_CONTOURS,
  HOOK_CONTOURS,
  VERSE_RHYTHMS,
  HOOK_RHYTHMS,
  ARP_FIGURES,
  OPEN_HAT_FIGURES,
  SECTION_ORDER,
} from "./types";
import {
  midiToHz,
  musicLabel,
  bpmFor,
  scaleFor,
  progressionsFor,
  grooveHits,
  sectionEnergy,
  isSparseCue,
  pickDifferent,
  chordToneMidi,
  scaleToneMidi,
  noteEvent,
  drumEvent,
  legacyNotes,
  legacyHits,
} from "./helpers";
import { bassRiffsFor, createMusicStyle, styleRng } from "./styles";

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
  stepShift = 0,
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
    const motifStep = ((motif.rhythm[i] ?? i * 2) + stepShift) % STEPS_PER_BAR;
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
  const style = createMusicStyle(cue, styleRng(seed, cue, missionIndex), seed, missionIndex);
  const harmonyRng = rng.fork("harmony");
  const melodyRng = rng.fork("melody");
  const rhythmRng = rng.fork("rhythm");
  const drumRng = rng.fork("drums");
  const textureRng = rng.fork("texture");
  const scalePick = scaleFor(cue, harmonyRng, style);
  const rootMidi = cue === "defeat"
    ? harmonyRng.intRange(33, 40)
    : harmonyRng.intRange(36, 46);
  const groove = style.groove;
  const progressions = progressionsFor(scalePick.name, style.progressionVariant);
  const progressionA = harmonyRng.pick(progressions);
  const progressionB = pickDifferent(harmonyRng, progressions, progressionA);
  const bassRiffs = bassRiffsFor(style.bassRiffFamily);
  const bassRiffA = harmonyRng.pick(bassRiffs);
  const bassRiffB = pickDifferent(harmonyRng, bassRiffs, bassRiffA);
  const motif = motifFrom(melodyRng, VERSE_CONTOURS, VERSE_RHYTHMS);
  const hook = motifFrom(melodyRng, HOOK_CONTOURS, HOOK_RHYTHMS);
  const arpFigureA = rhythmRng.pick(ARP_FIGURES);
  const arpFigureB = pickDifferent(rhythmRng, ARP_FIGURES, arpFigureA);
  const openHatA = drumRng.pick(OPEN_HAT_FIGURES);
  const openHatB = pickDifferent(drumRng, OPEN_HAT_FIGURES, openHatA);
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
    const sectionIndex = Math.floor(bar / 8);
    const arrangement = style.arrangement;
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
    const denseBar = cue === "victory" || drumRng.next() < Math.min(1, style.drumDensity * arrangement.drumDensity[sectionIndex]!);
    const fullDrums = !sparse && denseBar && (cue === "victory" || (!breakdown && (!intro || phraseBar >= 4)));
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
      arrangement.melodyEnabled[sectionIndex] &&
      !restBar &&
      (section.name === "groove" ||
        section.name === "development" ||
        section.name === "escalation" ||
        hookSection ||
        (intro && phraseBar >= 6) ||
        (breakdown && phraseBar >= 4));
    const useCounter = !sparse && (section.name === "development" || climax);
    const variant = (climax
      ? 0
      : section.name === "development"
        ? 1
        : section.name === "escalation" && !useHookLead
          ? 1
          : 0) + arrangement.melodyDegreeOffset;

    padRoot.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 0, 1)));
    padThird.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 1, 1)));
    padFifth.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 2, 1)));
    padSeventh.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 3, 1)));

    const sectionBassStride = arrangement.bassStrides[sectionIndex]!;
    const bassStride = breakdown ? 8 : intro ? Math.max(4, sectionBassStride) as 4 | 8 : sectionBassStride;
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
      const sectionPulseStride = arrangement.pulseStrides[sectionIndex]!;
      const pulseStride = climax
        ? 1
        : breakdown || (sparse && cue === "defeat")
          ? 4
          : hookSection && sectionPulseStride === 1
            ? 2
            : sectionPulseStride;
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
        style.melodyOctave,
        durationFor,
        velocity,
        climax,
        bar % 2 === 1 ? style.rhythmShift + arrangement.rhythmOffset : arrangement.rhythmOffset,
      );
    }

    if (useCounter && useMelody) {
      const lead = useHookLead ? hook : motif;
      const degrees = response ? lead.response : lead.degrees;
      for (let i = 0; i < degrees.length; i++) {
        const degree = degrees[i];
        if (degree === null) continue;
        const motifStep = ((lead.rhythm[i] ?? i * 2) + (bar % 2 === 1 ? style.rhythmShift + arrangement.rhythmOffset : arrangement.rhythmOffset)) % STEPS_PER_BAR;
        if (motifStep % 2 === 1 || motifStep >= STEPS_PER_BAR) continue;
        noteEvent(
          notes.counter,
          origin + motifStep,
          scaleToneMidi(rootMidi, scalePick.notes, chord, degree + variant, style.melodyOctave),
          climax ? 4 : 2,
          climax ? 0.5 : 0.25 + style.counterChance * 0.2,
        );
      }
    }

    if (fullDrums || lightDrums) {
      const hits = grooveHits(groove, secondHalf ? 1 : 0, style.grooveVariant);
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
    bpm: bpmFor(cue, textureRng.int(64), missionIndex, style),
    swing: style.swing,
    bars: MUSIC_BARS,
    steps: MUSIC_STEPS,
    rootHz: midiToHz(rootMidi),
    rootMidi,
    scaleName: scalePick.name,
    cutoff: Math.round(style.cutoffMin + textureRng.next() * (style.cutoffMax - style.cutoffMin)),
    style,
    bassType: style.bassType,
    arpType: style.pulseType,
    melodyType: style.melodyType,
    counterType: style.counterType,
    delayBeats: style.delayBeats,
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
