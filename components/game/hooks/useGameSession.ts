import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { setMusicEnabled as applyMusicEnabled } from "@/lib/audio/music";
import { beep, setSfxEnabled as applySfxEnabled } from "@/lib/audio/synth";
import { setAudioLevels, type AudioVolumeKey } from "@/lib/audio/mixer";
import { localStorageAdapter, readSave, writeSave } from "@/lib/persist/save";
import { readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import { writeSettings, type GameSettings } from "@/lib/persist/settings";
import { formatSeed } from "@/lib/seed/rng";
import { createMission } from "@/lib/sim/api";
import { createTutorialMission } from "@/lib/sim/tutorial";
import type { Command, SimState } from "@/lib/types";
import type { PauseView } from "@/lib/ui/shortcuts";
import type { FxBurst } from "@/lib/render/fx";

export function initialMission(seed: number, mission: number, resume: boolean, tutorial: boolean): SimState {
  if (tutorial) return createTutorialMission(seed);
  if (resume && typeof window !== "undefined") {
    const saved = readSave(localStorageAdapter(), seed);
    if (saved) return saved;
  }
  return createMission({ seed, missionIndex: mission });
}

export function useGameSession({
  seed,
  stateRef,
  setState,
  commitSelection,
  cmdQRef,
  fxRef,
  clearTools,
  resetInput,
  resetCamera,
  pausedRef,
  setPaused,
  setPauseView,
  setPauseNotice,
  campaignRecordedRef,
  terminalSaveRef,
  settings,
  setSettings,
}: {
  seed: number;
  stateRef: MutableRefObject<SimState>;
  setState: Dispatch<SetStateAction<SimState>>;
  commitSelection: (ids: number[]) => void;
  cmdQRef: MutableRefObject<Command[]>;
  fxRef: MutableRefObject<FxBurst[]>;
  clearTools: () => void;
  resetInput: () => void;
  resetCamera: (state: SimState) => void;
  pausedRef: MutableRefObject<boolean>;
  setPaused: Dispatch<SetStateAction<boolean>>;
  setPauseView: Dispatch<SetStateAction<PauseView>>;
  setPauseNotice: Dispatch<SetStateAction<string>>;
  campaignRecordedRef: MutableRefObject<boolean>;
  terminalSaveRef: MutableRefObject<boolean>;
  settings: GameSettings;
  setSettings: Dispatch<SetStateAction<GameSettings>>;
}) {
  const router = useRouter();

  const openPauseMenu = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
    setPauseView("main");
    setPauseNotice("");
  }, [pausedRef, setPaused, setPauseNotice, setPauseView]);

  const resumeMission = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    setPauseView("main");
    setPauseNotice("");
  }, [pausedRef, setPaused, setPauseNotice, setPauseView]);

  const saveMission = useCallback(() => {
    writeSave(localStorageAdapter(), stateRef.current);
    setPauseNotice("Mission saved.");
  }, [setPauseNotice, stateRef]);

  const loadMission = useCallback(() => {
    const loaded = readSave(localStorageAdapter(), seed);
    if (!loaded) {
      setPauseNotice("No save found for this seed.");
      return;
    }
    stateRef.current = loaded;
    campaignRecordedRef.current = loaded.result === "won";
    terminalSaveRef.current = loaded.result !== "playing";
    setState({ ...loaded, entities: [...loaded.entities] });
    commitSelection([]);
    setPauseNotice(`Loaded mission at tick ${loaded.tick}.`);
  }, [campaignRecordedRef, commitSelection, seed, setPauseNotice, setState, stateRef, terminalSaveRef]);

  const viewMissionBriefing = useCallback(() => {
    writeSave(localStorageAdapter(), stateRef.current);
    router.push(`/briefing?seed=${formatSeed(stateRef.current.seed)}&mission=${stateRef.current.missionIndex}&return=game`);
  }, [router, stateRef]);

  const restartMission = useCallback(() => {
    const world = stateRef.current;
    const fresh = createMission({ seed: world.seed, missionIndex: world.missionIndex });
    stateRef.current = fresh;
    terminalSaveRef.current = false;
    campaignRecordedRef.current = false;
    setState({ ...fresh, entities: [...fresh.entities] });
    commitSelection([]);
    cmdQRef.current = [];
    fxRef.current = [];
    clearTools();
    resetInput();
    pausedRef.current = false;
    setPaused(false);
    setPauseView("main");
    setPauseNotice("");
    resetCamera(fresh);
    beep("select");
  }, [
    campaignRecordedRef,
    clearTools,
    cmdQRef,
    commitSelection,
    fxRef,
    pausedRef,
    resetCamera,
    resetInput,
    setPauseNotice,
    setPauseView,
    setPaused,
    setState,
    stateRef,
    terminalSaveRef,
  ]);

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

  const advanceTutorial = useCallback(() => {
    const stages: NonNullable<SimState["tutorialStage"]>[] = ["select", "move", "harvest", "build", "produce", "attack", "repair", "complete"];
    const current = stateRef.current.tutorialStage ?? "select";
    const next = stages[Math.min(stages.length - 1, stages.indexOf(current) + 1)]!;
    stateRef.current.tutorialStage = next;
    setState({ ...stateRef.current, entities: [...stateRef.current.entities] });
    if (next === "complete") {
      const progress = readCampaignProgress(localStorageAdapter(), seed);
      progress.tutorialComplete = true;
      writeCampaignProgress(localStorageAdapter(), progress);
    }
  }, [seed, setState, stateRef]);

  const exitTutorial = useCallback(() => {
    const progress = readCampaignProgress(localStorageAdapter(), seed);
    progress.tutorialComplete = true;
    writeCampaignProgress(localStorageAdapter(), progress);
    router.push(`/briefing?seed=${formatSeed(seed)}&mission=0`);
  }, [router, seed]);

  const resultPrimary = useCallback(() => {
    const world = stateRef.current;
    if (world.result === "won" && world.missionIndex < 7) {
      router.push(`/briefing?seed=${formatSeed(world.seed)}&mission=${world.missionIndex + 1}`);
      return;
    }
    if (world.result === "lost") {
      router.push(`/briefing?seed=${formatSeed(world.seed)}&mission=${world.missionIndex}`);
      return;
    }
    router.push("/");
  }, [router, stateRef]);

  const goHome = useCallback(() => router.push("/"), [router]);
  const goMenu = goHome;
  const goNextBriefing = useCallback(() => {
    const world = stateRef.current;
    router.push(`/briefing?seed=${formatSeed(world.seed)}&mission=${world.missionIndex + 1}`);
  }, [router, stateRef]);
  const goCampaignVictory = useCallback(() => {
    router.push(`/campaign-complete?seed=${formatSeed(stateRef.current.seed)}`);
  }, [router, stateRef]);
  const goRetry = useCallback(() => {
    const world = stateRef.current;
    router.push(`/briefing?seed=${formatSeed(world.seed)}&mission=${world.missionIndex}`);
  }, [router, stateRef]);

  return {
    router,
    openPauseMenu,
    resumeMission,
    saveMission,
    loadMission,
    viewMissionBriefing,
    restartMission,
    toggleSound,
    toggleMusic,
    updateVolume,
    advanceTutorial,
    exitTutorial,
    resultPrimary,
    goHome,
    goMenu,
    goNextBriefing,
    goCampaignVictory,
    goRetry,
  };
}
