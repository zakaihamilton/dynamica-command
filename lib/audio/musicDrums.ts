import type { AudioGraphContext, MusicGraph } from "./musicGraph";
import { playNoise } from "./musicSynth";

export function playKick(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const drum = g.style.drum;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(drum.kickStart, time);
  oscillator.frequency.exponentialRampToValueAtTime(drum.kickEnd, time + drum.kickTail);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.82 * velocity, time + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
  oscillator.connect(envelope);
  envelope.connect(g.rhythmBus);
  oscillator.start(time);
  oscillator.stop(time + 0.28);
  const click = audio.createOscillator();
  const clickGain = audio.createGain();
  click.type = "square";
  click.frequency.setValueAtTime(Math.max(drum.kickStart * 8, 1400), time);
  click.frequency.exponentialRampToValueAtTime(220, time + 0.018);
  clickGain.gain.setValueAtTime(0.0001, time);
  clickGain.gain.exponentialRampToValueAtTime(0.16 * velocity, time + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.022);
  click.connect(clickGain);
  clickGain.connect(g.rhythmBus);
  click.start(time);
  click.stop(time + 0.03);
  playNoise(audio, g.rhythmBus, time, 0.12 * velocity, drum.snareNoise * 1.45, 0.018, "highpass", drum.noisePan);
}

export function playSnare(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, accent: boolean): void {
  const drum = g.style.drum;
  const dry = (accent ? 0.22 : 0.13) * velocity;
  playNoise(audio, g.rhythmBus, time, dry, drum.snareNoise, accent ? 0.07 : 0.05, "bandpass", drum.noisePan);
  playNoise(audio, g.rhythmBus, time, dry * 0.6, drum.snareNoise * 2.2, 0.035, "highpass", drum.noisePan);
  const body = audio.createOscillator();
  const bodyGain = audio.createGain();
  const bodyLen = accent ? 0.08 : 0.055;
  body.type = "triangle";
  body.frequency.setValueAtTime(drum.snareBody, time);
  body.frequency.exponentialRampToValueAtTime(drum.snareBody * 0.72, time + bodyLen);
  bodyGain.gain.setValueAtTime(0.0001, time);
  bodyGain.gain.exponentialRampToValueAtTime(0.16 * velocity, time + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + bodyLen);
  body.connect(bodyGain);
  bodyGain.connect(g.rhythmBus);
  body.start(time);
  body.stop(time + bodyLen + 0.03);
  playNoise(audio, g.reverbSend, time, dry * 0.55, drum.snareNoise * 0.84, accent ? 0.16 : 0.12, "bandpass", drum.noisePan);
}

export function playClap(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, accent: boolean): void {
  const drum = g.style.drum;
  const gain = (accent ? 0.14 : 0.09) * velocity;
  playNoise(audio, g.rhythmBus, time, gain, drum.snareNoise * 0.76, accent ? 0.085 : 0.06, "bandpass", drum.noisePan + 0.08);
  playNoise(audio, g.rhythmBus, time + 0.014, gain * 0.72, drum.snareNoise * 1.03, accent ? 0.07 : 0.045, "bandpass", drum.noisePan - 0.08);
  playNoise(audio, g.reverbSend, time, gain * 0.42, drum.snareNoise * 0.66, accent ? 0.12 : 0.08, "bandpass", drum.noisePan);
}

export function playHat(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number, open: boolean): void {
  const drum = g.style.drum;
  playNoise(audio, g.rhythmBus, time, (open ? 0.085 : 0.055) * velocity, open ? drum.openHatFrequency : drum.hatFrequency, open ? 0.17 : 0.027, open ? "bandpass" : "highpass", open ? drum.noisePan + 0.12 : drum.noisePan - 0.08);
}

export function playTom(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const drum = g.style.drum;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(drum.tomStart, time);
  oscillator.frequency.exponentialRampToValueAtTime(drum.tomEnd, time + 0.18);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.26 * velocity, time + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  oscillator.connect(envelope);
  envelope.connect(g.rhythmBus);
  oscillator.start(time);
  oscillator.stop(time + 0.26);
}

export function playImpact(audio: AudioGraphContext, g: MusicGraph, time: number, velocity: number): void {
  const drum = g.style.drum;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(drum.impactStart, time);
  oscillator.frequency.exponentialRampToValueAtTime(drum.impactEnd, time + 0.34);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(0.42 * velocity, time + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
  oscillator.connect(envelope);
  envelope.connect(g.fxBus);
  oscillator.start(time);
  oscillator.stop(time + 0.46);
  playNoise(audio, g.fxBus, time, 0.14 * velocity, drum.impactStart * 8.3, 0.18, "bandpass", drum.noisePan);
  playNoise(audio, g.reverbSend, time, 0.08 * velocity, drum.impactStart * 6.5, 0.32, "bandpass", drum.noisePan);
}
