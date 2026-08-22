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
import { getAudioBus, setAudioBusEnabled } from "./mixer";

export { TITLE_MUSIC_SEED, TUTORIAL_MUSIC_MISSION, type MusicCue };
export type { MusicIntensity } from "./compose";

const SAMPLE_RATE = 44_100;
const MASTER_GAIN = 0.075;
const PAD_GAIN = 0.16;
const DUCK_RATIO = 0.34;
const CROSSFADE_S = 0.55;
const SCHEDULE_AHEAD_S = 0.22;
const SCHEDULER_MS = 25;
const ATTACK_S = 0.012;
const PHRASE_STEPS = STEPS_PER_BAR * 8;

const INTENSITY_MULTIPLIER: Record<MusicIntensity, number> = {
  calm: 0.82,
  engaged: 1,
  critical: 1.08,
};

type AudioGraphContext = AudioContext | OfflineAudioContext;

type PatternIndex = {
  notes: Record<MusicStem, Map<number, MusicNoteEvent>>;
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
  leadVibrato: OscillatorNode;
  leadVibratoGain: GainNode;
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
  if (value === "critical") return 1;
  if (value === "engaged") return layer === "drums" ? 1.05 : 1;
  if (layer === "counter") return 0.28;
  if (layer === "melody") return 0.64;
  if (layer === "drums") return 0.72;
  return 0.84;
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

function indexPattern(p: MusicPattern): PatternIndex {
  const notes = {
    bass: new Map(p.notes.bass.map((event) => [event.step, event] as const)),
    pulse: new Map(p.notes.pulse.map((event) => [event.step, event] as const)),
    melody: new Map(p.notes.melody.map((event) => [event.step, event] as const)),
    counter: new Map(p.notes.counter.map((event) => [event.step, event] as const)),
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
  reverb.buffer = createImpulseResponse(audio, 1.9, 2.1);
  reverbSend.gain.setValueAtTime(0.22, now);
  reverbWet.gain.setValueAtTime(0.22, now);
  reverbSend.connect(reverb);
  reverb.connect(reverbWet);
  reverbWet.connect(master);

  const delay = audio.createDelay(1.5);
  const delayFeedback = audio.createGain();
  const delayWet = audio.createGain();
  delayFeedback.gain.setValueAtTime(0.2, now);
  delayWet.gain.setValueAtTime(0.18, now);
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
  const leadVibrato = audio.createOscillator();
  const leadVibratoGain = audio.createGain();
  padFilter.type = "lowpass";
  padFilter.frequency.setValueAtTime(Math.min(p.cutoff, 980), now);
  padFilter.Q.setValueAtTime(1.1, now);
  padGain.gain.setValueAtTime(PAD_GAIN * 1.08, now);
  padGate.gain.setValueAtTime(1, now);
  padOscA.type = "sawtooth";
  padOscB.type = "sawtooth";
  padOscC.type = "triangle";
  padOscD.type = "square";
  padOscA.frequency.setValueAtTime(p.padRoot[0] ?? p.rootHz, now);
  padOscB.frequency.setValueAtTime((p.padFifth[0] ?? p.rootHz * 1.5) * 1.003, now);
  padOscC.frequency.setValueAtTime((p.padThird[0] ?? p.rootHz * 1.25) * 0.999, now);
  padOscD.frequency.setValueAtTime((p.padSeventh[0] ?? p.rootHz * 1.78) * 1.001, now);
  padOscB.detune.setValueAtTime(-7, now);
  padOscC.detune.setValueAtTime(5, now);
  padOscD.detune.setValueAtTime(9, now);
  padLfo.type = "sine";
  padLfo.frequency.setValueAtTime(0.13, now);
  padLfoGain.gain.setValueAtTime(240, now);
  leadVibrato.type = "sine";
  leadVibrato.frequency.setValueAtTime(5.4, now);
  leadVibratoGain.gain.setValueAtTime(10, now);
  padOscA.connect(padFilter);
  padOscB.connect(padFilter);
  padOscC.connect(padFilter);
  padOscD.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(padGate);
  padGate.connect(harmonyBus);
  padLfo.connect(padLfoGain);
  padLfoGain.connect(padFilter.frequency);
  leadVibrato.connect(leadVibratoGain);
  padOscA.start(now);
  padOscB.start(now);
  padOscC.start(now);
  padOscD.start(now);
  padLfo.start(now);
  leadVibrato.start(now);

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
    leadVibrato,
    leadVibratoGain,
    padBase: PAD_GAIN * 1.08,
    index: indexPattern(p),
  };
}

function disconnectGraph(g: MusicGraph): void {
  for (const oscillator of [g.padOscA, g.padOscB, g.padOscC, g.padOscD, g.padLfo, g.leadVibrato]) {
    try {
      oscillator.stop();
    } catch {
      /* Offline contexts may already be complete. */
    }
    oscillator.disconnect();
  }
  for (const node of [
    g.padFilter, g.padGain, g.padGate, g.padLfoGain, g.leadVibratoGain, g.delay, g.delayFeedback, g.delayWet,
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
  const oscSub = audio.createOscillator();
  const attack = Math.min(voice === "melody" ? 0.026 : ATTACK_S, duration * 0.28);
  const release = Math.min(voice === "bass" ? 0.16 : 0.24, duration * 0.45);
  const end = time + Math.max(duration, attack + release + 0.02);
  const peak = Math.max(0.006, velocity * (accent ? 0.19 : 0.145));

  filter.type = voice === "bass" ? "lowpass" : "lowpass";
  filter.Q.setValueAtTime(voice === "melody" || voice === "pulse" ? 1.55 : 1.05, time);
  filter.frequency.setValueAtTime(Math.max(220, cutoff * (accent ? 2.1 : 1.5)), time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * (voice === "bass" ? 0.68 : 0.86)), end);
  pan.pan.setValueAtTime(notePan(voice), time);

  oscA.type = type;
  oscB.type = voice === "bass" || voice === "pulse" ? "square" : "sawtooth";
  oscSub.type = voice === "melody" ? "square" : "triangle";
  const glide = voice === "melody" || voice === "pulse" ? Math.min(0.032, duration * 0.3) : 0;
  oscA.frequency.setValueAtTime(freq * (glide > 0 ? 0.94 : 1), time);
  if (glide > 0) oscA.frequency.exponentialRampToValueAtTime(freq, time + glide);
  oscB.frequency.setValueAtTime(freq * (voice === "bass" ? 1.006 : 1.012), time);
  oscB.detune.setValueAtTime(voice === "melody" ? 12 : voice === "pulse" ? -9 : -6, time);
  oscSub.frequency.setValueAtTime(freq * (voice === "bass" || voice === "melody" ? 0.5 : 0.25), time);
  oscSub.detune.setValueAtTime(-4, time);

  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(peak, time + Math.max(0.004, attack));
  envelope.gain.setTargetAtTime(0.0001, Math.max(time + attack, end - release), Math.max(0.018, release * 0.42));

  oscA.connect(filter);
  oscB.connect(filter);
  oscSub.connect(filter);
  filter.connect(envelope);
  envelope.connect(pan);
  pan.connect(dest);
  if (voice === "melody" || voice === "counter") envelope.connect(g.reverbSend);
  if (voice === "melody") envelope.connect(g.delay);
  if (voice === "melody") {
    g.leadVibratoGain.connect(oscA.detune);
    g.leadVibratoGain.connect(oscB.detune);
  }
  oscA.start(time);
  oscB.start(time);
  oscSub.start(time);
  oscA.stop(end + 0.04);
  oscB.stop(end + 0.04);
  oscSub.stop(end + 0.04);
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
  const pan = audio.createStereoPanner();
  source.buffer = getNoiseBuffer(audio);
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, time);
  if (type === "bandpass") filter.Q.setValueAtTime(1.1, time);
  pan.pan.setValueAtTime(panValue, time);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + Math.min(0.006, duration * 0.18));
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(pan);
  pan.connect(dest);
  source.start(time);
  source.stop(time + duration + 0.025);
}

