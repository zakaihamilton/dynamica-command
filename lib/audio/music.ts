import {
  composeMusic,
  midiToHz,
  MUSIC_BARS,
  MUSIC_STEPS,
  STEPS_PER_BAR,
  TITLE_MUSIC_SEED,
  TUTORIAL_MUSIC_MISSION,
  type MusicCue,
  type MusicDrumEvent,
  type MusicIntensity,
  type MusicNoteEvent,
  type MusicPattern,
  type MusicSectionName,
  type MusicStem,
  type MusicVoiceType,
} from "./compose";
import { getAudioContext, peekAudioContext, unlockAudioContext } from "./context";
import { AUDIO_SAMPLE_RATE } from "./constants";
import { getAudioBus, setAudioBusEnabled } from "./mixer";

export { TITLE_MUSIC_SEED, TUTORIAL_MUSIC_MISSION, type MusicCue };
export type { MusicIntensity } from "./compose";

const SAMPLE_RATE = AUDIO_SAMPLE_RATE;
const MASTER_GAIN = 0.078;
const PAD_GAIN = 0.1;
const DUCK_RATIO = 0.34;
const CROSSFADE_S = 0.55;
const SCHEDULE_AHEAD_S = 0.22;
const SCHEDULER_MS = 25;
const ATTACK_S = 0.012;
const PHRASE_STEPS = STEPS_PER_BAR * 8;
const OFFLINE_RENDER_CHUNK_S = 2.5;

const INTENSITY_MULTIPLIER: Record<MusicIntensity, number> = {
  calm: 0.82,
  engaged: 1,
  critical: 1.08,
};

type AudioGraphContext = AudioContext | OfflineAudioContext;
type PatternIndex = {
  notes: Record<MusicStem, Map<number, MusicNoteEvent[]>>;
  drums: Map<number, MusicDrumEvent[]>;
};

type MusicGraph = {
  master: GainNode;
  highpass: BiquadFilterNode;
  saturation: WaveShaperNode;
  compressor: DynamicsCompressorNode;
  bassBus: GainNode;
  rhythmBus: GainNode;
  harmonyBus: GainNode;
  pulseBus: GainNode;
  leadBus: GainNode;
  counterBus: GainNode;
  fxBus: GainNode;
  reverb: ConvolverNode;
  reverbSend: GainNode;
  reverbWet: GainNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  delayWet: GainNode;
  padGain: GainNode;
  padFilter: BiquadFilterNode;
  padOscA: OscillatorNode;
  padOscB: OscillatorNode;
  padOscC: OscillatorNode;
  padOscD: OscillatorNode;
  padLfo: OscillatorNode;
  padLfoGain: GainNode;
  padGate: GainNode;
  padBase: number;
  index: PatternIndex;
};

let enabled = true;
let ducked = false;
let paused = false;
let intensity: MusicIntensity = "calm";
let pendingIntensity: MusicIntensity | null = null;
let cue: MusicCue = "menu";
let seed = TITLE_MUSIC_SEED;
let missionIndex = 0;
let pattern: MusicPattern | null = null;
let timer: number | null = null;
let nextNoteTime = 0;
let step = 0;
let graph: MusicGraph | null = null;
let fadeGen = 0;
let noiseBuf: AudioBuffer | null = null;

export function musicCueFromPath(pathname: string): MusicCue | null {
  if (pathname.startsWith("/briefing")) return "briefing";
  if (pathname.startsWith("/play") || pathname.startsWith("/tutorial")) return "mission";
  if (pathname.startsWith("/campaign-complete")) return "victory";
  return null;
}

export function isMusicEnabled(): boolean {
  return enabled;
}

export { isAudioUnlocked } from "./context";

function masterGain(value = intensity, isDucked = ducked): number {
  return MASTER_GAIN * INTENSITY_MULTIPLIER[value] * (isDucked ? DUCK_RATIO : 1);
}

function layerMultiplier(layer: "bass" | "pulse" | "counter" | "melody" | "drums", value = intensity): number {
  if (value === "critical") return layer === "drums" ? 1.08 : 1;
  if (value === "engaged") return layer === "drums" ? 1.04 : 1;
  if (layer === "drums") return 0.88;
  if (layer === "counter") return 0.72;
  if (layer === "pulse") return 0.92;
  return 1;
}

function createSaturationCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(1024 * Float32Array.BYTES_PER_ELEMENT));
  const k = amount * 90;
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / (curve.length - 1) - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function createImpulseResponse(audio: AudioGraphContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(audio.sampleRate * seconds));
  const impulse = audio.createBuffer(2, length, audio.sampleRate);
  let state = 0x6d2b79f5;
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      const noise = ((state ^ (state >>> 14)) >>> 0) / 4294967295 * 2 - 1;
      data[i] = noise * (1 - i / data.length) ** decay * (channel === 0 ? 1 : 0.92);
    }
  }
  return impulse;
}

function getNoiseBuffer(audio: AudioGraphContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === audio.sampleRate) return noiseBuf;
  const buf = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * 0.8)), audio.sampleRate);
  const data = buf.getChannelData(0);
  let state = 0x4d595df4;
  for (let i = 0; i < data.length; i++) {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    data[i] = ((state ^ (state >>> 14)) >>> 0) / 4294967295 * 2 - 1;
  }
  noiseBuf = buf;
  return buf;
}

function createBus(audio: AudioGraphContext, parent: AudioNode, gain: number): GainNode {
  const bus = audio.createGain();
  bus.gain.setValueAtTime(gain, audio.currentTime);
  bus.connect(parent);
  return bus;
}

function indexNoteLane(events: MusicNoteEvent[]): Map<number, MusicNoteEvent[]> {
  const lane = new Map<number, MusicNoteEvent[]>();
  for (const event of events) {
    const existing = lane.get(event.step);
    if (existing) existing.push(event);
    else lane.set(event.step, [event]);
  }
  return lane;
}

function indexPattern(p: MusicPattern): PatternIndex {
  const notes = {
    bass: indexNoteLane(p.notes.bass),
    pulse: indexNoteLane(p.notes.pulse),
    melody: indexNoteLane(p.notes.melody),
    counter: indexNoteLane(p.notes.counter),
  };
  const drums = new Map<number, MusicDrumEvent[]>();
  for (const event of p.drums) {
    const events = drums.get(event.step);
    if (events) events.push(event);
    else drums.set(event.step, [event]);
  }
  return { notes, drums };
}

function createGraph(audio: AudioGraphContext, destination: AudioNode, p: MusicPattern): MusicGraph {
  const master = audio.createGain();
  const highpass = audio.createBiquadFilter();
  const saturation = audio.createWaveShaper();
  const compressor = audio.createDynamicsCompressor();
  const now = audio.currentTime;

  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(38, now);
  saturation.curve = createSaturationCurve(0.11);
  saturation.oversample = "2x";
  compressor.threshold.setValueAtTime(-17, now);
  compressor.knee.setValueAtTime(10, now);
  compressor.ratio.setValueAtTime(3.6, now);
  compressor.attack.setValueAtTime(0.008, now);
  compressor.release.setValueAtTime(0.16, now);
  master.gain.setValueAtTime(masterGain("calm", false), now);
  master.connect(highpass);
  highpass.connect(saturation);
  saturation.connect(compressor);
  compressor.connect(destination);

  const bassBus = createBus(audio, master, 0.94);
  const rhythmBus = createBus(audio, master, 0.8);
  const harmonyBus = createBus(audio, master, 0.75);
  const pulseBus = createBus(audio, master, 0.82);
  const leadBus = createBus(audio, master, 0.86);
  const counterBus = createBus(audio, master, 0.56);
  const fxBus = createBus(audio, master, 0.42);

  const reverb = audio.createConvolver();
  const reverbSend = audio.createGain();
  const reverbWet = audio.createGain();
  reverb.buffer = createImpulseResponse(audio, 1.15, 2.45);
  reverbSend.gain.setValueAtTime(0.2, now);
  reverbWet.gain.setValueAtTime(0.2, now);
  reverbSend.connect(reverb);
  reverb.connect(reverbWet);
  reverbWet.connect(master);

  const delay = audio.createDelay(1.5);
  const delayFeedback = audio.createGain();
  const delayWet = audio.createGain();
  delayFeedback.gain.setValueAtTime(0.28, now);
  delayWet.gain.setValueAtTime(0.26, now);
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(master);
  leadBus.connect(delay);
  pulseBus.connect(reverbSend);
  leadBus.connect(reverbSend);
  counterBus.connect(reverbSend);

  const padGain = audio.createGain();
  const padFilter = audio.createBiquadFilter();
  const padOscA = audio.createOscillator();
  const padOscB = audio.createOscillator();
  const padOscC = audio.createOscillator();
  const padOscD = audio.createOscillator();
  const padLfo = audio.createOscillator();
  const padLfoGain = audio.createGain();
  const padGate = audio.createGain();
  padFilter.type = "lowpass";
  padFilter.frequency.setValueAtTime(Math.min(p.cutoff, 1100), now);
  padFilter.Q.setValueAtTime(0.85, now);
  padGain.gain.setValueAtTime(PAD_GAIN, now);
  padGate.gain.setValueAtTime(1, now);
  padOscA.type = "sawtooth";
  padOscB.type = "sawtooth";
  padOscC.type = "sawtooth";
  padOscD.type = "sawtooth";
  padOscA.frequency.setValueAtTime(p.padRoot[0] ?? p.rootHz, now);
  padOscB.frequency.setValueAtTime((p.padRoot[0] ?? p.rootHz) * 1.002, now);
  padOscC.frequency.setValueAtTime((p.padRoot[0] ?? p.rootHz) * 0.998, now);
  padOscD.frequency.setValueAtTime((p.padFifth[0] ?? p.rootHz * 1.5) * 1.001, now);
  padOscA.detune.setValueAtTime(-6, now);
  padOscB.detune.setValueAtTime(-14, now);
  padOscC.detune.setValueAtTime(12, now);
  padOscD.detune.setValueAtTime(5, now);
  padLfo.type = "sine";
  padLfo.frequency.setValueAtTime(0.52, now);
  padLfoGain.gain.setValueAtTime(160, now);
  padOscA.connect(padFilter);
  padOscB.connect(padFilter);
  padOscC.connect(padFilter);
  padOscD.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(padGate);
  padGate.connect(harmonyBus);
  padLfo.connect(padLfoGain);
  padLfoGain.connect(padFilter.frequency);
  padOscA.start(now);
  padOscB.start(now);
  padOscC.start(now);
  padOscD.start(now);
  padLfo.start(now);

  return {
    master,
    highpass,
    saturation,
    compressor,
    bassBus,
    rhythmBus,
    harmonyBus,
    pulseBus,
    leadBus,
    counterBus,
    fxBus,
    reverb,
    reverbSend,
    reverbWet,
    delay,
    delayFeedback,
    delayWet,
    padGain,
    padFilter,
    padOscA,
    padOscB,
    padOscC,
    padOscD,
    padLfo,
    padLfoGain,
    padGate,
    padBase: PAD_GAIN,
    index: indexPattern(p),
  };
}

