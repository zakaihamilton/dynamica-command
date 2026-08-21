let ctx: AudioContext | null = null;
let unlocked = false;

export function peekAudioContext(): AudioContext | null {
  return ctx;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function resumeAudio(): AudioContext | null {
  if (!unlocked) return null;
  const audio = getAudioContext();
  if (!audio) return null;
  void audio.resume().catch(() => undefined);
  return audio;
}

export function unlockAudioContext(): AudioContext | null {
  const audio = getAudioContext();
  if (!audio) return null;
  unlocked = true;
  void audio.resume().catch(() => undefined);
  return audio;
}
