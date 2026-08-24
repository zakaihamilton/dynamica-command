import { useEffect, useRef, type MutableRefObject } from "react";
import { gameCommandFromKey, isEditableTarget, type CommandTab, type PauseView } from "@/lib/ui/shortcuts";
import type { BuildingKind, SimState } from "@/lib/types";
import { applyGameCommand } from "./gameKeyboard";

export function useGameKeyboard({
  stateRef,
  pausedRef,
  pauseViewRef,
  activeTabRef,
  place,
  repair,
  sell,
  openPauseMenu,
  resumeMission,
  setPauseView,
  setPauseNotice,
  setActiveTab,
  activateCameo,
  jumpHome,
  centerSelection,
  toggleRepair,
  toggleSell,
  stopSelected,
  clearTools,
  saveMission,
  loadMission,
  viewMissionBriefing,
  restartMission,
  toggleSound,
  toggleMusic,
  resultPrimary,
  onNavigateHome,
  confirmationOpen = false,
  cancelConfirmation = () => {},
}: {
  stateRef: MutableRefObject<SimState>;
  pausedRef: MutableRefObject<boolean>;
  pauseViewRef: MutableRefObject<PauseView>;
  activeTabRef: MutableRefObject<CommandTab>;
  place: MutableRefObject<BuildingKind | null>;
  repair: MutableRefObject<boolean>;
  sell: MutableRefObject<boolean>;
  openPauseMenu: () => void;
  resumeMission: () => void;
  setPauseView: (view: PauseView) => void;
  setPauseNotice: (notice: string) => void;
  setActiveTab: (tab: CommandTab) => void;
  activateCameo: (tab: "construction" | "production", index: number, cancel: boolean) => void;
  jumpHome: () => void;
  centerSelection: () => void;
  toggleRepair: () => void;
  toggleSell: () => void;
  stopSelected: () => void;
  clearTools: () => void;
  saveMission: () => void;
  loadMission: () => void;
  viewMissionBriefing: () => void;
  restartMission: () => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  resultPrimary: () => void;
  onNavigateHome: () => void;
  confirmationOpen?: boolean;
  cancelConfirmation?: () => void;
}) {
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key] = true;
      if (confirmationOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelConfirmation();
        }
        return;
      }
      if (
        !isEditableTarget(e.target) &&
        !pausedRef.current &&
        stateRef.current.result === "playing" &&
        (e.key === "w" || e.key === "a" || e.key === "s" || e.key === "d" || e.key.startsWith("Arrow"))
      ) {
        e.preventDefault();
      }
      const command = gameCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        playing: !pausedRef.current && stateRef.current.result === "playing",
        paused: pausedRef.current,
        pauseView: pauseViewRef.current,
        result: stateRef.current.result,
        toolActive: !!(place.current || repair.current || sell.current),
      });
      if (!command) return;
      e.preventDefault();
      applyGameCommand(command, {
        activeTab: activeTabRef.current,
        openPauseMenu,
        resumeMission,
        setPauseView,
        setPauseNotice,
        setActiveTab,
        activateCameo,
        jumpHome,
        centerSelection,
        toggleRepair,
        toggleSell,
        stopSelected,
        clearTools,
        saveMission,
        loadMission,
        viewMissionBriefing,
        restartMission,
        toggleSound,
        toggleMusic,
        resultPrimary,
        onNavigateHome,
      });
    };

    const up = (e: KeyboardEvent) => {
      keys.current[e.key] = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [
    activateCameo,
    activeTabRef,
    cancelConfirmation,
    centerSelection,
    confirmationOpen,
    clearTools,
    jumpHome,
    loadMission,
    onNavigateHome,
    openPauseMenu,
    pauseViewRef,
    pausedRef,
    place,
    repair,
    restartMission,
    resultPrimary,
    resumeMission,
    saveMission,
    sell,
    setActiveTab,
    setPauseNotice,
    setPauseView,
    stateRef,
    stopSelected,
    toggleRepair,
    toggleSell,
    toggleSound,
    toggleMusic,
    viewMissionBriefing,
  ]);

  return { keys };
}
