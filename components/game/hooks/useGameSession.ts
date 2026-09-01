import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useAudioPreferences } from "@/components/audio/useAudioPreferences";
import { createMission } from "@/lib/sim/api";
import { createTutorialMission } from "@/lib/sim/tutorial";
import { cachedLocalStorage, readSave } from "@/lib/persist/save";
import { consumeFreshLaunchIntent } from "@/lib/persist/navigation";
import type { SaveSession } from "@/lib/persist/save";
import type { GameSettings } from "@/lib/persist/settings";
import type { SimState } from "@/lib/types";
import { useMissionConfirmation } from "./useMissionConfirmation";
import { useMissionPersistence, type MissionPersistenceParams } from "./useMissionPersistence";
import { useMissionRoutes } from "./useMissionRoutes";
import type { NavigationOrigin } from "./missionRoutes";
import { useMissionBackGuard } from "./useMissionBackGuard";

export type { MissionConfirmation, MissionConfirmationAction } from "./missionConfirmation";

function isBrowserReload(): boolean {
  if (typeof window === "undefined") return false;

  const navigation = window.performance?.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) return navigation.type === "reload";

  // Keep compatibility with browsers that only expose the legacy navigation API.
  const legacyNavigation = (window.performance as Performance & { navigation?: { type?: number } }).navigation;
  return legacyNavigation?.type === 1;
}

export function initialMission(
  seed: number,
  mission: number,
  resume: boolean,
  tutorial: boolean,
  fresh = false,
): SimState {
  if (tutorial) return createTutorialMission(seed);
  const freshLaunchIntent = consumeFreshLaunchIntent(seed, mission);
  const startFresh = fresh && (freshLaunchIntent || !isBrowserReload());
  if (!startFresh && typeof window !== "undefined") {
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
  tutorialOrigin = "menu",
  browserBackGuardEnabled = false,
  onBrowserBackLeave,
}: MissionPersistenceParams & {
  settings: GameSettings;
  setSettings: Dispatch<SetStateAction<GameSettings>>;
  saveSession: SaveSession;
  tutorialOrigin?: NavigationOrigin;
  browserBackGuardEnabled?: boolean;
  onBrowserBackLeave?: () => void;
}) {
  const { toggleSound, toggleMusic, toggleTacticalRoster, updateVolume } = useAudioPreferences(settings, setSettings);
  const routes = useMissionRoutes({ seed, stateRef, saveSession, tutorialOrigin });
  const { goHomeNow } = routes;
  const browserBackRef = useRef(false);
  const leaveBackRef = useRef<() => void>(() => undefined);
  const confirmGoHome = useCallback(() => {
    if (browserBackRef.current) {
      browserBackRef.current = false;
      leaveBackRef.current();
      return;
    }
    goHomeNow();
  }, [goHomeNow]);
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
    goHomeNow: confirmGoHome,
  });
  const { goHome: requestConfirmationLeave, cancelConfirmation: cancelConfirmationState } = confirmation;
  const requestBrowserLeave = useCallback(() => {
    onBrowserBackLeave?.();
    browserBackRef.current = true;
    requestConfirmationLeave();
  }, [onBrowserBackLeave, requestConfirmationLeave]);
  const backGuard = useMissionBackGuard({ enabled: browserBackGuardEnabled, onRequestLeave: requestBrowserLeave });

  useEffect(() => {
    leaveBackRef.current = backGuard.leave;
    return () => {
      leaveBackRef.current = () => undefined;
    };
  }, [backGuard.leave]);

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

  const cancelConfirmation = useCallback(() => {
    browserBackRef.current = false;
    cancelConfirmationState();
  }, [cancelConfirmationState]);

  return {
    router: routes.router,
    confirmation: confirmation.confirmation,
    confirmAction: confirmation.confirmAction,
    cancelConfirmation,
    openPauseMenu,
    resumeMission,
    saveMission: confirmation.saveMission,
    exportMission: persistence.exportMissionNow,
    loadMission: confirmation.loadMission,
    viewMissionBriefing: routes.viewMissionBriefing,
    restartMission: confirmation.restartMission,
    toggleSound,
    toggleMusic,
    toggleTacticalRoster,
    updateVolume,
    advanceTutorial: persistence.advanceTutorial,
    exitTutorial: routes.exitTutorial,
    backTutorial: routes.backTutorial,
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
