import { useEffect } from "react";
import { setMusicCue, setMusicDucked, TUTORIAL_MUSIC_MISSION } from "@/lib/audio/music";
import { listTacticalRasterSources } from "@/lib/gen/visualAssets";
import { preloadRasterSources } from "@/lib/render/sprites";

export function useGameAudioLifecycle({ seed, missionIndex, tutorial, paused }: { seed: number; missionIndex: number; tutorial: boolean; paused: boolean }) {
  useEffect(() => {
    preloadRasterSources(listTacticalRasterSources());
  }, []);

  useEffect(() => {
    setMusicCue("mission", seed, tutorial ? TUTORIAL_MUSIC_MISSION : missionIndex);
  }, [missionIndex, seed, tutorial]);

  useEffect(() => {
    setMusicDucked(paused);
  }, [paused]);

  useEffect(() => () => {
    setMusicDucked(false);
  }, []);
}
