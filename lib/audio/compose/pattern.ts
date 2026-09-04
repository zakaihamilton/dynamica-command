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
  type MusicPulseRole,
  type MusicStyleName,
  MUSIC_BARS,
  MUSIC_STEPS,
  STEPS_PER_BAR,
  BARS_PER_SECTION,
  VERSE_CONTOURS,
  VERSE_RHYTHMS,
  SIGNATURE_CONTOURS,
  SIGNATURE_RHYTHMS,
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
import { musicMissionContext } from "./missionContext";

function pulseStepsFor(role: MusicPulseRole, stride: number): number[] {
  if (role === "none") return [];
  if (stride === 1) {
    const dense: number[] = [];
    for (let i = 0; i < STEPS_PER_BAR; i += 1) dense.push(i);
    return dense;
  }
  if (role === "offbeat") return [2, 6, 10, 14];
  if (role === "stab") return stride >= 4 ? [0, 8] : [0, 6, 8, 12];
  const steps: number[] = [];
  for (let i = 0; i < STEPS_PER_BAR; i += stride) steps.push(i);
  return steps;
}

function placeStylePercussion(
  drums: MusicDrumEvent[],
  origin: number,
  name: MusicStyleName,
  drumGain: number,
  dropHats: boolean,
): void {
  if (name === "break-wire" || name === "disco-command" || name === "dune-cipher") {
    if (!dropHats) {
      for (const step of [2, 6, 10, 14]) drumEvent(drums, origin + step, "shaker", 0.28 * drumGain);
    }
  }
  if (name === "break-wire" || name === "dune-cipher") {
    for (const step of [3, 11]) drumEvent(drums, origin + step, "rim", 0.34 * drumGain);
  }
  if (name === "disco-command") {
    drumEvent(drums, origin + 10, "rim", 0.3 * drumGain);
  }
}

