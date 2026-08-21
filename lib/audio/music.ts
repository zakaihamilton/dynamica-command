import {
  composeMusic,
  TITLE_MUSIC_SEED,
  TUTORIAL_MUSIC_MISSION,
  type MusicCue,
  type MusicPattern,
  type MusicVoiceType,
} from "./compose";
import { getAudioContext, peekAudioContext, unlockAudioContext } from "./context";
import { getAudioBus, setAudioBusEnabled } from "./mixer";

export { TITLE_MUSIC_SEED, TUTORIAL_MUSIC_MISSION, type MusicCue };

export type MusicIntensity = "calm" | "engaged" | "critical";

const MASTER_GAIN = 0.07;
const PAD_GAIN = 0.12;
const DUCK_RATIO = 0.35;
const CROSSFADE_S = 0.4;
const SCHEDULE_AHEAD_S = 0.18;
const SCHEDULER_MS = 25;
const ATTACK_S = 0.012;
const INTENSITY_MULTIPLIER: Record<MusicIntensity, number> = {
  calm: 0.82,
  engaged: 1,
  critical: 1.08,
};

let enabled = true;
let ducked = false;
let paused = false;
let intensity: MusicIntensity = "calm";
let cue: MusicCue = "menu";
let seed = TITLE_MUSIC_SEED;
let missionIndex = 0;
let pattern: MusicPattern | null = null;
let timer: number | null = null;
let nextNoteTime = 0;
let step = 0;
let musicGain: GainNode | null = null;
let hipass: BiquadFilterNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let leadGain: GainNode | null = null;
let leadPan: StereoPannerNode | null = null;
let arpPan: StereoPannerNode | null = null;
let delayNode: DelayNode | null = null;
let delayFeedback: GainNode | null = null;
let delayWet: GainNode | null = null;
let padGain: GainNode | null = null;
let padFilter: BiquadFilterNode | null = null;
let padOscA: OscillatorNode | null = null;
let padOscB: OscillatorNode | null = null;
let padLfo: OscillatorNode | null = null;
let padLfoGain: GainNode | null = null;
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

function masterGain(): number {
  return MASTER_GAIN * INTENSITY_MULTIPLIER[intensity] * (ducked ? DUCK_RATIO : 1);
}

function layerMultiplier(layer: "bass" | "arp" | "counter" | "melody" | "drums"): number {
  if (intensity === "critical") return 1;
  if (intensity === "engaged") return layer === "drums" ? 1.05 : 1;
  if (layer === "counter") return 0.35;
  if (layer === "melody") return 0.72;
  if (layer === "drums") return 0.76;
  return 0.86;
}

function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === audio.sampleRate) return noiseBuf;
  const buf = audio.createBuffer(1, Math.max(1, Math.floor(audio.sampleRate * 0.12)), audio.sampleRate);
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

function holdSteps(lane: readonly (number | null)[], index: number, cap: number): number {
  if (lane[index] == null) return 0;
  let n = 1;
  while (n < cap && index + n < lane.length && lane[index + n] == null) n++;
  return n;
}

function playTone(
  audio: AudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  dur: number,
  type: MusicVoiceType,
  gain: number,
  cutoff: number,
): void {
  const o = audio.createOscillator();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  const attack = Math.min(ATTACK_S, dur * 0.25);
  o.type = type;
  o.frequency.setValueAtTime(freq, time);
  f.type = "lowpass";
  f.Q.setValueAtTime(0.7, time);
  f.frequency.setValueAtTime(Math.max(cutoff * 1.7, 200), time);
  f.frequency.exponentialRampToValueAtTime(Math.max(cutoff * 0.4, 90), time + dur);
  g.gain.setValueAtTime(0.001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + attack);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(f);
  f.connect(g);
  g.connect(dest);
  o.start(time);
  o.stop(time + dur + 0.02);
}

function playNoise(
  audio: AudioContext,
  dest: AudioNode,
  time: number,
  gain: number,
  hipassHz: number,
  dur: number,
  filterType: BiquadFilterType = "highpass",
): void {
  const src = audio.createBufferSource();
  const g = audio.createGain();
  const f = audio.createBiquadFilter();
  const attack = 0.004;
  src.buffer = getNoiseBuffer(audio);
  f.type = filterType;
  f.frequency.setValueAtTime(hipassHz, time);
  if (filterType === "bandpass") f.Q.setValueAtTime(1.1, time);
  g.gain.setValueAtTime(0.001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + attack);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + dur + 0.02);
}

