"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  TITLE_MUSIC_SEED,
  musicCueFromPath,
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

  useEffect(() => {
    const settings = readSettings(localStorageAdapter());
    setSfxEnabled(settings.sfxEnabled);
    setMusicEnabled(settings.musicEnabled);
  }, []);

  useEffect(() => {
    const cue = musicCueFromPath(pathname);
    const parsed = parseSeed(seedParam ?? "");
    setMusicCue(cue, parsed ?? TITLE_MUSIC_SEED);
  }, [pathname, seedParam]);

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
