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
  pickCycle,
  mixEnergy,
  placePhraseFill,
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

function placeCounter(
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

export function composeMusic(seed: number, cue: MusicCue, missionIndex = 0): MusicPattern {
  const rng = createRng(seed, musicLabel(cue, missionIndex));
  const style = createMusicStyle(cue, styleRng(seed, cue, missionIndex), seed, missionIndex);
  const harmonyRng = rng.fork("harmony");
  const melodyRng = rng.fork("melody");
  const rhythmRng = rng.fork("rhythm");
  const drumRng = rng.fork("drums");
  const textureRng = rng.fork("texture");
  const formRng = rng.fork("form");
  const scalePick = scaleFor(cue, harmonyRng, style);
  const rootMidi = cue === "defeat"
    ? harmonyRng.intRange(33, 40)
    : harmonyRng.intRange(36, 46);
  const groove = style.groove;
  const progressions = progressionsFor(scalePick.name, style.progressionVariant);
  const [progressionA, progressionB, progressionC, progressionD] = pickCycle(harmonyRng, progressions);
  const bassRiffs = bassRiffsFor(style.bassRiffFamily);
  const [bassRiffA, bassRiffB, bassRiffC, bassRiffD] = pickCycle(harmonyRng, bassRiffs);
  const motif = motifFrom(melodyRng, VERSE_CONTOURS, VERSE_RHYTHMS);
  const hook = motifFrom(melodyRng, HOOK_CONTOURS, HOOK_RHYTHMS);
  const [arpFigureA, arpFigureB, arpFigureC, arpFigureD] = pickCycle(rhythmRng, ARP_FIGURES);
  const [openHatA, openHatB, openHatC, openHatD] = pickCycle(drumRng, OPEN_HAT_FIGURES);
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
    const cycle = Math.floor(bar / 16) % 4;
    const progression = [progressionA, progressionB, progressionC, progressionD][cycle]!;
    const riff = [bassRiffA, bassRiffB, bassRiffC, bassRiffD][cycle]!;
    const arpFigure = [arpFigureA, arpFigureB, arpFigureC, arpFigureD][cycle]!;
    const openHatSteps = [openHatA, openHatB, openHatC, openHatD][cycle]!;
    const fill = phraseBar === 7;
    const intro = section.name === "intro";
    const breakdown = section.name === "breakdown";
    const climax = section.name === "climax";
    const hookSection = section.name === "hook" || section.name === "turnaround" || climax;
    const holdBass = arrangement.holdBass[sectionIndex]!;
    const energy = section.energy;
    const thinBar = phraseBar === 2 || phraseBar === 3;
    const liftBar = phraseBar === 4 || phraseBar === 5;
    const dropTexture = formRng.next() < (climax || hookSection ? 0.1 : 0.42);
    const miniRoll = formRng.next();
    const miniFill = thinBar && phraseBar === 3 && !intro && !holdBass && miniRoll < 0.55;
    const dropHats = thinBar && dropTexture && !hookSection;
    const dropPulse = thinBar && dropTexture && !hookSection;
    const denseBar = cue === "victory" || drumRng.next() < Math.min(1, style.drumDensity * arrangement.drumDensity[sectionIndex]!);
    const hole = holdBass;
    const fullDrums = !sparse && denseBar && (cue === "victory" || (!hole && (!intro || phraseBar >= 4)));
    const lightDrums = sparse && !hole && (!intro || phraseBar >= 4);
    let usePulse = arrangement.pulseEnabled[sectionIndex]!;
    if (intro && phraseBar < 4) usePulse = false;
    if (hole && phraseBar < 6) usePulse = false;
    if (dropPulse) usePulse = false;
    const phraseSlot = phraseBar % 4;
    const response = phraseSlot === 1 || phraseSlot === 2;
    const restBar = !hookSection && phraseSlot === 3 && section.name !== "escalation";
    const useHookLead =
      hookSection ||
      (intro && phraseBar >= 6) ||
      (breakdown && phraseBar >= 4) ||
      (section.name === "escalation" && phraseBar >= 4);
    const echoBar = arrangement.echoMelody && section.name === "groove" && phraseBar % 2 === 0;
    const useMelody =
      arrangement.melodyEnabled[sectionIndex] &&
      !restBar &&
      !echoBar &&
      (section.name === "groove" ||
        section.name === "development" ||
        section.name === "escalation" ||
        hookSection ||
        (intro && phraseBar >= 6) ||
        (breakdown && phraseBar >= 4));
    const useCounter = !sparse && arrangement.counterEnabled[sectionIndex]! && (useMelody || echoBar);
    const sequenceOffset = liftBar ? 2 : 0;
    const sequenceOctave = liftBar && style.melodyOctave === 1 ? 2 : style.melodyOctave;
    const variant = (climax
      ? 0
      : section.name === "development"
        ? 1
        : section.name === "escalation" && !useHookLead
          ? 1
          : 0) + arrangement.melodyDegreeOffset + sequenceOffset;
    const chord = progression[phraseBar] ?? 0;

    padRoot.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 0, 1)));
    padThird.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 1, 1)));
    padFifth.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 2, 1)));
    padSeventh.push(midiToHz(chordToneMidi(rootMidi, scalePick.notes, chord, 3, 1)));

    const sectionBassStride = arrangement.bassStrides[sectionIndex]!;
    const bassStride = holdBass ? 8 : intro ? Math.max(4, sectionBassStride) as 4 | 8 : sectionBassStride;
    if (holdBass) {
      noteEvent(notes.bass, origin, chordToneMidi(rootMidi, scalePick.notes, chord, 0, -1), 8, mixEnergy(0.58, energy), true);
      if (bar % 2 === 1) noteEvent(notes.bass, origin + 8, chordToneMidi(rootMidi, scalePick.notes, chord, 0, 0), 6, mixEnergy(0.46, energy));
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
          mixEnergy(i === 0 || i === 4 ? 0.92 : 0.7, energy),
          i === 0 || i === 4,
        );
      }
    }

    if (usePulse) {
      const sectionPulseStride = arrangement.pulseStrides[sectionIndex]!;
      const pulseStride = climax
        ? 1
        : hole || (sparse && cue === "defeat")
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
          mixEnergy(velocity, energy),
          i % 4 === 0,
        );
      }
    }

    const stepShift = bar % 2 === 1 ? style.rhythmShift + arrangement.rhythmOffset : arrangement.rhythmOffset;
    if (useMelody) {
      const lead = useHookLead ? hook : motif;
      const velocity = mixEnergy(climax ? 0.96 : hookSection ? 0.86 : 0.74, energy);
      const durationFor = (index: number, sounding: number) => {
        if (useHookLead) return index === sounding - 1 ? 3 : 4;
        return liftBar ? 3 : 2;
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
        sequenceOctave,
        durationFor,
        velocity,
        climax,
        stepShift,
      );
    }

    if (echoBar && phraseBar > 0) {
      placeMelody(
        notes.melody,
        origin,
        motif,
        false,
        rootMidi,
        scalePick.notes,
        chord,
        variant,
        sequenceOctave,
        () => 2,
        mixEnergy(0.48, energy),
        false,
        stepShift + 2,
      );
    }

    if (useCounter) {
      const lead = useHookLead ? hook : motif;
      const interval = climax ? 5 : hookSection ? 2 : 5;
      const counterOctave = 1;
      placeCounter(
        notes.counter,
        notes.melody,
        origin,
        lead,
        response,
        rootMidi,
        scalePick.notes,
        chord,
        variant,
        counterOctave,
        interval,
        stepShift,
        climax ? 4 : 2,
        mixEnergy(climax ? 0.5 : 0.25 + style.counterChance * 0.2, energy),
      );
    }

    if (fullDrums || lightDrums) {
      const hits = grooveHits(groove, cycle % 2 as 0 | 1, style.grooveVariant);
      const drumGain = mixEnergy(fullDrums ? 1 : 0.58, energy);
      for (const step of hits.kick) drumEvent(drums, origin + step, "kick", (step === 0 ? 0.95 : 0.72) * drumGain, step === 0);
      for (const step of hits.snare) {
        const accent = step === 4 || step === 12;
        drumEvent(drums, origin + step, "snare", (accent ? 0.9 : 0.62) * drumGain, accent);
        if (!hole) drumEvent(drums, origin + step, "clap", (accent ? 0.76 : 0.48) * drumGain, accent);
      }
      const hatStride = climax ? 1 : dropHats ? 4 : arrangement.hatStride[sectionIndex]!;
      for (let step = 0; step < STEPS_PER_BAR; step += hatStride) {
        const offbeat = climax ? step % 2 === 1 : step % 4 === 2;
        drumEvent(drums, origin + step, "hat", (offbeat ? 0.28 : 0.2) * drumGain);
      }
      if (!hole && !dropHats) {
        for (const step of openHatSteps) drumEvent(drums, origin + step, "openHat", 0.44 * drumGain);
      }
    }

    if ((section.name === "escalation" || climax) && phraseBar === 0) {
      drumEvent(drums, origin, "impact", mixEnergy(climax ? 0.9 : 0.62, energy), true);
    }

    if (miniFill) {
      placePhraseFill(drums, origin, arrangement.fillStyle[sectionIndex]!, { sparse, finalBar: false, mini: true });
    }

    if (fill) {
      placePhraseFill(drums, origin, arrangement.fillStyle[sectionIndex]!, {
        sparse: sparse || (hole && cue !== "victory"),
        finalBar: bar === MUSIC_BARS - 1,
        mini: false,
      });
    }
  }

  const theme: MusicTheme = {
    rootMidi,
    scale: [...scalePick.notes],
    scaleName: scalePick.name,
    groove,
    progressionA: [...progressionA],
    progressionB: [...progressionB],
    progressionC: [...progressionC],
    progressionD: [...progressionD],
    bassRiffA: [...bassRiffA],
    bassRiffB: [...bassRiffB],
    bassRiffC: [...bassRiffC],
    bassRiffD: [...bassRiffD],
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