function makeSections(): MusicSection[] {
  return SECTION_ORDER.map((name, index) => ({
    name,
    startBar: index * BARS_PER_SECTION,
    endBar: index * BARS_PER_SECTION + BARS_PER_SECTION,
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

function signatureMotifFrom(rng: Rng): MusicMotif {
  return motifFrom(rng, SIGNATURE_CONTOURS, SIGNATURE_RHYTHMS);
}

function nearestMelodyMidi(
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

function voiceLeadPad(
  rootMidi: number,
  scale: readonly number[],
  chord: number,
  previous: readonly number[] | null,
): [number, number, number, number] {
  const target = [0, 1, 2, 3].map((tone) => chordToneMidi(rootMidi, scale, chord, tone, 1));
  if (!previous) return target as [number, number, number, number];
  return target.map((midi, index) => {
    const prior = previous[index] ?? midi;
    return [midi - 12, midi, midi + 12].sort(
      (a, b) => Math.abs(a - prior) - Math.abs(b - prior),
    )[0] ?? midi;
  }) as [number, number, number, number];
}

function smoothMelodyLine(events: MusicNoteEvent[]): void {
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
  const developmentMotif = motifFrom(melodyRng, VERSE_CONTOURS, VERSE_RHYTHMS);
  const hook = signatureMotifFrom(melodyRng);
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
  const context = musicMissionContext(seed, missionIndex);
  let previousMelodyMidi: number | null = null;
  let previousPadVoicing: readonly number[] | null = null;

  for (let bar = 0; bar < MUSIC_BARS; bar++) {
    const sectionIndex = Math.floor(bar / BARS_PER_SECTION);
    const section = sections[sectionIndex]!;
    const arrangement = style.arrangement;
    const origin = bar * STEPS_PER_BAR;
    const phraseBar = bar % BARS_PER_SECTION;
    const halfPhrase = phraseBar % 8;
    const cycle = Math.floor(bar / (BARS_PER_SECTION * 2)) % 4;
    const recurringHookSection = section.name === "hook" || section.name === "climax" || section.name === "turnaround";
    const progression = recurringHookSection
      ? progressionC
      : [progressionA, progressionB, progressionC, progressionD][cycle]!;
    const riff = [bassRiffA, bassRiffB, bassRiffC, bassRiffD][cycle]!;
    const arpFigure = [arpFigureA, arpFigureB, arpFigureC, arpFigureD][cycle]!;
    const openHatSteps = [openHatA, openHatB, openHatC, openHatD][cycle]!;
    const fill = halfPhrase === 7;
    const intro = section.name === "intro";
    const breakdown = section.name === "breakdown";
    const climax = section.name === "climax";
    const hookSection = section.name === "hook" || section.name === "turnaround" || climax;
    if (phraseBar === 0 && recurringHookSection) previousMelodyMidi = null;
    const holdBass = arrangement.holdBass[sectionIndex]!;
    const energy = section.energy;
    const thinBar = halfPhrase === 2 || halfPhrase === 3;
    const liftBar = halfPhrase === 4 || halfPhrase === 5;
    const dropTexture = formRng.next() < (climax || hookSection ? 0.06 : 0.18);
    const miniRoll = formRng.next();
    const miniFill = !sparse && thinBar && halfPhrase === 3 && !intro && !holdBass && miniRoll < 0.3;
    const dropHats = thinBar && dropTexture && !hookSection;
    const dropPulse = thinBar && dropTexture && !hookSection;
    const denseBar = cue === "victory" && section.name === "climax"
      ? true
      : bar === MUSIC_BARS - 1 || drumRng.next() < Math.min(0.86, style.drumDensity * arrangement.drumDensity[sectionIndex]!);
    const hole = holdBass && phraseBar < 8;
    const fullDrums = !sparse && denseBar && (cue === "victory" || (!hole && (!intro || phraseBar >= 4)));
    const phraseEnd = phraseBar === 7 || phraseBar === 15;
    const lightDrums = sparse && !hole && (!intro || phraseBar >= 4) && (phraseBar % 2 === 0 || phraseEnd);
    let usePulse = arrangement.pulseEnabled[sectionIndex]!;
    if (intro && phraseBar < 4) usePulse = false;
    if (hole) usePulse = false;
    if (dropPulse) usePulse = false;
    const phraseSlot = phraseBar % 4;
    const response = phraseSlot === 1 || phraseSlot === 2;
    const restBar = section.name === "breakdown" && phraseSlot === 3;
    const useHookLead =
      hookSection ||
      (intro && phraseBar >= 12) ||
      (breakdown && phraseBar >= 8) ||
      (section.name === "escalation" && phraseBar >= 8);
    const echoBar = arrangement.echoMelody && section.name === "groove" && phraseBar % 2 === 0;
    const useMelody =
      arrangement.melodyEnabled[sectionIndex] &&
      !restBar &&
      !echoBar &&
      (section.name === "groove" ||
        section.name === "development" ||
        section.name === "escalation" ||
        hookSection ||
        (intro && phraseBar >= 8) ||
        (breakdown && phraseBar >= 8));
    const useCounter = !sparse && arrangement.counterEnabled[sectionIndex]! && (useMelody || echoBar);
    const sequenceOffset = hookSection ? 0 : liftBar ? 2 : 0;
    const sequenceOctave = climax && style.melodyOctave === 1 ? 2 : style.melodyOctave;
    const variant = (climax
      ? 0
      : section.name === "development"
        ? 1
        : section.name === "escalation" && !useHookLead
          ? 1
          : 0) + arrangement.melodyDegreeOffset + sequenceOffset;
    const chord = phraseEnd ? 0 : progression[Math.floor(phraseBar / 2)] ?? 0;

    const padVoicing = voiceLeadPad(rootMidi, scalePick.notes, chord, previousPadVoicing);
    previousPadVoicing = padVoicing;
    padRoot.push(midiToHz(padVoicing[0]));
    padThird.push(midiToHz(padVoicing[1]));
    padFifth.push(midiToHz(padVoicing[2]));
    padSeventh.push(midiToHz(padVoicing[3]));

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

    if (usePulse && style.pulseRole !== "none") {
      const sectionPulseStride = arrangement.pulseStrides[sectionIndex]!;
      const pulseStride = climax && !sparse
        ? 1
        : hole || (sparse && cue === "defeat")
          ? 4
          : hookSection && sectionPulseStride === 1
            ? 2
            : sectionPulseStride;
      for (const i of pulseStepsFor(style.pulseRole, pulseStride)) {
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
          style.pulseRole === "stab" ? 3 : 1,
          mixEnergy(velocity, energy),
          i % 4 === 0,
        );
      }
    }

    const stepShift = bar % 2 === 1 ? style.rhythmShift + arrangement.rhythmOffset : arrangement.rhythmOffset;
    if (useMelody) {
      const lead = useHookLead
        ? hook
        : section.name === "development" || (phraseBar >= 8 && !intro)
          ? developmentMotif
          : motif;
      const velocity = mixEnergy(climax ? 0.96 : hookSection ? 0.86 : 0.74, energy);
      const durationFor = (index: number, sounding: number) => {
        if (useHookLead) return index === sounding - 1 ? 3 : 4;
        return liftBar ? 3 : 2;
      };
      previousMelodyMidi = placeMelody(
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
        climax ? notes.counter : null,
        phraseEnd,
        previousMelodyMidi,
        hookSection ? 0 : stepShift,
      );
    }

    if (echoBar && phraseBar > 0) {
      previousMelodyMidi = placeMelody(
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
        null,
        false,
        previousMelodyMidi,
        stepShift + 2,
      );
    }

    if (useCounter) {
      const lead = useHookLead
        ? hook
        : section.name === "development" || (phraseBar >= 8 && !intro)
          ? developmentMotif
          : motif;
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
      const grooveVariantNow = ((bar >= MUSIC_BARS / 2 ? style.grooveVariant + 1 : style.grooveVariant) % 3) as 0 | 1 | 2;
      const hits = grooveHits(groove, cycle % 2 as 0 | 1, grooveVariantNow);
      const drumGain = mixEnergy(fullDrums ? 1 : 0.58, energy);
      for (const step of hits.kick) drumEvent(drums, origin + step, "kick", (step === 0 ? 0.95 : 0.72) * drumGain, step === 0);
      for (const step of hits.snare) {
        const accent = step === 4 || step === 12;
        drumEvent(drums, origin + step, "snare", (accent ? 0.9 : 0.62) * drumGain, accent);
        if (!sparse && !hole) drumEvent(drums, origin + step, "clap", (accent ? 0.76 : 0.48) * drumGain, accent);
      }
      const hatStride = sparse
        ? Math.max(2, dropHats ? 4 : arrangement.hatStride[sectionIndex]!)
        : climax ? 2 : dropHats ? 4 : arrangement.hatStride[sectionIndex]!;
      for (let step = 0; step < STEPS_PER_BAR; step += hatStride) {
        const offbeat = climax ? step % 2 === 1 : step % 4 === 2;
        drumEvent(drums, origin + step, "hat", (offbeat ? 0.36 : 0.26) * drumGain);
      }
      if (!sparse && !hole && !dropHats) {
        for (const step of openHatSteps) drumEvent(drums, origin + step, "openHat", 0.44 * drumGain);
      }
      if (!sparse) placeStylePercussion(drums, origin, style.name, drumGain, dropHats);
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
    developmentMotif,
    hook,
  };

  smoothMelodyLine(notes.melody);

  return {
    cue,
    seed,
    missionIndex,
    biome: context.biome,
    missionKind: context.missionKind,
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
