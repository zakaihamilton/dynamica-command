import type { MusicDrumKind, MusicStem, MusicVoiceType } from "./compose";
import type { AudioGraphContext, MusicGraph } from "./musicGraph";
import { notePan } from "./musicGraph";
import { getNoiseBuffer } from "./musicGraph";

export function playFastSynthTone(
  audio: AudioGraphContext,
  destination: AudioNode,
  frequency: number,
  time: number,
  duration: number,
  type: MusicVoiceType,
  velocity: number,
  voice: MusicStem,
  accent = false,
): void {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  const pan = audio.createStereoPanner();
  const attack = Math.min(voice === "melody" ? 0.018 : 0.006, duration * 0.2);
  const release = Math.min(voice === "bass" ? 0.08 : voice === "melody" ? 0.18 : 0.1, duration * 0.42);
  const end = time + Math.max(duration, attack + release + 0.02);
  const peak = Math.max(0.004, velocity * (accent ? 0.18 : voice === "pulse" ? 0.1 : 0.14));

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  pan.pan.setValueAtTime(notePan(voice), time);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.linearRampToValueAtTime(peak, time + Math.max(0.003, attack));
  envelope.gain.setTargetAtTime(0.0001, Math.max(time + attack, end - release), Math.max(0.014, release * 0.4));

  oscillator.connect(envelope);
  envelope.connect(pan);
  pan.connect(destination);
  oscillator.start(time);
  oscillator.stop(end + 0.03);
}

export function playFastNoise(
  audio: AudioGraphContext,
  destination: AudioNode,
  time: number,
  gain: number,
  duration: number,
  panValue = 0,
): void {
  const source = audio.createBufferSource();
  const envelope = audio.createGain();
  const pan = audio.createStereoPanner();
  source.buffer = getNoiseBuffer(audio);
  pan.pan.setValueAtTime(panValue, time);
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.linearRampToValueAtTime(Math.max(0.001, gain), time + Math.min(0.006, duration * 0.18));
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(envelope);
  envelope.connect(pan);
  pan.connect(destination);
  source.start(time);
  source.stop(time + duration + 0.02);
}

export function playFastDrum(
  audio: AudioGraphContext,
  g: MusicGraph,
  time: number,
  kind: MusicDrumKind,
  velocity: number,
  accent: boolean,
): void {
  const drum = g.style.drum;
  if (kind === "kick") {
    playFastSynthTone(audio, g.rhythmBus, drum.kickStart * 0.64, time, 0.2, "sine", velocity * 1.2, "bass", accent);
    playFastNoise(audio, g.rhythmBus, time, 0.035 * velocity, 0.025, drum.noisePan);
  } else if (kind === "snare") {
    playFastNoise(audio, g.rhythmBus, time, (accent ? 0.14 : 0.09) * velocity, accent ? 0.08 : 0.055, drum.noisePan);
    playFastSynthTone(audio, g.rhythmBus, drum.snareBody, time, 0.07, "triangle", velocity * 0.34, "counter", accent);
  } else if (kind === "clap") {
    playFastNoise(audio, g.rhythmBus, time, (accent ? 0.1 : 0.065) * velocity, accent ? 0.08 : 0.055, drum.noisePan + 0.08);
    playFastNoise(audio, g.rhythmBus, time + 0.014, (accent ? 0.07 : 0.045) * velocity, 0.04, drum.noisePan - 0.08);
  } else if (kind === "hat" || kind === "openHat") {
    playFastNoise(audio, g.rhythmBus, time, (kind === "openHat" ? 0.06 : 0.035) * velocity, kind === "openHat" ? 0.16 : 0.03, kind === "openHat" ? drum.noisePan + 0.12 : drum.noisePan - 0.08);
  } else if (kind === "tom") {
    playFastSynthTone(audio, g.rhythmBus, drum.tomStart, time, 0.2, "triangle", velocity * 0.5, "counter", accent);
  } else {
    playFastSynthTone(audio, g.fxBus, drum.impactStart * 0.78, time, 0.34, "sawtooth", velocity * 0.7, "bass", accent);
    playFastNoise(audio, g.fxBus, time, 0.08 * velocity, 0.18);
  }
}
