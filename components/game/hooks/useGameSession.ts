import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
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

export type MissionConfirmationAction = "save" | "load" | "restart" | "menu";

export type MissionConfirmation = {
  action: MissionConfirmationAction;
  title: string;
  message: string;
  confirmLabel: string;
};

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
  const [confirmation, setConfirmation] = useState<MissionConfirmation | null>(null);

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

  const saveMissionNow = useCallback(() => {
    const saved = writeSave(localStorageAdapter(), stateRef.current);
    setPauseNotice(saved ? "Mission saved." : "Unable to save: browser storage is unavailable.");
  }, [setPauseNotice, stateRef]);

  const loadMissionNow = useCallback(() => {
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

  const restartMissionNow = useCallback(() => {
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

  const requestConfirmation = useCallback((action: MissionConfirmationAction) => {
    const copy: Record<MissionConfirmationAction, Omit<MissionConfirmation, "action">> = {
      menu: {
        title: "Leave mission?",
        message: "Return to the main menu? Unsaved mission progress will be lost.",
        confirmLabel: "Leave mission",
      },
      restart: {
        title: "Restart mission?",
        message: "Restart this mission from the beginning? Unsaved mission progress will be lost.",
        confirmLabel: "Restart mission",
      },
      save: {
        title: "Save mission?",
        message: "Save the current mission state for this seed?",
        confirmLabel: "Save mission",
      },
      load: {
        title: "Load mission?",
        message: "Load the last save for this seed? Current unsaved mission progress will be lost.",
        confirmLabel: "Load mission",
      },
    };
    setConfirmation({ action, ...copy[action] });
  }, []);

  const saveMission = useCallback(() => {
    requestConfirmation("save");
  }, [requestConfirmation]);

  const loadMission = useCallback(() => {
    if (!readSave(localStorageAdapter(), seed)) {
      setPauseNotice("No save found for this seed.");
      return;
    }
    requestConfirmation("load");
  }, [requestConfirmation, seed, setPauseNotice]);

  const restartMission = useCallback(() => {
    requestConfirmation("restart");
  }, [requestConfirmation]);

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

  const goHomeNow = useCallback(() => router.push("/"), [router]);
  const goHome = useCallback(() => {
    requestConfirmation("menu");
  }, [requestConfirmation]);
  const confirmAction = useCallback(() => {
    const action = confirmation?.action;
    setConfirmation(null);
    if (action === "save") saveMissionNow();
    else if (action === "load") loadMissionNow();
    else if (action === "restart") restartMissionNow();
    else if (action === "menu") goHomeNow();
  }, [confirmation, goHomeNow, loadMissionNow, restartMissionNow, saveMissionNow]);
  const cancelConfirmation = useCallback(() => {
    setConfirmation(null);
  }, []);
  const goMenu = goHome;
  const goNextBriefing = useCallback(() => {
    const world = stateRef.current;
    router.push(`/briefing?seed=${formatSeed(world.seed)}&mission=${world.missionIndex + 1}`);
  }, [router, stateRef]);
  const goCampaignVictory = useCallback(() => {
    router.push(`/campaign-complete?seed=${formatSeed(stateRef.current.seed)}`);
  }, [router, stateRef]);
  const goCampaignMap = useCallback(() => {
    router.push(`/campaign?seed=${formatSeed(stateRef.current.seed)}`);
  }, [router, stateRef]);
  const goRetry = useCallback(() => {
    const world = stateRef.current;
    router.push(`/briefing?seed=${formatSeed(world.seed)}&mission=${world.missionIndex}`);
  }, [router, stateRef]);

  return {
    router,
    confirmation,
    confirmAction,
    cancelConfirmation,
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
    goCampaignMap,
    goRetry,
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