function playKick(audio: AudioContext, dest: AudioNode, time: number, gainScale = 1): void {
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(140, time);
  o.frequency.exponentialRampToValueAtTime(38, time + 0.16);
  g.gain.setValueAtTime(0.001, time);
  g.gain.exponentialRampToValueAtTime(0.55 * gainScale, time + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  o.connect(g);
  g.connect(dest);
  o.start(time);
  o.stop(time + 0.22);
  playNoise(audio, dest, time, 0.08 * gainScale, 2500, 0.018);
}

function playSnare(audio: AudioContext, dest: AudioNode, time: number, accent: boolean, gainScale = 1): void {
  playNoise(audio, dest, time, (accent ? 0.14 : 0.055) * gainScale, 1900, accent ? 0.09 : 0.045, "bandpass");
  playTone(audio, dest, 190, time, accent ? 0.06 : 0.035, "triangle", (accent ? 0.08 : 0.03) * gainScale, 1600);
}

function duckPad(audio: AudioContext, time: number): void {
  if (!padGain) return;
  const now = Math.max(time, audio.currentTime);
  const current = Math.max(padGain.gain.value, 0.001);
  padGain.gain.cancelScheduledValues(now);
  padGain.gain.setValueAtTime(current, now);
  padGain.gain.linearRampToValueAtTime(current * 0.45, now + 0.02);
  padGain.gain.linearRampToValueAtTime(PAD_GAIN, now + 0.09);
}

function syncDelay(audio: AudioContext, p: MusicPattern): void {
  if (!delayNode) return;
  const sec = Math.max(0.05, (60 / p.bpm) * p.delayBeats);
  delayNode.delayTime.setTargetAtTime(sec, audio.currentTime, 0.04);
}

function retunePad(bar: number): void {
  const audio = getAudioContext();
  if (!audio || !pattern || !padOscA || !padOscB) return;
  const i = ((bar % pattern.bars) + pattern.bars) % pattern.bars;
  const root = pattern.padRoot[i] ?? pattern.rootHz;
  const fifth = pattern.padFifth[i] ?? root * 1.5;
  const t = audio.currentTime;
  padOscA.frequency.setTargetAtTime(root, t, 0.06);
  padOscB.frequency.setTargetAtTime(fifth * 1.003, t, 0.06);
}

function scheduleStep(audio: AudioContext, dest: AudioNode, when: number, index: number): void {
  const p = pattern;
  if (!p) return;
  const stepDur = 60 / p.bpm / 4;
  const t = when + (index % 2 === 1 ? p.swing * stepDur : 0);
  if (index % 16 === 0) retunePad(index / 16);

  const bass = p.bass[index];
  const arp = p.arp[index];
  const melody = p.melody[index];
  const counter = p.counter[index];
  if (bass !== null) {
    const dur = holdSteps(p.bass, index, 16) * stepDur;
    playTone(audio, dest, bass, t, dur, p.bassType, 0.36 * layerMultiplier("bass"), Math.min(p.cutoff, 520));
  }
  if (arp !== null) playTone(audio, arpPan ?? dest, arp, t, stepDur * 0.7, p.arpType, 0.08 * layerMultiplier("arp"), Math.min(p.cutoff, 900));
  if (counter !== null) playTone(audio, dest, counter, t, stepDur * 0.95, "triangle", 0.07 * layerMultiplier("counter"), p.cutoff);
  if (melody !== null) {
    const dur = holdSteps(p.melody, index, 16) * stepDur;
    playTone(audio, leadGain ?? dest, melody, t, dur, p.melodyType, 0.14 * layerMultiplier("melody"), p.cutoff + 180);
  }
  if (p.kick[index]) {
    playKick(audio, dest, t, layerMultiplier("drums"));
    duckPad(audio, t);
  }
  const backbeat = index % 16 === 4 || index % 16 === 12;
  if (p.snare[index]) playSnare(audio, dest, t, backbeat, layerMultiplier("drums"));
  if (p.openHats[index]) playNoise(audio, dest, t, 0.045 * layerMultiplier("drums"), 3800, 0.12);
  else if (p.hats[index]) playNoise(audio, dest, t, 0.035 * layerMultiplier("drums"), 7500, 0.018);
}

function stopOsc(node: OscillatorNode | null): void {
  if (!node) return;
  try {
    node.stop();
  } catch {
    /* already stopped */
  }
  node.disconnect();
}

function stopPad(): void {
  stopOsc(padOscA);
  stopOsc(padOscB);
  stopOsc(padLfo);
  padFilter?.disconnect();
  padGain?.disconnect();
  padLfoGain?.disconnect();
  padOscA = null;
  padOscB = null;
  padLfo = null;
  padFilter = null;
  padGain = null;
  padLfoGain = null;
}

function startPad(audio: AudioContext): void {
  if (!musicGain || !pattern) return;
  stopPad();
  padGain = audio.createGain();
  padFilter = audio.createBiquadFilter();
  padOscA = audio.createOscillator();
  padOscB = audio.createOscillator();
  padLfo = audio.createOscillator();
  padLfoGain = audio.createGain();
  padFilter.type = "lowpass";
  padFilter.frequency.setValueAtTime(Math.min(pattern.cutoff, 640), audio.currentTime);
  padFilter.Q.setValueAtTime(0.8, audio.currentTime);
  padGain.gain.setValueAtTime(PAD_GAIN, audio.currentTime);
  padOscA.type = "triangle";
  padOscB.type = "sine";
  padOscA.frequency.setValueAtTime(pattern.padRoot[0] ?? pattern.rootHz, audio.currentTime);
  padOscB.frequency.setValueAtTime((pattern.padFifth[0] ?? pattern.rootHz * 1.5) * 1.003, audio.currentTime);
  padLfo.type = "sine";
  padLfo.frequency.setValueAtTime(0.13, audio.currentTime);
  padLfoGain.gain.setValueAtTime(160, audio.currentTime);
  padOscA.connect(padFilter);
  padOscB.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(musicGain);
  padLfo.connect(padLfoGain);
  padLfoGain.connect(padFilter.frequency);
  padOscA.start();
  padOscB.start();
  padLfo.start();
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
  const musicBus = getAudioBus("music");
  if (!musicBus) return;
  musicGain = audio.createGain();
  hipass = audio.createBiquadFilter();
  compressor = audio.createDynamicsCompressor();
  hipass.type = "highpass";
  hipass.frequency.setValueAtTime(40, audio.currentTime);
  compressor.threshold.setValueAtTime(-18, audio.currentTime);
  compressor.knee.setValueAtTime(8, audio.currentTime);
  compressor.ratio.setValueAtTime(3.2, audio.currentTime);
  compressor.attack.setValueAtTime(0.008, audio.currentTime);
  compressor.release.setValueAtTime(0.12, audio.currentTime);
  musicGain.gain.setValueAtTime(Math.max(masterGain(), 0.001), audio.currentTime);
  musicGain.connect(hipass);
  hipass.connect(compressor);
  compressor.connect(musicBus);

  arpPan = audio.createStereoPanner();
  arpPan.pan.setValueAtTime(-0.28, audio.currentTime);
  arpPan.connect(musicGain);

  leadPan = audio.createStereoPanner();
  leadPan.pan.setValueAtTime(0.26, audio.currentTime);
  leadGain = audio.createGain();
  leadGain.gain.setValueAtTime(1, audio.currentTime);
  leadGain.connect(leadPan);
  leadPan.connect(musicGain);

  delayNode = audio.createDelay(1.2);
  delayFeedback = audio.createGain();
  delayWet = audio.createGain();
  delayFeedback.gain.setValueAtTime(0.18, audio.currentTime);
  delayWet.gain.setValueAtTime(0.16, audio.currentTime);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayNode.connect(delayWet);
  delayWet.connect(musicGain);
  leadGain.connect(delayNode);
  if (pattern) syncDelay(audio, pattern);

  startPad(audio);
  nextNoteTime = audio.currentTime + 0.06;
  step = 0;
  timer = window.setInterval(tickScheduler, SCHEDULER_MS);
  tickScheduler();
}

function stopDelay(): void {
  delayNode?.disconnect();
  delayFeedback?.disconnect();
  delayWet?.disconnect();
  leadGain?.disconnect();
  leadPan?.disconnect();
  arpPan?.disconnect();
  delayNode = null;
  delayFeedback = null;
  delayWet = null;
  leadGain = null;
  leadPan = null;
  arpPan = null;
}

function stopMusic(): void {
  fadeGen += 1;
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  stopPad();
  stopDelay();
  hipass?.disconnect();
  compressor?.disconnect();
  hipass = null;
  compressor = null;
  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
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
    retunePad(0);
    const c = getAudioContext();
    if (!c || !musicGain) return;
    syncDelay(c, next);
    const t = c.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(0.001, t);
    musicGain.gain.linearRampToValueAtTime(Math.max(masterGain(), 0.001), t + half);
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
  if (!audio || !musicGain) return;
  const now = audio.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(Math.max(musicGain.gain.value, 0.001), now);
  musicGain.gain.linearRampToValueAtTime(Math.max(masterGain(), 0.001), now + 0.08);
}

export function setMusicIntensity(value: MusicIntensity): void {
  if (intensity === value) return;
  intensity = value;
  const audio = peekAudioContext();
  if (!audio || !musicGain) return;
  const now = audio.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(Math.max(musicGain.gain.value, 0.001), now);
  musicGain.gain.linearRampToValueAtTime(Math.max(masterGain(), 0.001), now + 0.18);
  if (padGain) {
    padGain.gain.cancelScheduledValues(now);
    padGain.gain.setValueAtTime(Math.max(padGain.gain.value, 0.001), now);
    padGain.gain.linearRampToValueAtTime(PAD_GAIN * (value === "calm" ? 0.9 : 1), now + 0.18);
  }
}

export function unlockAudio(): void {
  unlockAudioContext();
  ensureMusicPlaying();
}