function disconnectGraph(g: MusicGraph): void {
  for (const oscillator of [g.padOscA, g.padOscB, g.padOscC, g.padOscD, g.padLfo]) {
    try {
      oscillator.stop();
    } catch {
      /* Offline contexts may already be complete. */
    }
    oscillator.disconnect();
  }
  for (const node of [
    g.padFilter, g.padGain, g.padGate, g.padLfoGain, g.delay, g.delayFeedback, g.delayWet,
    g.reverb, g.reverbSend, g.reverbWet, g.bassBus, g.rhythmBus, g.harmonyBus,
    g.pulseBus, g.leadBus, g.counterBus, g.fxBus, g.highpass, g.saturation,
    g.compressor, g.master,
  ]) node.disconnect();
}

function stemBus(g: MusicGraph, stem: MusicStem): GainNode {
  if (stem === "bass") return g.bassBus;
  if (stem === "pulse") return g.pulseBus;
  if (stem === "melody") return g.leadBus;
  return g.counterBus;
}

function notePan(stem: MusicStem): number {
  if (stem === "pulse") return -0.34;
  if (stem === "melody") return 0.3;
  if (stem === "counter") return -0.12;
  return 0;
}

function playSynthTone(
  audio: AudioGraphContext,
  g: MusicGraph,
  dest: AudioNode,
  freq: number,
  time: number,
  duration: number,
  type: MusicVoiceType,
  velocity: number,
  cutoff: number,
  voice: MusicStem,
  accent = false,
): void {
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  const pan = audio.createStereoPanner();
  const oscA = audio.createOscillator();
  const oscB = audio.createOscillator();
  const bass = voice === "bass";
  const pulse = voice === "pulse";
  const lead = voice === "melody";
  const attack = Math.min(lead ? 0.02 : bass ? 0.004 : pulse ? 0.003 : ATTACK_S, duration * 0.22);
  const release = Math.min(bass ? 0.07 : pulse ? 0.045 : lead ? 0.22 : 0.18, duration * (pulse ? 0.55 : 0.4));
  const end = time + Math.max(duration, attack + release + 0.02);
  const peak = Math.max(0.006, velocity * (accent ? 0.2 : pulse ? 0.12 : 0.15));

  filter.type = "lowpass";
  filter.Q.setValueAtTime(bass ? 1.8 : lead || pulse ? 1.35 : 1.05, time);
  const startCut = Math.max(220, cutoff * (bass ? (accent ? 3.1 : 2.5) : accent ? 2.2 : pulse ? 2.4 : 1.7));
  const endCut = Math.max(bass ? 90 : 140, cutoff * (bass ? 0.26 : pulse ? 1.1 : 0.82));
  filter.frequency.setValueAtTime(startCut, time);
  filter.frequency.exponentialRampToValueAtTime(endCut, time + Math.min(0.16, duration * 0.55));
  pan.pan.setValueAtTime(notePan(voice), time);

  oscA.type = bass ? "square" : pulse ? "square" : type;
  oscB.type = bass || lead ? "sawtooth" : "square";
  const glide = lead ? Math.min(0.03, duration * 0.22) : pulse ? Math.min(0.012, duration * 0.18) : 0;
  oscA.frequency.setValueAtTime(freq * (glide > 0 ? 0.93 : 1), time);
  if (glide > 0) oscA.frequency.exponentialRampToValueAtTime(freq, time + glide);
  oscB.frequency.setValueAtTime(freq * (bass ? 1.004 : 1.01), time);
  oscB.detune.setValueAtTime(lead ? 10 : pulse ? -8 : -5, time);

  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(peak, time + Math.max(0.003, attack));
  if (pulse) {
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.05, duration * 0.7));
  } else {
    envelope.gain.setTargetAtTime(0.0001, Math.max(time + attack, end - release), Math.max(0.014, release * 0.4));
  }

  oscA.connect(filter);
  oscB.connect(filter);
  if (!pulse) {
    const oscSub = audio.createOscillator();
    const subGain = audio.createGain();
    oscSub.type = bass ? "sine" : lead ? "square" : "triangle";
    oscSub.frequency.setValueAtTime(freq * (bass || lead ? 0.5 : 0.25), time);
    subGain.gain.setValueAtTime(bass ? 0.55 : 0.22, time);
    oscSub.connect(subGain);
    subGain.connect(filter);
    oscSub.start(time);
    oscSub.stop(end + 0.04);
  }
  filter.connect(envelope);
  envelope.connect(pan);
  pan.connect(dest);
  if (lead || voice === "counter") envelope.connect(g.reverbSend);

  if (lead) {
    const vibrato = audio.createOscillator();
    const vibratoGain = audio.createGain();
    vibrato.type = "sine";
    vibrato.frequency.setValueAtTime(5.6, time);
    vibratoGain.gain.setValueAtTime(0.0001, time);
    vibratoGain.gain.setValueAtTime(0.0001, time + 0.12);
    vibratoGain.gain.linearRampToValueAtTime(16, time + 0.28);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(oscA.detune);
    vibratoGain.connect(oscB.detune);
    vibrato.start(time);
    vibrato.stop(end + 0.04);
  }

  oscA.start(time);
  oscB.start(time);
  oscA.stop(end + 0.04);
  oscB.stop(end + 0.04);
}

