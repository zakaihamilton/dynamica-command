import { getAudioContext, peekAudioContext } from "./context";

export type AudioBus = "music" | "sfx";
export type AudioVolumeKey = "masterVolume" | "musicVolume" | "sfxVolume";

export type AudioLevels = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
};

const DEFAULT_LEVELS: AudioLevels = {
  masterVolume: 1,
  musicVolume: 0.7,
  sfxVolume: 0.9,
};

const RAMP_S = 0.045;
/** Makeup after the limiter so compressed bodies stay present. */
export const SFX_MAKEUP_GAIN = 1.35;

let levels: AudioLevels = { ...DEFAULT_LEVELS };
let enabled: Record<AudioBus, boolean> = { music: true, sfx: true };
let master: GainNode | null = null;
let music: GainNode | null = null;
let sfx: GainNode | null = null;
let sfxLimiter: DynamicsCompressorNode | null = null;
let sfxMakeup: GainNode | null = null;

export function clampAudioVolume(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function applyLevels(audio: AudioContext): void {
  const now = audio.currentTime;
  master?.gain.setTargetAtTime(levels.masterVolume, now, RAMP_S);
  music?.gain.setTargetAtTime(enabled.music ? levels.musicVolume : 0, now, RAMP_S);
  sfx?.gain.setTargetAtTime(enabled.sfx ? levels.sfxVolume : 0, now, RAMP_S);
}

function disconnectNode(node: AudioNode | null): void {
  try {
    node?.disconnect();
  } catch {
    /* already disconnected or never connected */
  }
}

function teardownMixer(): void {
  disconnectNode(music);
  disconnectNode(sfx);
  disconnectNode(sfxLimiter);
  disconnectNode(sfxMakeup);
  disconnectNode(master);
  master = null;
  music = null;
  sfx = null;
  sfxLimiter = null;
  sfxMakeup = null;
}

function configureLimiter(limiter: DynamicsCompressorNode, now: number): void {
  limiter.threshold.setValueAtTime(-10, now);
  limiter.knee.setValueAtTime(3, now);
  limiter.ratio.setValueAtTime(12, now);
  limiter.attack.setValueAtTime(0, now);
  limiter.release.setValueAtTime(0.1, now);
}

function ensureMixer(audio: AudioContext): void {
  if (master && music && sfx && sfxLimiter && sfxMakeup) {
    applyLevels(audio);
    return;
  }

  teardownMixer();

  let nextMaster: GainNode | undefined;
  let nextMusic: GainNode | undefined;
  let nextSfx: GainNode | undefined;
  let nextLimiter: DynamicsCompressorNode | undefined;
  let nextMakeup: GainNode | undefined;
  try {
    nextMaster = audio.createGain();
    nextMusic = audio.createGain();
    nextSfx = audio.createGain();
    nextLimiter = audio.createDynamicsCompressor();
    nextMakeup = audio.createGain();
    configureLimiter(nextLimiter, audio.currentTime);
    nextMakeup.gain.setValueAtTime(SFX_MAKEUP_GAIN, audio.currentTime);
    nextMusic.connect(nextMaster);
    nextSfx.connect(nextLimiter);
    nextLimiter.connect(nextMakeup);
    nextMakeup.connect(nextMaster);
    nextMaster.connect(audio.destination);
  } catch (error) {
    disconnectNode(nextMusic ?? null);
    disconnectNode(nextSfx ?? null);
    disconnectNode(nextLimiter ?? null);
    disconnectNode(nextMakeup ?? null);
    disconnectNode(nextMaster ?? null);
    throw error;
  }

  master = nextMaster;
  music = nextMusic;
  sfx = nextSfx;
  sfxLimiter = nextLimiter;
  sfxMakeup = nextMakeup;
  applyLevels(audio);
}

export function getAudioBus(bus: AudioBus): AudioNode | null {
  const audio = getAudioContext();
  if (!audio) return null;
  ensureMixer(audio);
  return bus === "music" ? music : sfx;
}

export function setAudioLevels(next: Partial<AudioLevels>): void {
  levels = {
    masterVolume: next.masterVolume === undefined ? levels.masterVolume : clampAudioVolume(next.masterVolume),
    musicVolume: next.musicVolume === undefined ? levels.musicVolume : clampAudioVolume(next.musicVolume),
    sfxVolume: next.sfxVolume === undefined ? levels.sfxVolume : clampAudioVolume(next.sfxVolume),
  };
  const audio = peekAudioContext();
  if (audio) {
    ensureMixer(audio);
    applyLevels(audio);
  }
}

export function setAudioBusEnabled(bus: AudioBus, value: boolean): void {
  enabled[bus] = value;
  const audio = peekAudioContext();
  if (audio) {
    ensureMixer(audio);
    applyLevels(audio);
  }
}

export function getAudioLevels(): AudioLevels {
  return { ...levels };
}

export function resetAudioMixerForTests(): void {
  levels = { ...DEFAULT_LEVELS };
  enabled = { music: true, sfx: true };
  teardownMixer();
}