function playKick(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(156, time);
  oscillator.frequency.exponentialRampToValueAtTime(38, time + 0.19);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.58 * velocity, time + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
  oscillator.connect(envelope);
  envelope.connect(g.rhythmBus);
  oscillator.start(time);
  oscillator.stop(time + 0.27);
  playNoise(audio, g.rhythmBus, time, 0.065 * velocity, 2500, 0.024);
}

function playSnare(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, accent: boolean): void {
  playNoise(audio, g.rhythmBus, time, (accent ? 0.15 : 0.072) * velocity, 1850, accent ? 0.12 : 0.075, "bandpass");
  playSynthTone(audio, g, g.rhythmBus, 185, time, accent ? 0.09 : 0.058, "triangle", 0.42 * velocity, 1700, "counter", accent);
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
  playSynthTone(audio, g, g.rhythmBus, 180, time, 0.22, "triangle", 0.68 * velocity, 900, "counter", true);
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
  const third = p.padThird[index] ?? root * 1.25;
  const fifth = p.padFifth[index] ?? root * 1.5;
  const seventh = p.padSeventh[index] ?? root * 1.78;
  const t = Math.max(time, audio.currentTime);
  g.padOscA.frequency.setTargetAtTime(root, t, 0.055);
  g.padOscB.frequency.setTargetAtTime(fifth * 1.003, t, 0.055);
  g.padOscC.frequency.setTargetAtTime(third * 0.999, t, 0.055);
  g.padOscD.frequency.setTargetAtTime(seventh * 1.001, t, 0.055);
}

