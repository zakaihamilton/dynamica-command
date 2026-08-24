import { useEffect, useRef, type MutableRefObject } from "react";
import { beep } from "@/lib/audio/synth";
import { gameCommandFromKey, isEditableTarget, type CommandTab, type PauseView } from "@/lib/ui/shortcuts";
import type { BuildingKind, SimState } from "@/lib/types";

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
      if (command.type === "pause") openPauseMenu();
      else if (command.type === "resume") resumeMission();
      else if (command.type === "pauseBack") setPauseView("main");
      else if (command.type === "tab") setActiveTab(command.tab);
      else if (command.type === "cameo" && activeTabRef.current !== "selected") {
        activateCameo(activeTabRef.current, command.index, command.cancel);
      }
      else if (command.type === "home") jumpHome();
      else if (command.type === "center") centerSelection();
      else if (command.type === "repair") toggleRepair();
      else if (command.type === "sell") toggleSell();
      else if (command.type === "stop") stopSelected();
      else if (command.type === "cancelTool") {
        clearTools();
        beep("select");
      } else if (command.type === "save") saveMission();
      else if (command.type === "load") loadMission();
      else if (command.type === "briefing") viewMissionBriefing();
      else if (command.type === "restart") restartMission();
      else if (command.type === "assets") {
        setPauseView("assets");
        setPauseNotice("");
      } else if (command.type === "options") {
        setPauseView("options");
        setPauseNotice("");
      } else if (command.type === "menu") onNavigateHome();
      else if (command.type === "toggleSound") toggleSound();
      else if (command.type === "toggleMusic") toggleMusic();
      else if (command.type === "resultPrimary") resultPrimary();
      else if (command.type === "resultMenu") onNavigateHome();
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