function playNoise(
  audio: AudioGraphContext,
  dest: AudioNode,
  time: number,
  gain: number,
  frequency: number,
  duration: number,
  type: BiquadFilterType = "highpass",
  panValue = 0,
): void {
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  source.buffer = getNoiseBuffer(audio);
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, time);
  if (type === "bandpass") filter.Q.setValueAtTime(1.1, time);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + Math.min(0.006, duration * 0.18));
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter);
  filter.connect(envelope);
  const pan = audio.createStereoPanner();
  pan.pan.setValueAtTime(panValue, time);
  envelope.connect(pan);
  pan.connect(dest);
  source.start(time);
  source.stop(time + duration + 0.025);
}

function playKick(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(188, time);
  oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.16);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.64 * velocity, time + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  oscillator.connect(envelope);
  envelope.connect(g.rhythmBus);
  oscillator.start(time);
  oscillator.stop(time + 0.26);
  playNoise(audio, g.rhythmBus, time, 0.08 * velocity, 2800, 0.02);
}

function playSnare(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, accent: boolean): void {
  const dry = (accent ? 0.16 : 0.09) * velocity;
  playNoise(audio, g.rhythmBus, time, dry, 1900, accent ? 0.07 : 0.05, "bandpass");
  playNoise(audio, g.rhythmBus, time, dry * 0.55, 4200, 0.035, "highpass");
  const body = audio.createOscillator();
  const bodyGain = audio.createGain();
  const bodyLen = accent ? 0.08 : 0.055;
  body.type = "triangle";
  body.frequency.setValueAtTime(210, time);
  body.frequency.exponentialRampToValueAtTime(150, time + bodyLen);
  bodyGain.gain.setValueAtTime(0.0001, time);
  bodyGain.gain.exponentialRampToValueAtTime(0.12 * velocity, time + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + bodyLen);
  body.connect(bodyGain);
  bodyGain.connect(g.rhythmBus);
  body.start(time);
  body.stop(time + bodyLen + 0.03);
  playNoise(audio, g.reverbSend, time, dry * 0.7, 1600, accent ? 0.2 : 0.14, "bandpass");
}

