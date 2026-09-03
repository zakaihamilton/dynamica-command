import { useEffect } from "react";
import { pauseMusic, setMusicCue, setMusicDucked } from "@/lib/audio/music";
import { listTacticalRasterSources } from "@/lib/gen/visualAssets";
import { preloadRasterSources } from "@/lib/render/sprites";
import type { SimState } from "@/lib/types";

export function useGameAudioLifecycle({ seed, missionIndex, tutorial, paused, result }: { seed: number; missionIndex: number; tutorial: boolean; paused: boolean; result: SimState["result"] }) {
  useEffect(() => {
    preloadRasterSources(listTacticalRasterSources());
  }, []);

  useEffect(() => {
    if (paused || tutorial) {
      pauseMusic();
      return;
    }
    // Only assert "mission" music while the game is still in progress.
    // When result is "won" or "lost", useGameLoop has already set the
    // appropriate victory/defeat cue — don't overwrite it here.
    if (result !== "playing") return;
    setMusicDucked(false);
    setMusicCue("mission", seed, missionIndex);
  }, [missionIndex, paused, result, seed, tutorial]);

  useEffect(() => () => {
    setMusicDucked(false);
  }, []);
}
