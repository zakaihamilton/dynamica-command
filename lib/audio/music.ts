import { composeMusic, MUSIC_BARS, STEPS_PER_BAR, BARS_PER_SECTION, TITLE_MUSIC_SEED, TUTORIAL_MUSIC_MISSION, type MusicCue, type MusicIntensity } from "./compose";
import { peekAudioContext, unlockAudioContext } from "./context";
import { setAudioBusEnabled } from "./mixer";
import {
  SAMPLE_RATE,
  masterGain,
  createGraph,
  disconnectGraph,
} from "./musicGraph";
import { syncDelay } from "./musicSynth";
import {
  intensity,
  pendingIntensity,
  setIntensity,
  setPendingIntensity,
  graph,
  pattern,
  timer,
  setPattern,
  cue,
  seed,
  missionIndex,
  enabled,
  setEnabled,
  setPaused,
  setCue,
  setSeed,
  setMissionIndex,
  setDucked,
  setStep,
} from "./musicState";
import {
  applyIntensityAt,
  scheduleStep,
  ensureMusicPlaying,
  applyPattern,
  stopMusic,
  readMusicPosition,
  saveMusicPosition,
  clearMusicPosition,
  getAudibleStep,
  saveAudibleMusicPosition,
} from "./musicScheduler";

export { TITLE_MUSIC_SEED, TUTORIAL_MUSIC_MISSION };
export type { MusicIntensity } from "./compose";
export { isAudioUnlocked } from "./context";
export {
  readMusicPosition,
  saveMusicPosition,
  clearMusicPosition,
  getAudibleStep,
  saveAudibleMusicPosition,
};

export function resetMusicPosition(targetCue?: MusicCue, targetSeed?: number, targetMissionIndex?: number): void {
  clearMusicPosition(targetCue, targetSeed, targetMissionIndex);
  if (
    targetCue === undefined ||
    (targetCue === cue &&
      (targetSeed === undefined || targetSeed === seed) &&
      (targetMissionIndex === undefined || targetMissionIndex === missionIndex))
  ) {
    setStep(0);
    if (targetCue === undefined) {
      setCue("menu");
      setSeed(TITLE_MUSIC_SEED);
      setMissionIndex(0);
      setPattern(null);
    }
  }
}

export function musicCueFromPath(pathname: string): MusicCue | null {
  // Music is scoped to the active mission battlefield. Returning null on all
  // other routes lets AudioRoot stop any mission music during navigation.
  if (pathname.startsWith("/play")) return "mission";
  return null;
}

export function isMusicEnabled(): boolean {
  return enabled;
}

export function setMusicCue(nextCue: MusicCue, nextSeed: number, nextMissionIndex = 0): void {
  setPaused(false);
  if (cue === nextCue && seed === nextSeed && missionIndex === nextMissionIndex && pattern) {
    if (!timer) {
      const remembered = readMusicPosition(nextCue, nextSeed, nextMissionIndex);
      if (typeof remembered === "number") setStep(remembered);
    }
    setMusicIntensity("calm");
    ensureMusicPlaying();
    return;
  }
  setCue(nextCue);
  setSeed(nextSeed);
  setMissionIndex(nextMissionIndex);
  setIntensity("calm");
  setPendingIntensity(null);
  const next = composeMusic(nextSeed, nextCue, nextMissionIndex);
  if (timer) applyPattern(next);
  else {
    const remembered = readMusicPosition(nextCue, nextSeed, nextMissionIndex);
    setStep(remembered ?? 0);
    setPattern(next);
  }
  ensureMusicPlaying();
}

export function setMusicEnabled(value: boolean): void {
  setEnabled(value);
  setAudioBusEnabled("music", value);
  if (!value) stopMusic();
  else ensureMusicPlaying();
}

export function pauseMusic(): void {
  saveAudibleMusicPosition();
  setPaused(true);
  stopMusic();
}

export function setMusicDucked(value: boolean): void {
  setDucked(value);
  const audio = peekAudioContext();
  if (!audio || !graph) return;
  const now = audio.currentTime;
  graph.master.gain.cancelScheduledValues(now);
  graph.master.gain.setValueAtTime(Math.max(graph.master.gain.value, 0.001), now);
  graph.master.gain.linearRampToValueAtTime(masterGain(intensity, value), now + 0.1);
}

export function setMusicIntensity(value: MusicIntensity): void {
  const audio = peekAudioContext();
  if (!audio || !graph || !timer) {
    setIntensity(value);
    setPendingIntensity(null);
    return;
  }
  if (intensity === value && pendingIntensity === null) return;
  setPendingIntensity(value);
}

export class MusicExportCancelledError extends Error {
  constructor() {
    super("Mission soundtrack export was cancelled.");
    this.name = "AbortError";
  }
}

function throwIfRenderAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new MusicExportCancelledError();
}

async function renderOfflineAudio(
  offline: OfflineAudioContext,
  duration: number,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<AudioBuffer> {
  throwIfRenderAborted(signal);
  const rendering = offline.startRendering();
  void rendering.catch(() => undefined);

  // OfflineAudioContext.suspend() is not consistently implemented. In some
  // browsers its promise never resolves, leaving an otherwise healthy export
  // stuck in the rendering phase. Let the context render continuously and use
  // its clock for best-effort progress updates instead.
  let lastProgress = 0;
  let progressTimer: number | null = null;
  const updateProgress = () => {
    if (signal?.aborted) return;
    const current = Number.isFinite(offline.currentTime) ? offline.currentTime : 0;
    const nextProgress = Math.min(0.99, Math.max(lastProgress, current / duration));
    if (nextProgress > lastProgress) {
      lastProgress = nextProgress;
      onProgress?.(nextProgress);
    }
    progressTimer = window.setTimeout(updateProgress, 100);
  };
  updateProgress();
  try {
    const buffer = await rendering;
    throwIfRenderAborted(signal);
    onProgress?.(1);
    return buffer;
  } finally {
    if (progressTimer !== null) window.clearTimeout(progressTimer);
  }
}

export async function renderMissionMusic(
  seedValue: number,
  mission: number,
  sampleRate = SAMPLE_RATE,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
    /** Internal export window used to keep long offline renders bounded. */
    barStart?: number;
    barCount?: number;
    /** Extra audio rendered after an export window for seam handling. */
    tailSeconds?: number;
  } = {},
): Promise<AudioBuffer> {
  if (typeof window === "undefined" || typeof window.OfflineAudioContext === "undefined") {
    throw new Error("Offline audio rendering is not supported in this browser.");
  }
  throwIfRenderAborted(options.signal);
  const renderedPattern = composeMusic(seedValue, "mission", mission);
  const barStart = Math.max(0, Math.min(MUSIC_BARS - 1, Math.floor(options.barStart ?? 0)));
  const barCount = Math.max(1, Math.min(MUSIC_BARS - barStart, Math.floor(options.barCount ?? MUSIC_BARS)));
  const barEnd = barStart + barCount;
  const stepDuration = 60 / renderedPattern.bpm / 4;
  const musicalDuration = barCount * STEPS_PER_BAR * stepDuration;
  const tailSeconds = Math.max(0, options.tailSeconds ?? (barEnd === MUSIC_BARS ? 2.2 : 0));
  const length = Math.ceil((musicalDuration + tailSeconds) * sampleRate);
  const renderDuration = length / sampleRate;
  const offline = new window.OfflineAudioContext(2, length, sampleRate);
  const offlineGraph = createGraph(offline, offline.destination, renderedPattern);
  try {
    const arc: MusicIntensity[] = ["calm", "engaged", "calm", "engaged", "critical", "engaged", "engaged", "engaged"];
    for (const oscillator of [offlineGraph.padOscA, offlineGraph.padOscB, offlineGraph.padOscC, offlineGraph.padOscD, offlineGraph.padLfo]) {
      oscillator.stop(Math.max(0, renderDuration - 0.01));
    }
    for (let bar = barStart; bar < barEnd; bar++) {
      throwIfRenderAborted(options.signal);
      const value = arc[Math.floor(bar / BARS_PER_SECTION)] ?? "engaged";
      applyIntensityAt(offline, offlineGraph, value, (bar - barStart) * STEPS_PER_BAR * stepDuration, false);
    }
    syncDelay(offline, offlineGraph, renderedPattern);
    const firstStep = barStart * STEPS_PER_BAR;
    const lastStep = barEnd * STEPS_PER_BAR;
    for (let index = firstStep; index < lastStep; index++) {
      if (index % STEPS_PER_BAR === 0) throwIfRenderAborted(options.signal);
      const value = arc[Math.floor(index / STEPS_PER_BAR / BARS_PER_SECTION)] ?? "engaged";
      scheduleStep(offline, offlineGraph, renderedPattern, (index - firstStep) * stepDuration, index, value);
    }
    if (barEnd === MUSIC_BARS) {
      const fadeAt = Math.max(0, musicalDuration - 1.35);
      offlineGraph.master.gain.setValueAtTime(masterGain("engaged", false), fadeAt);
      offlineGraph.master.gain.linearRampToValueAtTime(0.0001, musicalDuration + tailSeconds);
    }
    return await renderOfflineAudio(offline, renderDuration, options.signal, options.onProgress);
  } finally {
    disconnectGraph(offlineGraph);
  }
}

export function unlockAudio(): void {
  unlockAudioContext();
  ensureMusicPlaying();
}
