import type { MusicIntensity, MusicPattern, MusicSectionName, MusicStem, MusicVoiceType } from "./compose";
import type { AudioGraphContext, MusicGraph } from "./musicGraph";
import { ATTACK_S, notePan } from "./musicGraph";
import { getNoiseBuffer } from "./musicGraph";

export function playSynthTone(
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

  oscA.type = type;
  oscB.type = type === "sawtooth" ? "square" : type === "square" ? "sawtooth" : "triangle";
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
    oscSub.type = bass ? "sine" : lead ? g.style.counterType : "triangle";
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

export function playNoise(
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

export function playTransition(audio: AudioGraphContext, g: MusicGraph, time: number, duration: number, rising: boolean): void {
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

export function retunePad(audio: AudioGraphContext, g: MusicGraph, p: MusicPattern, bar: number, time: number): void {
  const index = ((bar % p.bars) + p.bars) % p.bars;
  const root = p.padRoot[index] ?? p.rootHz;
  const fifth = p.padFifth[index] ?? root * 1.5;
  const t = Math.max(time, audio.currentTime);
  g.padOscA.frequency.setTargetAtTime(root, t, 0.04);
  g.padOscB.frequency.setTargetAtTime(root * 1.002, t, 0.04);
  g.padOscC.frequency.setTargetAtTime(root * 0.998, t, 0.04);
  g.padOscD.frequency.setTargetAtTime(fifth * 1.001, t, 0.04);
}

export function schedulePadGate(
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

export function syncDelay(audio: AudioGraphContext, g: MusicGraph, p: MusicPattern): void {
  const seconds = Math.max(0.05, (60 / p.bpm) * p.delayBeats);
  g.delay.delayTime.setTargetAtTime(seconds, audio.currentTime, 0.04);
}
