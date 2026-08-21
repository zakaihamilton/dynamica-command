import { getAudioContext, isAudioUnlocked, resumeAudio } from "./context";
import { getAudioBus, setAudioBusEnabled } from "./mixer";

export type BeepKind = "select" | "ack" | "build" | "alert" | "win" | "lose";

export type SfxKind =
  | "uiSelect"
  | "uiConfirm"
  | "uiCancel"
  | "uiError"
  | "buildStart"
  | "buildComplete"
  | "productionComplete"
  | "repair"
  | "sell"
  | "smallArms"
  | "antiArmor"
  | "cannon"
  | "impact"
  | "destruction"
  | "warning"
  | "objective"
  | "contact"
  | "victory"
  | "defeat";

export type SfxOptions = {
  pan?: number;
  gain?: number;
  minInterval?: number;
  force?: boolean;
};

let sfxEnabled = true;
let noiseBuf: AudioBuffer | null = null;
const lastPlayed = new Map<SfxKind, number>();

const DEFAULT_INTERVALS: Partial<Record<SfxKind, number>> = {
  smallArms: 0.045,
  antiArmor: 0.1,
  cannon: 0.12,
  impact: 0.04,
  destruction: 0.24,
  contact: 0.22,
};

export function setSfxEnabled(value: boolean): void {
  sfxEnabled = value;
  setAudioBusEnabled("sfx", value);
}

export function isSfxEnabled(): boolean {
  return sfxEnabled;
}

function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === audio.sampleRate) return noiseBuf;
  const buffer = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * 0.16)), audio.sampleRate);
  const data = buffer.getChannelData(0);
  let state = 0x1f123bb5;
  for (let i = 0; i < data.length; i++) {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    data[i] = ((state ^ (state >>> 14)) >>> 0) / 4294967295 * 2 - 1;
  }
  noiseBuf = buffer;
  return buffer;
}

function connect(audio: AudioContext, source: AudioNode, dest: AudioNode, pan: number): void {
  if (Math.abs(pan) < 0.01) {
    source.connect(dest);
    return;
  }
  const panner = audio.createStereoPanner();
  panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), audio.currentTime);
  source.connect(panner);
  panner.connect(dest);
}

function tone(
  audio: AudioContext,
  dest: AudioNode,
  options: {
    frequency: number;
    endFrequency?: number;
    duration: number;
    type: OscillatorType;
    gain: number;
    pan: number;
    cutoff?: number;
  },
): void {
  const o = audio.createOscillator();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  const now = audio.currentTime;
  const attack = Math.min(0.012, options.duration * 0.25);
  o.type = options.type;
  o.frequency.setValueAtTime(Math.max(20, options.frequency), now);
  if (options.endFrequency !== undefined) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), now + options.duration);
  }
  f.type = "lowpass";
  f.frequency.setValueAtTime(options.cutoff ?? 2600, now);
  f.Q.setValueAtTime(0.8, now);
  g.gain.setValueAtTime(0.001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, options.gain), now + attack);
  g.gain.exponentialRampToValueAtTime(0.001, now + options.duration);
  o.connect(f);
  f.connect(g);
  connect(audio, g, dest, options.pan);
  o.start(now);
  o.stop(now + options.duration + 0.03);
}

function noise(
  audio: AudioContext,
  dest: AudioNode,
  options: {
    duration: number;
    gain: number;
    pan: number;
    frequency: number;
    type?: BiquadFilterType;
  },
): void {
  const source = audio.createBufferSource();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  const now = audio.currentTime;
  const attack = Math.min(0.006, options.duration * 0.2);
  source.buffer = getNoiseBuffer(audio);
  f.type = options.type ?? "bandpass";
  f.frequency.setValueAtTime(options.frequency, now);
  f.Q.setValueAtTime(1.1, now);
  g.gain.setValueAtTime(0.001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, options.gain), now + attack);
  g.gain.exponentialRampToValueAtTime(0.001, now + options.duration);
  source.connect(f);
  f.connect(g);
  connect(audio, g, dest, options.pan);
  source.start(now);
  source.stop(now + options.duration + 0.03);
}

