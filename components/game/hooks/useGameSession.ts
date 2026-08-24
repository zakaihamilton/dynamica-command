import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useAudioPreferences } from "@/components/audio/useAudioPreferences";
import { createMission } from "@/lib/sim/api";
import { createTutorialMission } from "@/lib/sim/tutorial";
import { localStorageAdapter, readSave } from "@/lib/persist/save";
import type { GameSettings } from "@/lib/persist/settings";
import type { Command, SimState } from "@/lib/types";
import type { PauseView } from "@/lib/ui/shortcuts";
import type { FxBurst } from "@/lib/render/fx";
import { useMissionConfirmation } from "./useMissionConfirmation";
import { useMissionPersistence } from "./useMissionPersistence";
import { useMissionRoutes } from "./useMissionRoutes";

export type { MissionConfirmation, MissionConfirmationAction } from "./missionConfirmation";

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
  const { toggleSound, toggleMusic, updateVolume } = useAudioPreferences(settings, setSettings);
  const routes = useMissionRoutes({ seed, stateRef });
  const persistence = useMissionPersistence({
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
  });
  const confirmation = useMissionConfirmation({
    seed,
    setPauseNotice,
    saveNow: persistence.saveMissionNow,
    loadNow: persistence.loadMissionNow,
    restartNow: persistence.restartMissionNow,
    goHomeNow: routes.goHomeNow,
  });

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

  return {
    router: routes.router,
    confirmation: confirmation.confirmation,
    confirmAction: confirmation.confirmAction,
    cancelConfirmation: confirmation.cancelConfirmation,
    openPauseMenu,
    resumeMission,
    saveMission: confirmation.saveMission,
    loadMission: confirmation.loadMission,
    viewMissionBriefing: routes.viewMissionBriefing,
    restartMission: confirmation.restartMission,
    toggleSound,
    toggleMusic,
    updateVolume,
    advanceTutorial: persistence.advanceTutorial,
    exitTutorial: routes.exitTutorial,
    resultPrimary: routes.resultPrimary,
    goHome: confirmation.goHome,
    goMenu: confirmation.goHome,
    goNextBriefing: routes.goNextBriefing,
    goCampaignVictory: routes.goCampaignVictory,
    goRetry: routes.goRetry,
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
