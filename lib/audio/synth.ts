import { getAudioContext, isAudioUnlocked, resumeAudio } from "./context";
import { getAudioBus, setAudioBusEnabled } from "./mixer";

export type BeepKind = "select" | "ack" | "ackAttack" | "ackHarvest" | "build" | "cancel" | "alert" | "win" | "lose";

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
  | "defeat"
  | "orderAttack"
  | "orderHarvest"
  | "credits"
  | "powerShortage"
  | "insufficientFunds"
  | "deadline";

export type SfxOptions = {
  pan?: number;
  gain?: number;
  minInterval?: number;
  force?: boolean;
  heavy?: boolean;
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
  credits: 0.12,
  powerShortage: 0.8,
  insufficientFunds: 0.18,
};

export function setSfxEnabled(value: boolean): void {
  sfxEnabled = value;
  setAudioBusEnabled("sfx", value);
}

export function isSfxEnabled(): boolean {
  return sfxEnabled;
}

function jitter(hz: number, amount = 0.06): number {
  return Math.max(20, hz * (1 + (Math.random() * 2 - 1) * amount));
}

function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === audio.sampleRate) return noiseBuf;
  const buffer = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * 0.4)), audio.sampleRate);
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
    delay?: number;
  },
): void {
  const o = audio.createOscillator();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  const start = audio.currentTime + Math.max(0, options.delay ?? 0);
  const attack = Math.min(0.012, options.duration * 0.25);
  o.type = options.type;
  o.frequency.setValueAtTime(Math.max(20, options.frequency), start);
  if (options.endFrequency !== undefined) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), start + options.duration);
  }
  f.type = "lowpass";
  f.frequency.setValueAtTime(options.cutoff ?? 2600, start);
  f.Q.setValueAtTime(0.8, start);
  g.gain.setValueAtTime(0.001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, options.gain), start + attack);
  g.gain.exponentialRampToValueAtTime(0.001, start + options.duration);
  o.connect(f);
  f.connect(g);
  connect(audio, g, dest, options.pan);
  o.start(start);
  o.stop(start + options.duration + 0.03);
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
    delay?: number;
    q?: number;
  },
): void {
  const source = audio.createBufferSource();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  const start = audio.currentTime + Math.max(0, options.delay ?? 0);
  const attack = Math.min(0.006, options.duration * 0.2);
  source.buffer = getNoiseBuffer(audio);
  source.loop = true;
  f.type = options.type ?? "bandpass";
  f.frequency.setValueAtTime(options.frequency, start);
  f.Q.setValueAtTime(options.q ?? 1.1, start);
  g.gain.setValueAtTime(0.001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, options.gain), start + attack);
  g.gain.exponentialRampToValueAtTime(0.001, start + options.duration);
  source.connect(f);
  f.connect(g);
  connect(audio, g, dest, options.pan);
  source.start(start);
  source.stop(start + options.duration + 0.03);
}

