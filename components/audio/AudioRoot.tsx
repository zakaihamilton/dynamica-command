"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  TITLE_MUSIC_SEED,
  TUTORIAL_MUSIC_MISSION,
  musicCueFromPath,
  pauseMusic,
  setMusicCue,
  setMusicEnabled,
  unlockAudio,
} from "@/lib/audio/music";
import { setSfxEnabled } from "@/lib/audio/synth";
import { localStorageAdapter } from "@/lib/persist/save";
import { readSettings } from "@/lib/persist/settings";
import { parseSeed } from "@/lib/seed/rng";

function AudioRootInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const missionParam = searchParams.get("mission");

  useEffect(() => {
    const settings = readSettings(localStorageAdapter());
    setSfxEnabled(settings.sfxEnabled);
    setMusicEnabled(settings.musicEnabled);
  }, []);

  useEffect(() => {
    const cue = musicCueFromPath(pathname);
    if (!cue) {
      pauseMusic();
      return;
    }
    const parsed = parseSeed(seedParam ?? "");
    const missionIndex = pathname.startsWith("/tutorial")
      ? TUTORIAL_MUSIC_MISSION
      : Math.max(0, Number(missionParam ?? "0") || 0);
    setMusicCue(cue, parsed ?? TITLE_MUSIC_SEED, missionIndex);
  }, [pathname, seedParam, missionParam]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}

export function AudioRoot() {
  return (
    <Suspense fallback={null}>
      <AudioRootInner />
    </Suspense>
  );
}