function playClap(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, accent: boolean): void {
  const gain = (accent ? 0.11 : 0.07) * velocity;
  playNoise(audio, g.rhythmBus, time, gain, 1450, accent ? 0.085 : 0.06, "bandpass", 0.08);
  playNoise(audio, g.rhythmBus, time + 0.014, gain * 0.72, 1950, accent ? 0.07 : 0.045, "bandpass", -0.08);
  playNoise(audio, g.reverbSend, time, gain * 0.42, 1250, accent ? 0.12 : 0.08, "bandpass");
}

function playHat(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, open: boolean): void {
  playNoise(audio, g.rhythmBus, time, (open ? 0.06 : 0.036) * velocity, open ? 3300 : 7200, open ? 0.17 : 0.027, open ? "bandpass" : "highpass", open ? 0.12 : -0.08);
}

function playTom(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(180, time);
  oscillator.frequency.exponentialRampToValueAtTime(110, time + 0.18);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.2 * velocity, time + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  oscillator.connect(envelope);
  envelope.connect(g.rhythmBus);
  oscillator.start(time);
  oscillator.stop(time + 0.26);
}

function playImpact(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(108, time);
  oscillator.frequency.exponentialRampToValueAtTime(31, time + 0.34);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.42 * velocity, time + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
  oscillator.connect(envelope);
  envelope.connect(g.fxBus);
  oscillator.start(time);
  oscillator.stop(time + 0.46);
  playNoise(audio, g.fxBus, time, 0.14 * velocity, 900, 0.18, "bandpass");
  playNoise(audio, g.reverbSend, time, 0.08 * velocity, 700, 0.32, "bandpass");
}

function playTransition(audio: AudioGraphContext, g: MusicGraph, time: number, duration: number, rising: boolean): void {
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  source.buffer = getNoiseBuffer(audio);
  filter.type = "bandpass";
  filter.Q.setValueAtTime(0.8, time);
  filter.frequency.setValueAtTime(rising ? 220 : 4200, time);
  filter.frequency.exponentialRampToValueAtTime(rising ? 4200 : 220, time + duration);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.085, time + duration * 0.72);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(g.fxBus);
  envelope.connect(g.reverbSend);
  source.start(time);
  source.stop(time + duration + 0.03);
}

function retunePad(audio: AudioGraphContext, g: MusicGraph, p: MusicPattern, bar: number, time: number): void {
  const index = ((bar % p.bars) + p.bars) % p.bars;
  const root = p.padRoot[index] ?? p.rootHz;
  const fifth = p.padFifth[index] ?? root * 1.5;
  const t = Math.max(time, audio.currentTime);
  g.padOscA.frequency.setTargetAtTime(root, t, 0.04);
  g.padOscB.frequency.setTargetAtTime(root * 1.002, t, 0.04);
  g.padOscC.frequency.setTargetAtTime(root * 0.998, t, 0.04);
  g.padOscD.frequency.setTargetAtTime(fifth * 1.001, t, 0.04);
}

function schedulePadGate(
  audio: AudioGraphContext,
  g: MusicGraph,
  time: number,
  stepDuration: number,
  stepIndex: number,
  section: MusicSectionName | undefined,
  value: MusicIntensity,
): void {
  const t = Math.max(time, audio.currentTime);
  const level = value === "critical" ? 1 : value === "engaged" ? 0.82 : 0.7;
  const sustain = section === "intro" || section === "breakdown";
  if (sustain) {
    g.padGate.gain.setTargetAtTime(level * 0.92, t, 0.05);
    return;
  }
  if (stepIndex % 2 !== 0) return;
  const eighth = stepDuration * 2;
  g.padGate.gain.setValueAtTime(0.03, t);
  g.padGate.gain.linearRampToValueAtTime(level, t + Math.max(0.004, stepDuration * 0.08));
  g.padGate.gain.setValueAtTime(level, t + eighth * 0.42);
  g.padGate.gain.linearRampToValueAtTime(0.03, t + eighth * 0.9);
}

