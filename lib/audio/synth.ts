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
  | "heal"
  | "sell"
  | "smallArms"
  | "antiArmor"
  | "cannon"
  | "turret"
  | "impact"
  | "impactFlesh"
  | "impactMetal"
  | "destruction"
  | "wreckHuman"
  | "wreckVehicle"
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
const driveCurves = new Map<number, Float32Array>();

/** Max delay when staggering same-kind cues that share one audio.currentTime. */
export const MAX_SFX_QUEUE_S = 0.28;

const DEFAULT_INTERVALS: Partial<Record<SfxKind, number>> = {
  smallArms: 0.045,
  antiArmor: 0.1,
  cannon: 0.12,
  turret: 0.08,
  impact: 0.04,
  impactFlesh: 0.04,
  impactMetal: 0.04,
  destruction: 0.24,
  wreckHuman: 0.18,
  wreckVehicle: 0.2,
  contact: 0.22,
  credits: 0.12,
  heal: 0.16,
  repair: 0.16,
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

/** Next start time for a throttled cue, or null if the stagger queue is full. */
export function scheduleSfxTime(
  now: number,
  previous: number,
  minInterval: number,
  maxQueue = MAX_SFX_QUEUE_S,
): number | null {
  if (!Number.isFinite(now)) return null;
  if (!(minInterval > 0) || !Number.isFinite(previous)) return now;
  const start = Math.max(now, previous + minInterval);
  if (start - now > maxQueue) return null;
  return start;
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

function driveCurve(amount: number): Float32Array {
  const k = Math.max(1, amount);
  const cached = driveCurves.get(k);
  if (cached) return cached;
  const n = 257;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * k);
  }
  driveCurves.set(k, curve);
  return curve;
}

