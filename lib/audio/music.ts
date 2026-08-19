import { composeMusic, TITLE_MUSIC_SEED, type MusicCue, type MusicPattern } from "./compose";
import { getAudioContext, resumeAudio } from "./context";

export { TITLE_MUSIC_SEED, type MusicCue };

const MASTER_GAIN = 0.07;
const DUCK_RATIO = 0.35;
const CROSSFADE_S = 0.4;
const SCHEDULE_AHEAD_S = 0.18;
const SCHEDULER_MS = 25;

let enabled = true;
let ducked = false;
let cue: MusicCue = "menu";
let seed = TITLE_MUSIC_SEED;
let pattern: MusicPattern | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextNoteTime = 0;
let step = 0;
let musicGain: GainNode | null = null;
let droneOsc: OscillatorNode | null = null;
let fadeGen = 0;
let noiseBuf: AudioBuffer | null = null;

export function musicCueFromPath(pathname: string): MusicCue {
  if (pathname.startsWith("/briefing")) return "briefing";
  if (pathname.startsWith("/play") || pathname.startsWith("/tutorial")) return "mission";
  if (pathname.startsWith("/campaign-complete")) return "victory";
  return "menu";
}

export function isMusicEnabled(): boolean {
  return enabled;
}

function masterGain(): number {
  return MASTER_GAIN * (ducked ? DUCK_RATIO : 1);
}

function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === audio.sampleRate) return noiseBuf;
  const buf = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * 0.12)), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

function playTone(
  audio: AudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  cutoff: number,
): void {
  const o = audio.createOscillator();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  o.type = type;
  o.frequency.setValueAtTime(freq, time);
  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff, time);
  g.gain.setValueAtTime(gain, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(f);
  f.connect(g);
  g.connect(dest);
  o.start(time);
  o.stop(time + dur);
}

function playHat(audio: AudioContext, dest: AudioNode, time: number, gain: number): void {
  const src = audio.createBufferSource();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  src.buffer = getNoiseBuffer(audio);
  f.type = "highpass";
  f.frequency.setValueAtTime(6000, time);
  g.gain.setValueAtTime(gain, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + 0.05);
}

function scheduleStep(audio: AudioContext, dest: AudioNode, when: number, index: number): void {
  const p = pattern;
  if (!p) return;
  const stepDur = 60 / p.bpm / 4;
  const bass = p.bass[index];
  const arp = p.arp[index];
  const melody = p.melody[index];
  if (bass !== null) playTone(audio, dest, bass, when, stepDur * 1.6, "triangle", 0.5, Math.min(p.cutoff, 900));
  if (arp !== null) playTone(audio, dest, arp, when, stepDur * 0.85, "square", 0.16, p.cutoff);
  if (melody !== null) playTone(audio, dest, melody, when, stepDur * 1.2, "triangle", 0.22, p.cutoff + 400);
  if (p.hats[index]) playHat(audio, dest, when, 0.12);
}

function stopDrone(): void {
  if (!droneOsc) return;
  try {
    droneOsc.stop();
  } catch {
    /* already stopped */
  }
  droneOsc.disconnect();
  droneOsc = null;
}

function startDrone(audio: AudioContext): void {
  if (!musicGain || !pattern) return;
  stopDrone();
  const o = audio.createOscillator();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  o.type = "sine";
  o.frequency.setValueAtTime(pattern.rootHz / 2, audio.currentTime);
  f.type = "lowpass";
  f.frequency.setValueAtTime(Math.min(pattern.cutoff, 700), audio.currentTime);
  g.gain.setValueAtTime(0.22, audio.currentTime);
  o.connect(f);
  f.connect(g);
  g.connect(musicGain);
  o.start();
  droneOsc = o;
}

function retuneDrone(): void {
  const audio = getAudioContext();
  if (!audio || !droneOsc || !pattern) return;
  droneOsc.frequency.setTargetAtTime(pattern.rootHz / 2, audio.currentTime, 0.08);
}

function tickScheduler(): void {
  const audio = getAudioContext();
  if (!audio || !musicGain || !pattern) return;
  const stepDur = 60 / pattern.bpm / 4;
  while (nextNoteTime < audio.currentTime + SCHEDULE_AHEAD_S) {
    scheduleStep(audio, musicGain, nextNoteTime, step);
    nextNoteTime += stepDur;
    step = (step + 1) % pattern.steps;
  }
}

function startGraph(audio: AudioContext): void {
  musicGain = audio.createGain();
  musicGain.gain.setValueAtTime(Math.max(masterGain(), 0.001), audio.currentTime);
  musicGain.connect(audio.destination);
  startDrone(audio);
  nextNoteTime = audio.currentTime + 0.06;
  step = 0;
  timer = setInterval(tickScheduler, SCHEDULER_MS);
  tickScheduler();
}

function stopMusic(): void {
  fadeGen += 1;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  stopDrone();
  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
  }
}

function ensureMusicPlaying(): void {
  if (!enabled) return;
  const audio = resumeAudio();
  if (!audio) return;
  if (!pattern) pattern = composeMusic(seed, cue);
  if (timer) return;
  startGraph(audio);
}

function applyPattern(next: MusicPattern): void {
  const audio = getAudioContext();
  if (!audio || !musicGain || !timer) {
    pattern = next;
    return;
  }
  const gen = ++fadeGen;
  const now = audio.currentTime;
  const half = CROSSFADE_S / 2;
  const from = Math.max(musicGain.gain.value, 0.001);
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(from, now);
  musicGain.gain.linearRampToValueAtTime(0.001, now + half);
  window.setTimeout(() => {
    if (gen !== fadeGen) return;
    pattern = next;
    step = 0;
    retuneDrone();
    const c = getAudioContext();
    if (!c || !musicGain) return;
    const t = c.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(0.001, t);
    musicGain.gain.linearRampToValueAtTime(Math.max(masterGain(), 0.001), t + half);
  }, half * 1000);
}

export function setMusicCue(nextCue: MusicCue, nextSeed: number): void {
  if (cue === nextCue && seed === nextSeed && pattern) return;
  cue = nextCue;
  seed = nextSeed;
  const next = composeMusic(nextSeed, nextCue);
  if (timer) applyPattern(next);
  else pattern = next;
}

export function setMusicEnabled(value: boolean): void {
  enabled = value;
  if (!value) stopMusic();
  else ensureMusicPlaying();
}

export function setMusicDucked(value: boolean): void {
  ducked = value;
  const audio = getAudioContext();
  if (!audio || !musicGain) return;
  const now = audio.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(Math.max(musicGain.gain.value, 0.001), now);
  musicGain.gain.linearRampToValueAtTime(Math.max(masterGain(), 0.001), now + 0.08);
}

export function unlockAudio(): void {
  resumeAudio();
  ensureMusicPlaying();
}
