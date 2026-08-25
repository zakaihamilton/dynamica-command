import type { AudioGraphContext, MusicGraph } from "./musicGraph";
import { playNoise } from "./musicSynth";

export function playKick(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(188, time);
  oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.16);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.64 * velocity, time + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  oscillator.connect(envelope);
  envelope.connect(g.rhythmBus);
  oscillator.start(time);
  oscillator.stop(time + 0.26);
  playNoise(audio, g.rhythmBus, time, 0.08 * velocity, 2800, 0.02);
}

export function playSnare(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, accent: boolean): void {
  const dry = (accent ? 0.16 : 0.09) * velocity;
  playNoise(audio, g.rhythmBus, time, dry, 1900, accent ? 0.07 : 0.05, "bandpass");
  playNoise(audio, g.rhythmBus, time, dry * 0.55, 4200, 0.035, "highpass");
  const body = audio.createOscillator();
  const bodyGain = audio.createGain();
  const bodyLen = accent ? 0.08 : 0.055;
  body.type = "triangle";
  body.frequency.setValueAtTime(210, time);
  body.frequency.exponentialRampToValueAtTime(150, time + bodyLen);
  bodyGain.gain.setValueAtTime(0.0001, time);
  bodyGain.gain.exponentialRampToValueAtTime(0.12 * velocity, time + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + bodyLen);
  body.connect(bodyGain);
  bodyGain.connect(g.rhythmBus);
  body.start(time);
  body.stop(time + bodyLen + 0.03);
  playNoise(audio, g.reverbSend, time, dry * 0.7, 1600, accent ? 0.2 : 0.14, "bandpass");
}

export function playClap(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, accent: boolean): void {
  const gain = (accent ? 0.11 : 0.07) * velocity;
  playNoise(audio, g.rhythmBus, time, gain, 1450, accent ? 0.085 : 0.06, "bandpass", 0.08);
  playNoise(audio, g.rhythmBus, time + 0.014, gain * 0.72, 1950, accent ? 0.07 : 0.045, "bandpass", -0.08);
  playNoise(audio, g.reverbSend, time, gain * 0.42, 1250, accent ? 0.12 : 0.08, "bandpass");
}

export function playHat(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, open: boolean): void {
  playNoise(audio, g.rhythmBus, time, (open ? 0.06 : 0.036) * velocity, open ? 3300 : 7200, open ? 0.17 : 0.027, open ? "bandpass" : "highpass", open ? 0.12 : -0.08);
}

export function playTom(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(180, time);
  oscillator.frequency.exponentialRampToValueAtTime(110, time + 0.18);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.2 * velocity, time + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  oscillator.connect(envelope);
  envelope.connect(g.rhythmBus);
  oscillator.start(time);
  oscillator.stop(time + 0.26);
}

export function playImpact(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
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