function playLayered(kind: SfxKind, audio: AudioContext, dest: AudioNode, pan: number, gain: number): void {
  switch (kind) {
    case "uiSelect":
      tone(audio, dest, { frequency: 420, duration: 0.045, type: "square", gain: 0.035 * gain, pan, cutoff: 1800 });
      break;
    case "uiConfirm":
      tone(audio, dest, { frequency: 380, endFrequency: 680, duration: 0.11, type: "triangle", gain: 0.04 * gain, pan, cutoff: 2400 });
      tone(audio, dest, { frequency: 760, duration: 0.055, type: "sine", gain: 0.018 * gain, pan, cutoff: 3000 });
      break;
    case "uiCancel":
      tone(audio, dest, { frequency: 360, endFrequency: 190, duration: 0.1, type: "triangle", gain: 0.035 * gain, pan, cutoff: 1800 });
      break;
    case "uiError":
      tone(audio, dest, { frequency: 125, endFrequency: 90, duration: 0.18, type: "square", gain: 0.045 * gain, pan, cutoff: 1200 });
      noise(audio, dest, { duration: 0.06, gain: 0.018 * gain, pan, frequency: 1100 });
      break;
    case "buildStart":
      tone(audio, dest, { frequency: 150, endFrequency: 230, duration: 0.14, type: "sawtooth", gain: 0.035 * gain, pan, cutoff: 1000 });
      noise(audio, dest, { duration: 0.06, gain: 0.02 * gain, pan, frequency: 1800 });
      break;
    case "buildComplete":
      tone(audio, dest, { frequency: 230, endFrequency: 330, duration: 0.12, type: "triangle", gain: 0.04 * gain, pan, cutoff: 1800 });
      tone(audio, dest, { frequency: 330, endFrequency: 500, duration: 0.16, type: "triangle", gain: 0.04 * gain, pan, cutoff: 2400 });
      break;
    case "productionComplete":
      tone(audio, dest, { frequency: 440, endFrequency: 660, duration: 0.09, type: "square", gain: 0.03 * gain, pan, cutoff: 2300 });
      tone(audio, dest, { frequency: 660, duration: 0.07, type: "sine", gain: 0.025 * gain, pan, cutoff: 3000 });
      break;
    case "repair":
      tone(audio, dest, { frequency: 180, endFrequency: 280, duration: 0.24, type: "triangle", gain: 0.028 * gain, pan, cutoff: 1200 });
      noise(audio, dest, { duration: 0.16, gain: 0.012 * gain, pan, frequency: 900 });
      break;
    case "sell":
      tone(audio, dest, { frequency: 300, endFrequency: 95, duration: 0.22, type: "sawtooth", gain: 0.035 * gain, pan, cutoff: 1000 });
      break;
    case "smallArms":
      noise(audio, dest, { duration: 0.045, gain: 0.048 * gain, pan, frequency: 2100, type: "highpass" });
      tone(audio, dest, { frequency: 740, endFrequency: 420, duration: 0.035, type: "square", gain: 0.018 * gain, pan, cutoff: 2600 });
      break;
    case "antiArmor":
      tone(audio, dest, { frequency: 180, endFrequency: 70, duration: 0.18, type: "sawtooth", gain: 0.07 * gain, pan, cutoff: 1200 });
      noise(audio, dest, { duration: 0.11, gain: 0.035 * gain, pan, frequency: 1500 });
      break;
    case "cannon":
      tone(audio, dest, { frequency: 105, endFrequency: 38, duration: 0.28, type: "sine", gain: 0.095 * gain, pan, cutoff: 900 });
      noise(audio, dest, { duration: 0.18, gain: 0.06 * gain, pan, frequency: 850, type: "lowpass" });
      break;
    case "impact":
      noise(audio, dest, { duration: 0.09, gain: 0.055 * gain, pan, frequency: 1150 });
      tone(audio, dest, { frequency: 170, endFrequency: 80, duration: 0.12, type: "triangle", gain: 0.035 * gain, pan, cutoff: 900 });
      break;
    case "destruction":
      tone(audio, dest, { frequency: 100, endFrequency: 30, duration: 0.5, type: "sine", gain: 0.11 * gain, pan, cutoff: 700 });
      noise(audio, dest, { duration: 0.32, gain: 0.09 * gain, pan, frequency: 500, type: "lowpass" });
      break;
    case "warning":
      tone(audio, dest, { frequency: 220, duration: 0.14, type: "square", gain: 0.05 * gain, pan, cutoff: 1500 });
      tone(audio, dest, { frequency: 165, duration: 0.14, type: "square", gain: 0.05 * gain, pan, cutoff: 1500 });
      break;
    case "objective":
      tone(audio, dest, { frequency: 280, endFrequency: 420, duration: 0.2, type: "triangle", gain: 0.045 * gain, pan, cutoff: 2200 });
      tone(audio, dest, { frequency: 560, duration: 0.1, type: "sine", gain: 0.022 * gain, pan, cutoff: 2800 });
      break;
    case "contact":
      tone(audio, dest, { frequency: 240, endFrequency: 190, duration: 0.16, type: "square", gain: 0.045 * gain, pan, cutoff: 1600 });
      noise(audio, dest, { duration: 0.08, gain: 0.018 * gain, pan, frequency: 1800 });
      break;
    case "victory":
      tone(audio, dest, { frequency: 392, endFrequency: 523, duration: 0.18, type: "triangle", gain: 0.055 * gain, pan, cutoff: 2400 });
      tone(audio, dest, { frequency: 523, endFrequency: 784, duration: 0.3, type: "triangle", gain: 0.06 * gain, pan, cutoff: 2800 });
      break;
    case "defeat":
      tone(audio, dest, { frequency: 150, endFrequency: 72, duration: 0.48, type: "sawtooth", gain: 0.07 * gain, pan, cutoff: 900 });
      noise(audio, dest, { duration: 0.18, gain: 0.025 * gain, pan, frequency: 500, type: "lowpass" });
      break;
  }
}

export function playSfx(kind: SfxKind, options: SfxOptions = {}): void {
  if (!sfxEnabled || !isAudioUnlocked()) return;
  const audio = getAudioContext();
  const dest = getAudioBus("sfx");
  if (!audio || !dest) return;
  const now = audio.currentTime;
  const minInterval = options.minInterval ?? DEFAULT_INTERVALS[kind] ?? 0;
  const previous = lastPlayed.get(kind) ?? Number.NEGATIVE_INFINITY;
  if (!options.force && now - previous < minInterval) return;
  lastPlayed.set(kind, now);
  resumeAudio();
  playLayered(kind, audio, dest, Math.max(-0.9, Math.min(0.9, options.pan ?? 0)), Math.max(0, options.gain ?? 1));
}

/** Backwards-compatible shorthand for existing command/UI call sites. */
export function beep(kind: BeepKind): void {
  const mapped: Record<BeepKind, SfxKind> = {
    select: "uiSelect",
    ack: "uiConfirm",
    build: "buildStart",
    alert: "warning",
    win: "victory",
    lose: "defeat",
  };
  playSfx(mapped[kind]);
}