function syncDelay(audio: AudioGraphContext, g: MusicGraph, p: MusicPattern): void {
  const seconds = Math.max(0.05, (60 / p.bpm) * p.delayBeats);
  g.delay.delayTime.setTargetAtTime(seconds, audio.currentTime, 0.04);
}

function applyIntensityAt(audio: AudioGraphContext, g: MusicGraph, value: MusicIntensity, time: number, isDucked = ducked): void {
  const t = Math.max(time, audio.currentTime);
  const ramp = value === "critical" ? 0.11 : 0.22;
  const set = (node: GainNode, target: number) => {
    node.gain.setTargetAtTime(target, t, ramp);
  };
  set(g.master, masterGain(value, isDucked));
  set(g.bassBus, value === "calm" ? 0.9 : value === "critical" ? 1.06 : 0.94);
  set(g.rhythmBus, value === "calm" ? 0.7 : value === "critical" ? 1.04 : 0.84);
  set(g.harmonyBus, value === "calm" ? 0.68 : value === "critical" ? 0.78 : 0.72);
  set(g.pulseBus, value === "calm" ? 0.78 : value === "critical" ? 1 : 0.86);
  set(g.leadBus, value === "calm" ? 0.9 : value === "critical" ? 1.12 : 0.96);
  set(g.counterBus, value === "calm" ? 0.42 : value === "critical" ? 0.82 : 0.56);
  set(g.fxBus, value === "critical" ? 0.84 : value === "engaged" ? 0.52 : 0.32);
  g.highpass.frequency.setTargetAtTime(value === "critical" ? 54 : 38, t, ramp);
  g.padFilter.frequency.setTargetAtTime(value === "critical" ? 1_550 : value === "engaged" ? 1_150 : 880, t, ramp);
}

function duckPad(audio: AudioGraphContext, g: MusicGraph, time: number): void {
  const t = Math.max(time, audio.currentTime);
  g.padGain.gain.cancelScheduledValues(t);
  g.padGain.gain.setValueAtTime(Math.max(0.001, g.padGain.gain.value), t);
  g.padGain.gain.linearRampToValueAtTime(g.padBase * 0.38, t + 0.025);
  g.padGain.gain.linearRampToValueAtTime(g.padBase, t + 0.12);
}

function scheduleStep(audio: AudioGraphContext, g: MusicGraph, p: MusicPattern, when: number, index: number, value: MusicIntensity): void {
  const stepDuration = 60 / p.bpm / 4;
  const t = when + (index % 2 === 1 ? p.swing * stepDuration : 0);
  const bar = Math.floor(index / STEPS_PER_BAR);
  const section = p.sections[Math.floor(bar / 8)]?.name;
  if (index % STEPS_PER_BAR === 0) {
    retunePad(audio, g, p, bar, t);
    if (bar % 8 === 7 && bar < p.bars - 1) playTransition(audio, g, t + stepDuration * 5, stepDuration * 9, true);
    if (bar % 8 === 0 && bar > 0) playTransition(audio, g, t, stepDuration * 3, false);
  }

  const isBreakdown = section === "breakdown";
  schedulePadGate(audio, g, t, stepDuration, index, section, value);
  const stemVoices: Array<[MusicStem, MusicVoiceType, number]> = [
    ["bass", p.bassType, Math.min(p.cutoff, 620)],
    ["pulse", p.arpType, Math.min(p.cutoff + 180, 1600)],
    ["counter", "triangle", p.cutoff],
    ["melody", p.melodyType, p.cutoff + 360],
  ];
  for (const [stem, voice, cutoff] of stemVoices) {
    const events = g.index.notes[stem].get(index);
    if (!events) continue;
    for (const event of events) {
      const duration = Math.max(stepDuration * event.duration, stepDuration * (stem === "pulse" ? 0.55 : 0.7));
      playSynthTone(audio, g, stemBus(g, stem), midiToHz(event.midi), t, duration, voice, event.velocity * layerMultiplier(stem === "pulse" ? "pulse" : stem, value), cutoff, stem, !!event.accent);
      if (value === "critical" && stem === "bass" && event.accent) {
        playSynthTone(audio, g, g.bassBus, midiToHz(event.midi - 12), t, duration * 0.9, "triangle", event.velocity * 0.42, 340, "bass", true);
      }
    }
  }

  for (const event of g.index.drums.get(index) ?? []) {
    if (value === "calm" && isBreakdown && (event.kind === "tom" || event.kind === "impact")) continue;
    const velocity = event.velocity * layerMultiplier("drums", value);
    if (event.kind === "kick") {
      playKick(audio, g, t, velocity);
      duckPad(audio, g, t);
    } else if (event.kind === "snare") playSnare(audio, g, t, velocity, !!event.accent);
    else if (event.kind === "clap") playClap(audio, g, t, velocity, !!event.accent);
    else if (event.kind === "hat") playHat(audio, g, t, velocity, false);
    else if (event.kind === "openHat") playHat(audio, g, t, velocity, true);
    else if (event.kind === "tom") playTom(audio, g, t, velocity);
    else playImpact(audio, g, t, velocity);
  }
}

