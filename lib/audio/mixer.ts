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

let levels: AudioLevels = { ...DEFAULT_LEVELS };
let enabled: Record<AudioBus, boolean> = { music: true, sfx: true };
let master: GainNode | null = null;
let music: GainNode | null = null;
let sfx: GainNode | null = null;
let sfxLimiter: DynamicsCompressorNode | null = null;

export function clampAudioVolume(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function applyLevels(audio: AudioContext): void {
  const now = audio.currentTime;
  master?.gain.setTargetAtTime(levels.masterVolume, now, RAMP_S);
  music?.gain.setTargetAtTime(enabled.music ? levels.musicVolume : 0, now, RAMP_S);
  sfx?.gain.setTargetAtTime(enabled.sfx ? levels.sfxVolume : 0, now, RAMP_S);
}

function ensureMixer(audio: AudioContext): void {
  if (master && music && sfx && sfxLimiter) return;

  master = audio.createGain();
  music = audio.createGain();
  sfx = audio.createGain();
  sfxLimiter = audio.createDynamicsCompressor();
  sfxLimiter.threshold.setValueAtTime(-14, audio.currentTime);
  sfxLimiter.knee.setValueAtTime(8, audio.currentTime);
  sfxLimiter.ratio.setValueAtTime(4, audio.currentTime);
  sfxLimiter.attack.setValueAtTime(0.003, audio.currentTime);
  sfxLimiter.release.setValueAtTime(0.15, audio.currentTime);
  music.connect(master);
  sfx.connect(sfxLimiter);
  sfxLimiter.connect(master);
  master.connect(audio.destination);
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
  master = null;
  music = null;
  sfx = null;
  sfxLimiter = null;
}