function playLayered(kind: SfxKind, audio: AudioContext, dest: AudioNode, pan: number, gain: number, heavy: boolean): void {
  switch (kind) {
    case "uiSelect":
      tone(audio, dest, { frequency: 480, duration: 0.04, type: "square", gain: 0.032 * gain, pan, cutoff: 2000 });
      break;
    case "uiConfirm":
      tone(audio, dest, { frequency: 420, endFrequency: 640, duration: 0.09, type: "triangle", gain: 0.038 * gain, pan, cutoff: 2400 });
      tone(audio, dest, { frequency: 840, duration: 0.045, type: "sine", gain: 0.016 * gain, pan, cutoff: 3200 });
      break;
    case "uiCancel":
      tone(audio, dest, { frequency: 340, endFrequency: 160, duration: 0.11, type: "triangle", gain: 0.036 * gain, pan, cutoff: 1600 });
      break;
    case "uiError":
      tone(audio, dest, { frequency: 110, endFrequency: 70, duration: 0.2, type: "square", gain: 0.05 * gain, pan, cutoff: 900 });
      noise(audio, dest, { duration: 0.08, gain: 0.02 * gain, pan, frequency: 700, type: "lowpass" });
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
    case "smallArms": {
      const crack = jitter(3200, 0.08);
      noise(audio, dest, { duration: 0.028, gain: 0.07 * gain, pan, frequency: crack, type: "highpass", q: 0.7 });
      tone(audio, dest, { frequency: jitter(1900, 0.08), endFrequency: 420, duration: 0.018, type: "square", gain: 0.022 * gain, pan, cutoff: 4200 });
      break;
    }
    case "antiArmor": {
      const startHz = jitter(95, 0.05);
      tone(audio, dest, { frequency: startHz, endFrequency: jitter(240, 0.05), duration: 0.09, type: "sawtooth", gain: 0.045 * gain, pan, cutoff: 1400 });
      tone(audio, dest, { frequency: jitter(220, 0.05), endFrequency: 48, duration: 0.16, type: "sawtooth", gain: 0.07 * gain, pan, cutoff: 1100, delay: 0.07 });
      noise(audio, dest, { duration: 0.12, gain: 0.05 * gain, pan, frequency: 900, type: "lowpass", delay: 0.12 });
      break;
    }
    case "cannon": {
      tone(audio, dest, { frequency: jitter(68, 0.04), endFrequency: 26, duration: 0.4, type: "sine", gain: 0.12 * gain, pan, cutoff: 420 });
      noise(audio, dest, { duration: 0.22, gain: 0.08 * gain, pan, frequency: 280, type: "lowpass" });
      noise(audio, dest, { duration: 0.025, gain: 0.055 * gain, pan, frequency: jitter(2400, 0.08), type: "highpass" });
      break;
    }
    case "impact":
      noise(audio, dest, { duration: 0.07, gain: 0.07 * gain, pan, frequency: jitter(900, 0.08), type: "lowpass" });
      tone(audio, dest, { frequency: jitter(90, 0.05), endFrequency: 40, duration: 0.08, type: "sine", gain: 0.045 * gain, pan, cutoff: 500 });
      break;
    case "destruction": {
      const scale = heavy ? 1.28 : 1;
      tone(audio, dest, { frequency: jitter(88, 0.04), endFrequency: 22, duration: 0.55 * scale, type: "sine", gain: 0.12 * gain, pan, cutoff: 520 });
      tone(audio, dest, { frequency: jitter(46, 0.04), endFrequency: 18, duration: 0.7 * scale, type: "sine", gain: 0.08 * gain, pan, cutoff: 280 });
      noise(audio, dest, { duration: 0.42 * scale, gain: 0.1 * gain, pan, frequency: heavy ? 320 : 420, type: "lowpass" });
      break;
    }
    case "warning":
      tone(audio, dest, { frequency: 880, duration: 0.09, type: "square", gain: 0.048 * gain, pan, cutoff: 2200 });
      tone(audio, dest, { frequency: 660, duration: 0.12, type: "square", gain: 0.05 * gain, pan, cutoff: 1800, delay: 0.11 });
      break;
    case "objective":
      tone(audio, dest, { frequency: 280, endFrequency: 420, duration: 0.2, type: "triangle", gain: 0.045 * gain, pan, cutoff: 2200 });
      tone(audio, dest, { frequency: 560, duration: 0.1, type: "sine", gain: 0.022 * gain, pan, cutoff: 2800 });
      break;
    case "contact":
      tone(audio, dest, { frequency: 520, endFrequency: 310, duration: 0.14, type: "square", gain: 0.042 * gain, pan, cutoff: 2400 });
      noise(audio, dest, { duration: 0.05, gain: 0.016 * gain, pan, frequency: 2600, type: "highpass" });
      break;
    case "victory":
      tone(audio, dest, { frequency: 392, endFrequency: 523, duration: 0.18, type: "triangle", gain: 0.055 * gain, pan, cutoff: 2400 });
      tone(audio, dest, { frequency: 523, endFrequency: 784, duration: 0.3, type: "triangle", gain: 0.06 * gain, pan, cutoff: 2800 });
      break;
    case "defeat":
      tone(audio, dest, { frequency: 150, endFrequency: 72, duration: 0.48, type: "sawtooth", gain: 0.07 * gain, pan, cutoff: 900 });
      noise(audio, dest, { duration: 0.18, gain: 0.025 * gain, pan, frequency: 500, type: "lowpass" });
      break;
    case "orderAttack":
      tone(audio, dest, { frequency: 620, duration: 0.05, type: "square", gain: 0.04 * gain, pan, cutoff: 2600 });
      tone(audio, dest, { frequency: 310, duration: 0.09, type: "square", gain: 0.038 * gain, pan, cutoff: 1800, delay: 0.05 });
      break;
    case "orderHarvest":
      tone(audio, dest, { frequency: 640, duration: 0.045, type: "triangle", gain: 0.034 * gain, pan, cutoff: 2200 });
      tone(audio, dest, { frequency: 960, duration: 0.07, type: "triangle", gain: 0.03 * gain, pan, cutoff: 2800, delay: 0.04 });
      break;
    case "credits":
      tone(audio, dest, { frequency: 880, duration: 0.05, type: "triangle", gain: 0.036 * gain, pan, cutoff: 3200 });
      tone(audio, dest, { frequency: 1320, duration: 0.07, type: "triangle", gain: 0.032 * gain, pan, cutoff: 4000, delay: 0.045 });
      break;
    case "powerShortage":
      tone(audio, dest, { frequency: 72, endFrequency: 48, duration: 0.22, type: "square", gain: 0.055 * gain, pan, cutoff: 700 });
      noise(audio, dest, { duration: 0.12, gain: 0.03 * gain, pan, frequency: 1800, type: "bandpass" });
      tone(audio, dest, { frequency: 48, duration: 0.1, type: "square", gain: 0.04 * gain, pan, cutoff: 500, delay: 0.16 });
      break;
    case "insufficientFunds":
      tone(audio, dest, { frequency: 160, duration: 0.07, type: "square", gain: 0.048 * gain, pan, cutoff: 900 });
      tone(audio, dest, { frequency: 120, duration: 0.11, type: "square", gain: 0.05 * gain, pan, cutoff: 700, delay: 0.09 });
      break;
    case "deadline":
      tone(audio, dest, { frequency: 990, duration: 0.08, type: "square", gain: 0.05 * gain, pan, cutoff: 2800 });
      tone(audio, dest, { frequency: 660, duration: 0.14, type: "square", gain: 0.052 * gain, pan, cutoff: 2200, delay: 0.1 });
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
  playLayered(
    kind,
    audio,
    dest,
    Math.max(-0.9, Math.min(0.9, options.pan ?? 0)),
    Math.max(0, options.gain ?? 1),
    options.heavy === true,
  );
}

/** Backwards-compatible shorthand for existing command/UI call sites. */
export function beep(kind: BeepKind): void {
  const mapped: Record<BeepKind, SfxKind> = {
    select: "uiSelect",
    ack: "uiConfirm",
    ackAttack: "orderAttack",
    ackHarvest: "orderHarvest",
    build: "buildStart",
    cancel: "uiCancel",
    alert: "warning",
    win: "victory",
    lose: "defeat",
  };
  playSfx(mapped[kind]);
}