function applyPendingIntensityAtPhraseBoundary(audio: AudioContext, g: MusicGraph): void {
  if (!pendingIntensity) return;
  intensity = pendingIntensity;
  pendingIntensity = null;
  applyIntensityAt(audio, g, intensity, nextNoteTime);
}

function startGraph(audio: AudioContext): void {
  if (!pattern) return;
  const musicBus = getAudioBus("music");
  if (!musicBus) return;
  graph = createGraph(audio, musicBus, pattern);
  syncDelay(audio, graph, pattern);
  applyIntensityAt(audio, graph, intensity, audio.currentTime);
  nextNoteTime = audio.currentTime + 0.07;
  step = 0;
  timer = window.setInterval(tickScheduler, SCHEDULER_MS);
  tickScheduler();
}

function tickScheduler(): void {
  const audio = getAudioContext();
  if (!audio || !graph || !pattern) return;
  const stepDuration = 60 / pattern.bpm / 4;
  while (nextNoteTime < audio.currentTime + SCHEDULE_AHEAD_S) {
    if (step % PHRASE_STEPS === 0) applyPendingIntensityAtPhraseBoundary(audio, graph);
    scheduleStep(audio, graph, pattern, nextNoteTime, step, intensity);
    nextNoteTime += stepDuration;
    step = (step + 1) % pattern.steps;
  }
}

function stopMusic(): void {
  fadeGen += 1;
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  if (graph) {
    disconnectGraph(graph);
    graph = null;
  }
}

function ensureMusicPlaying(): void {
  if (!enabled || paused) return;
  const audio = peekAudioContext();
  if (!audio) return;
  if (!pattern) pattern = composeMusic(seed, cue, missionIndex);
  if (timer) return;
  startGraph(audio);
}

function applyPattern(next: MusicPattern): void {
  const audio = getAudioContext();
  if (!audio || !graph || !timer) {
    pattern = next;
    return;
  }
  const generation = ++fadeGen;
  const now = audio.currentTime;
  const half = CROSSFADE_S / 2;
  const current = Math.max(graph.master.gain.value, 0.001);
  graph.master.gain.cancelScheduledValues(now);
  graph.master.gain.setValueAtTime(current, now);
  graph.master.gain.linearRampToValueAtTime(0.001, now + half);
  window.setTimeout(() => {
    if (generation !== fadeGen) return;
    pattern = next;
    const activeGraph = graph;
    if (!activeGraph) return;
    activeGraph.index = indexPattern(next);
    step = 0;
    syncDelay(audio, activeGraph, next);
    retunePad(audio, activeGraph, next, 0, audio.currentTime);
    const t = audio.currentTime;
    activeGraph.master.gain.cancelScheduledValues(t);
    activeGraph.master.gain.setValueAtTime(0.001, t);
    activeGraph.master.gain.linearRampToValueAtTime(masterGain(intensity, ducked), t + half);
  }, half * 1000);
}

export function setMusicCue(nextCue: MusicCue, nextSeed: number, nextMissionIndex = 0): void {
  paused = false;
  if (cue === nextCue && seed === nextSeed && missionIndex === nextMissionIndex && pattern) {
    setMusicIntensity("calm");
    ensureMusicPlaying();
    return;
  }
  cue = nextCue;
  seed = nextSeed;
  missionIndex = nextMissionIndex;
  intensity = "calm";
  pendingIntensity = null;
  const next = composeMusic(nextSeed, nextCue, nextMissionIndex);
  if (timer) applyPattern(next);
  else pattern = next;
  ensureMusicPlaying();
}

export function setMusicEnabled(value: boolean): void {
  enabled = value;
  setAudioBusEnabled("music", value);
  if (!value) stopMusic();
  else ensureMusicPlaying();
}

/** Silence music for route-only surfaces without changing the saved preference. */
export function pauseMusic(): void {
  paused = true;
  stopMusic();
}

export function setMusicDucked(value: boolean): void {
  ducked = value;
  const audio = peekAudioContext();
  if (!audio || !graph) return;
  const now = audio.currentTime;
  graph.master.gain.cancelScheduledValues(now);
  graph.master.gain.setValueAtTime(Math.max(graph.master.gain.value, 0.001), now);
  graph.master.gain.linearRampToValueAtTime(masterGain(intensity, value), now + 0.1);
}