function schedulePadGate(audio: AudioGraphContext, g: MusicGraph, time: number, stepDuration: number, section: MusicSectionName | undefined, value: MusicIntensity): void {
  const t = Math.max(time, audio.currentTime);
  const level = value === "critical" ? 1 : value === "engaged" ? 0.86 : section === "breakdown" ? 0.96 : 0.66;
  const attack = Math.max(0.004, stepDuration * 0.08);
  const hold = t + stepDuration * (section === "breakdown" ? 0.94 : 0.68);
  g.padGate.gain.setValueAtTime(Math.max(0.38, level * 0.56), t);
  g.padGate.gain.linearRampToValueAtTime(level, t + attack);
  g.padGate.gain.setValueAtTime(level * 0.72, hold);
  g.padGate.gain.linearRampToValueAtTime(Math.max(0.34, level * 0.5), t + stepDuration * 0.94);
}

function syncDelay(audio: AudioGraphContext, g: MusicGraph, p: MusicPattern): void {
  const seconds = Math.max(0.05, (60 / p.bpm) * p.delayBeats);
  g.delay.delayTime.setTargetAtTime(seconds, audio.currentTime, 0.04);
}

function applyIntensityAt(audio: AudioGraphContext, g: MusicGraph, value: MusicIntensity, time: number): void {
  const t = Math.max(time, audio.currentTime);
  const ramp = value === "critical" ? 0.11 : 0.22;
  const set = (node: GainNode, target: number) => {
    node.gain.setTargetAtTime(target, t, ramp);
  };
  set(g.master, masterGain(value, ducked));
  set(g.bassBus, value === "calm" ? 0.82 : value === "critical" ? 1.06 : 0.94);
  set(g.rhythmBus, value === "calm" ? 0.48 : value === "critical" ? 1.02 : 0.8);
  set(g.harmonyBus, value === "calm" ? 0.92 : value === "critical" ? 0.9 : 0.84);
  set(g.pulseBus, value === "calm" ? 0.38 : value === "critical" ? 0.98 : 0.82);
  set(g.leadBus, value === "calm" ? 0.52 : value === "critical" ? 1.12 : 0.92);
  set(g.counterBus, value === "calm" ? 0.15 : value === "critical" ? 0.86 : 0.56);
  set(g.fxBus, value === "critical" ? 0.84 : value === "engaged" ? 0.56 : 0.28);
  g.highpass.frequency.setTargetAtTime(value === "critical" ? 54 : 38, t, ramp);
  g.padFilter.frequency.setTargetAtTime(value === "critical" ? 1_650 : value === "engaged" ? 1_200 : 720, t, ramp);
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
  schedulePadGate(audio, g, t, stepDuration, section, value);
  const shouldPlay = (stem: MusicStem): boolean => {
    if (value !== "calm") return true;
    if (stem === "counter") return false;
    if (stem === "melody") return index % 4 === 0 || section === "hook";
    if (stem === "pulse") return index % 4 === 0;
    return true;
  };
  const stemVoices: Array<[MusicStem, MusicVoiceType, number]> = [
    ["bass", p.bassType, Math.min(p.cutoff, 560)],
    ["pulse", p.arpType, Math.min(p.cutoff, 1200)],
    ["counter", "triangle", p.cutoff],
    ["melody", p.melodyType, p.cutoff + 240],
  ];
  for (const [stem, voice, cutoff] of stemVoices) {
    if (!shouldPlay(stem)) continue;
    const event = g.index.notes[stem].get(index);
    if (!event) continue;
    const duration = Math.max(stepDuration * event.duration, stepDuration * 0.7);
    playSynthTone(audio, g, stemBus(g, stem), midiToHz(event.midi), t, duration, voice, event.velocity * layerMultiplier(stem === "pulse" ? "pulse" : stem, value), cutoff, stem, !!event.accent);
    if (value === "critical" && stem === "bass" && event.accent) {
      playSynthTone(audio, g, g.bassBus, midiToHz(event.midi - 12), t, duration * 0.9, "triangle", event.velocity * 0.42, 340, "bass", true);
    }
  }

  for (const event of g.index.drums.get(index) ?? []) {
    if (value === "calm" && (event.kind === "tom" || event.kind === "openHat" || isBreakdown)) continue;
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

export async function renderMissionMusic(seedValue: number, mission: number, sampleRate = SAMPLE_RATE): Promise<AudioBuffer> {
  if (typeof window === "undefined" || typeof window.OfflineAudioContext === "undefined") {
    throw new Error("Offline audio rendering is not supported in this browser.");
  }
  const renderedPattern = composeMusic(seedValue, "mission", mission);
  const stepDuration = 60 / renderedPattern.bpm / 4;
  const musicalDuration = renderedPattern.steps * stepDuration;
  const tailSeconds = 2.2;
  const length = Math.ceil((musicalDuration + tailSeconds) * sampleRate);
  const offline = new window.OfflineAudioContext(2, length, sampleRate);
  const offlineGraph = createGraph(offline, offline.destination, renderedPattern);
  const arc: MusicIntensity[] = ["calm", "engaged", "calm", "engaged", "critical", "engaged", "engaged", "engaged"];
  for (let bar = 0; bar < MUSIC_BARS; bar++) {
    const value = arc[Math.floor(bar / 8)] ?? "engaged";
    applyIntensityAt(offline, offlineGraph, value, bar * STEPS_PER_BAR * stepDuration);
  }
  syncDelay(offline, offlineGraph, renderedPattern);
  for (let index = 0; index < MUSIC_STEPS; index++) {
    const value = arc[Math.floor(index / STEPS_PER_BAR / 8)] ?? "engaged";
    scheduleStep(offline, offlineGraph, renderedPattern, index * stepDuration, index, value);
  }
  const fadeAt = Math.max(0, musicalDuration - 1.35);
  offlineGraph.master.gain.setValueAtTime(masterGain("engaged", false), fadeAt);
  offlineGraph.master.gain.linearRampToValueAtTime(0.0001, musicalDuration + tailSeconds);
  return offline.startRendering();
}

export function unlockAudio(): void {
  unlockAudioContext();
  ensureMusicPlaying();
}
