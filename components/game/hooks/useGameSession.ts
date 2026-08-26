import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useAudioPreferences } from "@/components/audio/useAudioPreferences";
import { createMission } from "@/lib/sim/api";
import { createTutorialMission } from "@/lib/sim/tutorial";
import { cachedLocalStorage, readSave } from "@/lib/persist/save";
import type { SaveSession } from "@/lib/persist/save";
import type { GameSettings } from "@/lib/persist/settings";
import type { SimState } from "@/lib/types";
import { useMissionConfirmation } from "./useMissionConfirmation";
import { useMissionPersistence, type MissionPersistenceParams } from "./useMissionPersistence";
import { useMissionRoutes } from "./useMissionRoutes";

export type { MissionConfirmation, MissionConfirmationAction } from "./missionConfirmation";

export function initialMission(
  seed: number,
  mission: number,
  resume: boolean,
  tutorial: boolean,
  fresh = false,
): SimState {
  if (tutorial) return createTutorialMission(seed);
  if (!fresh && typeof window !== "undefined") {
    const saved = readSave(cachedLocalStorage(), seed);
    if (saved && (resume || saved.missionIndex === mission)) return saved;
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
  saveSession,
}: MissionPersistenceParams & {
  settings: GameSettings;
  setSettings: Dispatch<SetStateAction<GameSettings>>;
  saveSession: SaveSession;
}) {
  const { toggleSound, toggleMusic, toggleTacticalRoster, updateVolume } = useAudioPreferences(settings, setSettings);
  const routes = useMissionRoutes({ seed, stateRef, saveSession });
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
    saveSession,
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
    toggleTacticalRoster,
    updateVolume,
    advanceTutorial: persistence.advanceTutorial,
    exitTutorial: routes.exitTutorial,
    resultPrimary: routes.resultPrimary,
    goHome: confirmation.goHome,
    goMenu: confirmation.goHome,
    goNextBriefing: routes.goNextBriefing,
    goCampaignVictory: routes.goCampaignVictory,
    goCampaignMap: routes.goCampaignMap,
    goRetry: routes.goRetry,
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