export function setMusicIntensity(value: MusicIntensity): void {
  const audio = peekAudioContext();
  if (!audio || !graph || !timer) {
    intensity = value;
    pendingIntensity = null;
    return;
  }
  if (intensity === value && pendingIntensity === null) return;
  pendingIntensity = value;
}

export class MusicExportCancelledError extends Error {
  constructor() {
    super("Mission soundtrack export was cancelled.");
    this.name = "AbortError";
  }
}

function throwIfRenderAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new MusicExportCancelledError();
}

async function renderOfflineAudio(
  offline: OfflineAudioContext,
  duration: number,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<AudioBuffer> {
  throwIfRenderAborted(signal);
  const rendering = offline.startRendering();
  // Keep a rejection handler attached because cancellation can release the
  // caller before the offline render finishes settling.
  void rendering.catch(() => undefined);

  if (typeof offline.suspend !== "function" || typeof offline.resume !== "function") {
    const buffer = await rendering;
    throwIfRenderAborted(signal);
    onProgress?.(1);
    return buffer;
  }

  let suspended = false;
  const resumeAfterFailure = async () => {
    if (!suspended) return;
    suspended = false;
    try {
      await offline.resume();
    } catch {
      // The render may have completed while the suspension was being handled.
    }
  };

  try {
    let nextSuspendAt = OFFLINE_RENDER_CHUNK_S;
    while (nextSuspendAt < duration) {
      await offline.suspend(nextSuspendAt);
      suspended = true;
      throwIfRenderAborted(signal);
      onProgress?.(Math.min(0.99, nextSuspendAt / duration));
      await offline.resume();
      suspended = false;
      throwIfRenderAborted(signal);
      nextSuspendAt += OFFLINE_RENDER_CHUNK_S;
    }

    const buffer = await rendering;
    throwIfRenderAborted(signal);
    onProgress?.(1);
    return buffer;
  } catch (error) {
    await resumeAfterFailure();
    throw error;
  }
}

export async function renderMissionMusic(
  seedValue: number,
  mission: number,
  sampleRate = SAMPLE_RATE,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
  } = {},
): Promise<AudioBuffer> {
  if (typeof window === "undefined" || typeof window.OfflineAudioContext === "undefined") {
    throw new Error("Offline audio rendering is not supported in this browser.");
  }
  throwIfRenderAborted(options.signal);
  const renderedPattern = composeMusic(seedValue, "mission", mission);
  const stepDuration = 60 / renderedPattern.bpm / 4;
  const musicalDuration = renderedPattern.steps * stepDuration;
  const tailSeconds = 2.2;
  const length = Math.ceil((musicalDuration + tailSeconds) * sampleRate);
  const offline = new window.OfflineAudioContext(2, length, sampleRate);
  const offlineGraph = createGraph(offline, offline.destination, renderedPattern);
  try {
    const arc: MusicIntensity[] = ["calm", "engaged", "calm", "engaged", "critical", "engaged", "engaged", "engaged"];
    for (let bar = 0; bar < MUSIC_BARS; bar++) {
      throwIfRenderAborted(options.signal);
      const value = arc[Math.floor(bar / 8)] ?? "engaged";
      applyIntensityAt(offline, offlineGraph, value, bar * STEPS_PER_BAR * stepDuration, false);
    }
    syncDelay(offline, offlineGraph, renderedPattern);
    for (let index = 0; index < MUSIC_STEPS; index++) {
      if (index % STEPS_PER_BAR === 0) throwIfRenderAborted(options.signal);
      const value = arc[Math.floor(index / STEPS_PER_BAR / 8)] ?? "engaged";
      scheduleStep(offline, offlineGraph, renderedPattern, index * stepDuration, index, value);
    }
    const fadeAt = Math.max(0, musicalDuration - 1.35);
    offlineGraph.master.gain.setValueAtTime(masterGain("engaged", false), fadeAt);
    offlineGraph.master.gain.linearRampToValueAtTime(0.0001, musicalDuration + tailSeconds);
    return await renderOfflineAudio(offline, musicalDuration + tailSeconds, options.signal, options.onProgress);
  } finally {
    // This is also important on cancellation: the suspended context must not
    // retain the scheduled graph after the panel has released the export.
    disconnectGraph(offlineGraph);
  }
}

export function unlockAudio(): void {
  unlockAudioContext();
  ensureMusicPlaying();
}
