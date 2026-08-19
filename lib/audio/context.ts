let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

export function resumeAudio(): AudioContext | null {
  const audio = getAudioContext();
  if (!audio) return null;
  void audio.resume();
  return audio;
}
