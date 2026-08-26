import { composeMusic, midiToHz, STEPS_PER_BAR, type MusicIntensity, type MusicPattern, type MusicStem, type MusicVoiceType } from "./compose";
import { getAudioContext, peekAudioContext } from "./context";
import { getAudioBus } from "./mixer";
import {
  createGraph,
  disconnectGraph,
  layerMultiplier,
  masterGain,
  PHRASE_STEPS,
  SCHEDULE_AHEAD_S,
  SCHEDULER_MS,
  stemBus,
  indexPattern,
} from "./musicGraph";
import type { AudioGraphContext, MusicGraph } from "./musicGraph";
import { playSynthTone, playTransition, retunePad, schedulePadGate, syncDelay } from "./musicSynth";
import { playKick, playSnare, playClap, playHat, playTom, playImpact } from "./musicDrums";
import {
  intensity,
  pendingIntensity,
  setIntensity,
  setPendingIntensity,
  graph,
  setGraph,
  pattern,
  setPattern,
  timer,
  setTimer,
  nextNoteTime,
  setNextNoteTime,
  step,
  setStep,
  enabled,
  paused,
  ducked,
  cue,
  seed,
  missionIndex,
  fadeGen,
  incrementFadeGen,
} from "./musicState";

export function applyIntensityAt(audio: AudioGraphContext, g: MusicGraph, value: MusicIntensity, time: number, isDucked = ducked): void {
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

export function scheduleStep(audio: AudioGraphContext, g: MusicGraph, p: MusicPattern, when: number, index: number, value: MusicIntensity): void {
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
    ["counter", p.counterType, p.cutoff],
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
  const pi = pendingIntensity;
  if (!pi) return;
  setIntensity(pi);
  setPendingIntensity(null);
  applyIntensityAt(audio, g, intensity, nextNoteTime);
}

function startGraph(audio: AudioContext): void {
  if (!pattern) return;
  const musicBus = getAudioBus("music");
  if (!musicBus) return;
  const g = createGraph(audio, musicBus, pattern);
  setGraph(g);
  syncDelay(audio, g, pattern);
  applyIntensityAt(audio, g, intensity, audio.currentTime);
  setNextNoteTime(audio.currentTime + 0.07);
  setStep(0);
  setTimer(window.setInterval(tickScheduler, SCHEDULER_MS));
  tickScheduler();
}

function tickScheduler(): void {
  const audio = getAudioContext();
  const g = graph;
  const p = pattern;
  if (!audio || !g || !p) return;
  const stepDuration = 60 / p.bpm / 4;
  let n = nextNoteTime;
  let s = step;
  while (n < audio.currentTime + SCHEDULE_AHEAD_S) {
    if (s % PHRASE_STEPS === 0) applyPendingIntensityAtPhraseBoundary(audio, g);
    scheduleStep(audio, g, p, n, s, intensity);
    n += stepDuration;
    s = (s + 1) % p.steps;
  }
  setNextNoteTime(n);
  setStep(s);
}

function stopMusic(): void {
  incrementFadeGen();
  const t = timer;
  if (t) {
    window.clearInterval(t);
    setTimer(null);
  }
  const g = graph;
  if (g) {
    disconnectGraph(g);
    setGraph(null);
  }
}

export function ensureMusicPlaying(): void {
  if (!enabled || paused) return;
  const audio = peekAudioContext();
  if (!audio) return;
  if (!pattern) setPattern(composeMusic(seed, cue, missionIndex));
  if (timer) return;
  startGraph(audio);
}

export function applyPattern(next: MusicPattern): void {
  const audio = getAudioContext();
  const g = graph;
  if (!audio || !g || !timer) {
    setPattern(next);
    return;
  }
  const generation = incrementFadeGen();
  const now = audio.currentTime;
  const half = 0.55 / 2;
  const current = Math.max(g.master.gain.value, 0.001);
  g.master.gain.cancelScheduledValues(now);
  g.master.gain.setValueAtTime(current, now);
  g.master.gain.linearRampToValueAtTime(0.001, now + half);
  window.setTimeout(() => {
    if (generation !== fadeGen) return;
    setPattern(next);
    const activeGraph = graph;
    if (!activeGraph) return;
    activeGraph.index = indexPattern(next);
    setStep(0);
    syncDelay(audio, activeGraph, next);
    retunePad(audio, activeGraph, next, 0, audio.currentTime);
    const t = audio.currentTime;
    activeGraph.master.gain.cancelScheduledValues(t);
    activeGraph.master.gain.setValueAtTime(0.001, t);
    activeGraph.master.gain.linearRampToValueAtTime(masterGain(intensity, ducked), t + half);
  }, half * 1000);
}

export { stopMusic };
