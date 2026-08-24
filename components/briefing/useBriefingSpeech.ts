import { useEffect } from "react";
import type { BriefingLine, CharacterRole } from "@/lib/types";

type SpeechProfile = {
  rate: number;
  pitch: number;
  volume: number;
};

const SPEECH_PROFILES: Record<CharacterRole, SpeechProfile> = {
  advisor: { rate: 1.02, pitch: 1.12, volume: 0.86 },
  commander: { rate: 0.94, pitch: 0.86, volume: 0.92 },
  enemyLeader: { rate: 0.84, pitch: 0.62, volume: 0.94 },
};

function englishVoices(speech: SpeechSynthesis): SpeechSynthesisVoice[] {
  return speech.getVoices().filter((voice) => /^en(?:-|$)/i.test(voice.lang));
}

function voiceForRole(speech: SpeechSynthesis, role: CharacterRole): SpeechSynthesisVoice | undefined {
  const voices = englishVoices(speech);
  if (voices.length === 0) return undefined;

  const slot = role === "advisor" ? 0 : role === "commander" ? 1 : 2;
  return voices[slot % voices.length];
}

function speechApi(): SpeechSynthesis | null {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return null;
  if (typeof SpeechSynthesisUtterance === "undefined") return null;
  return window.speechSynthesis;
}

export function useBriefingSpeech(
  lines: readonly BriefingLine[],
  activeLineIndex: number,
  playId: number,
) {
  useEffect(() => {
    const speech = speechApi();
    if (!speech) return;

    // Replay starts a new transmission. A separate effect keeps line changes
    // from cutting off the previous utterance before its sentence is complete.
    return () => speech.cancel();
  }, [playId]);

  useEffect(() => {
    const speech = speechApi();
    const line = lines[activeLineIndex];
    if (!speech || !line || activeLineIndex < 0 || line.text.trim().length === 0) return;

    const utterance = new SpeechSynthesisUtterance(line.text);
    const profile = SPEECH_PROFILES[line.speaker];
    utterance.lang = "en-US";
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;
    const voice = voiceForRole(speech, line.speaker);
    if (voice) utterance.voice = voice;

    try {
      speech.speak(utterance);
    } catch {
      // Speech is an enhancement; unsupported or locked-down browsers keep
      // the normal visual transmission fully usable.
    }
  }, [activeLineIndex, lines]);
}
