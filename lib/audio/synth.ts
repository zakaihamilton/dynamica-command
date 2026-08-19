import { getAudioContext, resumeAudio } from "./context";

export type BeepKind = "select" | "ack" | "build" | "alert" | "win" | "lose";

let sfxEnabled = true;

export function setSfxEnabled(value: boolean): void {
  sfxEnabled = value;
}

export function isSfxEnabled(): boolean {
  return sfxEnabled;
}

export function beep(kind: BeepKind): void {
  if (!sfxEnabled) return;
  const audio = getAudioContext();
  if (!audio) return;
  resumeAudio();
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.connect(g);
  g.connect(audio.destination);
  const now = audio.currentTime;
  const table: Record<BeepKind, { f: number; t: number; type: OscillatorType }> = {
    select: { f: 420, t: 0.05, type: "square" },
    ack: { f: 280, t: 0.08, type: "triangle" },
    build: { f: 180, t: 0.12, type: "sawtooth" },
    alert: { f: 140, t: 0.2, type: "square" },
    win: { f: 520, t: 0.25, type: "triangle" },
    lose: { f: 90, t: 0.35, type: "sawtooth" },
  };
  const s = table[kind];
  o.type = s.type;
  o.frequency.setValueAtTime(s.f, now);
  g.gain.setValueAtTime(0.04, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + s.t);
  o.start(now);
  o.stop(now + s.t);
}
