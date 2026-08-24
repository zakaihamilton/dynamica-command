import { useCallback, type Dispatch, type SetStateAction } from "react";
import { setMusicEnabled as applyMusicEnabled } from "@/lib/audio/music";
import { setSfxEnabled as applySfxEnabled } from "@/lib/audio/synth";
import { setAudioLevels, type AudioVolumeKey } from "@/lib/audio/mixer";
import { localStorageAdapter } from "@/lib/persist/save";
import { writeSettings, type GameSettings } from "@/lib/persist/settings";

export function useAudioPreferences(
  settings: GameSettings,
  setSettings: Dispatch<SetStateAction<GameSettings>>,
) {
  const toggleSound = useCallback(() => {
    const next = { ...settings, sfxEnabled: !settings.sfxEnabled };
    setSettings(next);
    applySfxEnabled(next.sfxEnabled);
    writeSettings(localStorageAdapter(), next);
  }, [setSettings, settings]);

  const toggleMusic = useCallback(() => {
    const next = { ...settings, musicEnabled: !settings.musicEnabled };
    setSettings(next);
    applyMusicEnabled(next.musicEnabled);
    writeSettings(localStorageAdapter(), next);
  }, [setSettings, settings]);

  const updateVolume = useCallback((key: AudioVolumeKey, value: number) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setAudioLevels(next);
    writeSettings(localStorageAdapter(), next);
  }, [setSettings, settings]);

  return { toggleSound, toggleMusic, updateVolume };
}