function createDrive(audio: AudioContext, amount: number): WaveShaperNode {
  const shaper = audio.createWaveShaper();
  shaper.curve = new Float32Array(driveCurve(amount));
  shaper.oversample = "2x";
  return shaper;
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
    drive?: number;
  },
): void {
  const o = audio.createOscillator();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  const start = audio.currentTime + Math.max(0, options.delay ?? 0);
  const attack = Math.min(0.008, options.duration * 0.18);
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
  if (options.drive && options.drive > 1) {
    const shaper = createDrive(audio, options.drive);
    f.connect(shaper);
    shaper.connect(g);
  } else {
    f.connect(g);
  }
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
    endFrequency?: number;
    type?: BiquadFilterType;
    delay?: number;
    q?: number;
  },
): void {
  const source = audio.createBufferSource();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  const start = audio.currentTime + Math.max(0, options.delay ?? 0);
  const attack = Math.min(0.004, options.duration * 0.16);
  source.buffer = getNoiseBuffer(audio);
  source.loop = true;
  f.type = options.type ?? "bandpass";
  f.frequency.setValueAtTime(options.frequency, start);
  if (options.endFrequency !== undefined) {
    f.frequency.exponentialRampToValueAtTime(Math.max(40, options.endFrequency), start + options.duration);
  }
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

function playLayered(
  kind: SfxKind,
  audio: AudioContext,
  dest: AudioNode,
  pan: number,
  gain: number,
  heavy: boolean,
  delay = 0,
): void {
  const playTone = (options: Parameters<typeof tone>[2]) =>
    tone(audio, dest, { ...options, delay: (options.delay ?? 0) + delay });
  const playNoise = (options: Parameters<typeof noise>[2]) =>
    noise(audio, dest, { ...options, delay: (options.delay ?? 0) + delay });
  switch (kind) {
    case "uiSelect":
      playTone({ frequency: 480, duration: 0.05, type: "square", gain: 0.05 * gain, pan, cutoff: 2400 });
      break;
    case "uiConfirm":
      playTone({ frequency: 420, endFrequency: 640, duration: 0.1, type: "triangle", gain: 0.055 * gain, pan, cutoff: 2400 });
      playTone({ frequency: 840, duration: 0.05, type: "sine", gain: 0.024 * gain, pan, cutoff: 3200 });
      break;
    case "uiCancel":
      playTone({ frequency: 340, endFrequency: 160, duration: 0.12, type: "triangle", gain: 0.055 * gain, pan, cutoff: 1600 });
      break;
    case "uiError":
      playTone({ frequency: 110, endFrequency: 70, duration: 0.22, type: "square", gain: 0.075 * gain, pan, cutoff: 900 });
      playNoise({ duration: 0.09, gain: 0.03 * gain, pan, frequency: 700, type: "lowpass" });
      break;
    case "buildStart":
      playTone({ frequency: 150, endFrequency: 230, duration: 0.16, type: "sawtooth", gain: 0.055 * gain, pan, cutoff: 1000 });
      playNoise({ duration: 0.07, gain: 0.03 * gain, pan, frequency: 1800 });
      break;
    case "buildComplete":
      playTone({ frequency: 230, endFrequency: 330, duration: 0.14, type: "triangle", gain: 0.06 * gain, pan, cutoff: 1800 });
      playTone({ frequency: 330, endFrequency: 500, duration: 0.18, type: "triangle", gain: 0.06 * gain, pan, cutoff: 2400 });
      break;
    case "productionComplete":
      playTone({ frequency: 440, endFrequency: 660, duration: 0.1, type: "square", gain: 0.048 * gain, pan, cutoff: 2300 });
      playTone({ frequency: 660, duration: 0.08, type: "sine", gain: 0.038 * gain, pan, cutoff: 3000 });
      break;
    case "repair":
      playTone({ frequency: 190, endFrequency: 260, duration: 0.2, type: "sawtooth", gain: 0.07 * gain, pan, cutoff: 1400, drive: 2.2 });
      playNoise({ duration: 0.18, gain: 0.1 * gain, pan, frequency: 2800, type: "highpass", q: 0.8 });
      playNoise({ duration: 0.08, gain: 0.06 * gain, pan, frequency: 4200, type: "highpass", delay: 0.05 });
      break;
    case "heal":
      playTone({ frequency: 420, endFrequency: 680, duration: 0.16, type: "triangle", gain: 0.08 * gain, pan, cutoff: 2600 });
      playTone({ frequency: 880, duration: 0.1, type: "sine", gain: 0.05 * gain, pan, cutoff: 3600, delay: 0.05 });
      break;
    case "sell":
      playTone({ frequency: 300, endFrequency: 95, duration: 0.24, type: "sawtooth", gain: 0.055 * gain, pan, cutoff: 1000 });
      break;
    case "smallArms": {
      playNoise({ duration: 0.014, gain: 0.12 * gain, pan, frequency: jitter(4800, 0.1), type: "highpass", q: 0.6 });
      playTone({ frequency: jitter(2100, 0.08), endFrequency: 380, duration: 0.055, type: "square", gain: 0.1 * gain, pan, cutoff: 5200 });
      playNoise({ duration: 0.07, gain: 0.11 * gain, pan, frequency: jitter(2600, 0.1), type: "bandpass", q: 1.4 });
      break;
    }
    case "antiArmor": {
      playNoise({ duration: 0.12, gain: 0.12 * gain, pan, frequency: 700, endFrequency: 2400, type: "bandpass", q: 1.6 });
      playTone({ frequency: jitter(90, 0.05), endFrequency: jitter(280, 0.05), duration: 0.12, type: "sawtooth", gain: 0.12 * gain, pan, cutoff: 1600, drive: 2.6 });
      playTone({ frequency: jitter(200, 0.05), endFrequency: 42, duration: 0.22, type: "sawtooth", gain: 0.18 * gain, pan, cutoff: 1100, delay: 0.11, drive: 3.2 });
      playNoise({ duration: 0.2, gain: 0.16 * gain, pan, frequency: 520, type: "lowpass", delay: 0.11 });
      playNoise({ duration: 0.04, gain: 0.1 * gain, pan, frequency: jitter(2200, 0.08), type: "highpass", delay: 0.11 });
      break;
    }
    case "cannon": {
      playTone({ frequency: jitter(55, 0.04), endFrequency: 22, duration: 0.5, type: "sine", gain: 0.28 * gain, pan, cutoff: 380 });
      playTone({ frequency: jitter(92, 0.04), endFrequency: 28, duration: 0.24, type: "sawtooth", gain: 0.16 * gain, pan, cutoff: 900, drive: 2.8 });
      playNoise({ duration: 0.04, gain: 0.11 * gain, pan, frequency: jitter(2200, 0.08), type: "highpass" });
      playNoise({ duration: 0.32, gain: 0.2 * gain, pan, frequency: 240, type: "lowpass" });
      break;
    }
    case "turret": {
      playNoise({ duration: 0.018, gain: 0.11 * gain, pan, frequency: jitter(3400, 0.08), type: "highpass", q: 0.7 });
      playTone({ frequency: jitter(480, 0.05), endFrequency: 90, duration: 0.08, type: "square", gain: 0.16 * gain, pan, cutoff: 2400, drive: 2.1 });
      playNoise({ duration: 0.09, gain: 0.13 * gain, pan, frequency: jitter(1500, 0.08), type: "bandpass", q: 1.3 });
      playTone({ frequency: jitter(70, 0.04), endFrequency: 32, duration: 0.14, type: "sine", gain: 0.1 * gain, pan, cutoff: 500 });
      break;
    }
    case "impactFlesh":
      playNoise({ duration: 0.09, gain: 0.14 * gain, pan, frequency: jitter(520, 0.08), type: "lowpass" });
      playTone({ frequency: jitter(150, 0.05), endFrequency: 48, duration: 0.1, type: "sine", gain: 0.09 * gain, pan, cutoff: 420 });
      break;
    case "impactMetal":
      playNoise({ duration: 0.05, gain: 0.16 * gain, pan, frequency: jitter(1900, 0.1), type: "bandpass", q: 2.6 });
      playTone({ frequency: jitter(980, 0.06), endFrequency: 220, duration: 0.07, type: "triangle", gain: 0.09 * gain, pan, cutoff: 2800 });
      playNoise({ duration: 0.08, gain: 0.1 * gain, pan, frequency: 420, type: "lowpass" });
      break;
    case "impact":
      playNoise({ duration: 0.12, gain: 0.18 * gain, pan, frequency: jitter(280, 0.08), type: "lowpass" });
      playTone({ frequency: jitter(72, 0.05), endFrequency: 26, duration: 0.14, type: "sine", gain: 0.14 * gain, pan, cutoff: 460 });
      playNoise({ duration: 0.04, gain: 0.1 * gain, pan, frequency: jitter(1400, 0.08), type: "highpass" });
      break;
    case "wreckHuman":
      playNoise({ duration: 0.18, gain: 0.14 * gain, pan, frequency: jitter(640, 0.08), type: "lowpass" });
      playTone({ frequency: jitter(120, 0.04), endFrequency: 38, duration: 0.28, type: "sine", gain: 0.12 * gain, pan, cutoff: 480 });
      break;
    case "wreckVehicle":
      playNoise({ duration: 0.12, gain: 0.16 * gain, pan, frequency: jitter(1700, 0.08), type: "bandpass", q: 1.8 });
      playNoise({ duration: 0.32, gain: 0.18 * gain, pan, frequency: 340, type: "lowpass" });
      playTone({ frequency: jitter(68, 0.04), endFrequency: 22, duration: 0.4, type: "sine", gain: 0.16 * gain, pan, cutoff: 360 });
      break;
    case "destruction": {
      const scale = heavy ? 1.28 : 1;
      playTone({ frequency: jitter(78, 0.04), endFrequency: 20, duration: 0.62 * scale, type: "sine", gain: 0.26 * gain, pan, cutoff: 480 });
      playTone({ frequency: jitter(42, 0.04), endFrequency: 16, duration: 0.78 * scale, type: "sine", gain: 0.18 * gain, pan, cutoff: 260 });
      playNoise({ duration: 0.48 * scale, gain: 0.22 * gain, pan, frequency: heavy ? 300 : 400, type: "lowpass" });
      playNoise({ duration: 0.08, gain: 0.14 * gain, pan, frequency: jitter(1600, 0.1), type: "highpass" });
      break;
    }
    case "warning":
      playTone({ frequency: 880, duration: 0.1, type: "square", gain: 0.11 * gain, pan, cutoff: 2200 });
      playTone({ frequency: 660, duration: 0.14, type: "square", gain: 0.12 * gain, pan, cutoff: 1800, delay: 0.11 });
      break;
    case "objective":
      playTone({ frequency: 280, endFrequency: 420, duration: 0.22, type: "triangle", gain: 0.1 * gain, pan, cutoff: 2200 });
      playTone({ frequency: 560, duration: 0.12, type: "sine", gain: 0.05 * gain, pan, cutoff: 2800 });
      break;
    case "contact":
      playTone({ frequency: 520, endFrequency: 310, duration: 0.16, type: "square", gain: 0.1 * gain, pan, cutoff: 2400 });
      playNoise({ duration: 0.06, gain: 0.04 * gain, pan, frequency: 2600, type: "highpass" });
      break;
    case "victory":
      playTone({ frequency: 392, endFrequency: 523, duration: 0.2, type: "triangle", gain: 0.12 * gain, pan, cutoff: 2400 });
      playTone({ frequency: 523, endFrequency: 784, duration: 0.32, type: "triangle", gain: 0.13 * gain, pan, cutoff: 2800 });
      break;
    case "defeat":
      playTone({ frequency: 150, endFrequency: 72, duration: 0.5, type: "sawtooth", gain: 0.15 * gain, pan, cutoff: 900 });
      playNoise({ duration: 0.2, gain: 0.055 * gain, pan, frequency: 500, type: "lowpass" });
      break;
    case "orderAttack":
      playTone({ frequency: 620, duration: 0.06, type: "square", gain: 0.06 * gain, pan, cutoff: 2600 });
      playTone({ frequency: 310, duration: 0.1, type: "square", gain: 0.055 * gain, pan, cutoff: 1800, delay: 0.05 });
      break;
    case "orderHarvest":
      playTone({ frequency: 640, duration: 0.05, type: "triangle", gain: 0.05 * gain, pan, cutoff: 2200 });
      playTone({ frequency: 960, duration: 0.08, type: "triangle", gain: 0.045 * gain, pan, cutoff: 2800, delay: 0.04 });
      break;
    case "credits":
      playTone({ frequency: 880, duration: 0.055, type: "triangle", gain: 0.055 * gain, pan, cutoff: 3200 });
      playTone({ frequency: 1320, duration: 0.08, type: "triangle", gain: 0.048 * gain, pan, cutoff: 4000, delay: 0.045 });
      break;
    case "powerShortage":
      playTone({ frequency: 72, endFrequency: 48, duration: 0.24, type: "square", gain: 0.12 * gain, pan, cutoff: 700 });
      playNoise({ duration: 0.14, gain: 0.065 * gain, pan, frequency: 1800, type: "bandpass" });
      playTone({ frequency: 48, duration: 0.12, type: "square", gain: 0.09 * gain, pan, cutoff: 500, delay: 0.16 });
      break;
    case "insufficientFunds":
      playTone({ frequency: 160, duration: 0.08, type: "square", gain: 0.11 * gain, pan, cutoff: 900 });
      playTone({ frequency: 120, duration: 0.12, type: "square", gain: 0.11 * gain, pan, cutoff: 700, delay: 0.09 });
      break;
    case "deadline":
      playTone({ frequency: 990, duration: 0.09, type: "square", gain: 0.11 * gain, pan, cutoff: 2800 });
      playTone({ frequency: 660, duration: 0.16, type: "square", gain: 0.12 * gain, pan, cutoff: 2200, delay: 0.1 });
      break;
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
    }
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
  let start = now;
  if (!options.force) {
    const scheduled = scheduleSfxTime(now, previous, minInterval);
    if (scheduled === null) return;
    start = scheduled;
  }
  lastPlayed.set(kind, start);
  resumeAudio();
  playLayered(
    kind,
    audio,
    dest,
    Math.max(-0.9, Math.min(0.9, options.pan ?? 0)),
    Math.max(0, options.gain ?? 1),
    options.heavy === true,
    Math.max(0, start - now),
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
