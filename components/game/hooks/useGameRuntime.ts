"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCombatAlert } from "./useCombatAlert";
import { useGameActions } from "./useGameActions";
import { useGameAudioLifecycle } from "./useGameAudioLifecycle";
import { useGameCamera } from "./useGameCamera";
import { useGameChrome } from "./useGameChrome";
import { useGameInput } from "./useGameInput";
import { useGameKeyboard } from "./useGameKeyboard";
import { useGameLoop } from "./useGameLoop";
import { useGameRenderer } from "./useGameRenderer";
import { useGameSession } from "./useGameSession";
import { useGameSelection } from "./useGameSelection";
import { useGameRuntimeState } from "./useGameRuntimeState";
import type { NavigationOrigin } from "./missionRoutes";
import { clearRenderSessionCaches } from "@/lib/render/sessionCache";

export function useGameRuntime({
  seed,
  mission,
  resume,
  fresh = false,
  tutorial = false,
  tutorialOrigin = "menu",
}: {
  seed: number;
  mission: number;
  resume: boolean;
  fresh?: boolean;
  tutorial?: boolean;
  tutorialOrigin?: NavigationOrigin;
}) {
  const {
    campaign,
    saveSession,
    playerVisualProfile,
    state,
    setState,
    stateRef,
    hostRef,
    canvasRef,
    miniRef,
    mobileMiniRef,
  } = useGameRuntimeState({ seed, mission, resume, fresh, tutorial });
  const chrome = useGameChrome(state.result);
  const {
    mobilePanelOpen,
    setMobilePanelOpen,
    activeTab,
    setActiveTab,
    activeTabRef,
    paused,
    setPaused,
    pausedRef,
    terminalSaveRef,
    campaignRecordedRef,
    pauseView,
    setPauseView,
    pauseViewRef,
    pauseNotice,
    setPauseNotice,
    tacticalAnnouncement,
    announceTactical,
    audioSettings,
    setAudioSettings,
    cmdQ,
  } = chrome;

  const selection = useGameSelection({ stateRef, setState });
  const { selected, selectedIds, selectionMode, selectionModeRef, commitSelection, setSelectionMode } = selection;
  const { combatAlert, onAlert } = useCombatAlert();

  const camera = useGameCamera({ stateRef, canvasRef, hostRef });
  const {
    camRef,
    panAvail,
    panAvailRef,
    setPanAvail,
    hotPan,
    panHold,
    edgePanHover,
    applyEdgePan,
    jumpHome,
    centerSelection,
    resetCamera,
  } = camera;

  const actions = useGameActions({ stateRef, cmdQ, selected, selectedIds });
  const {
    place,
    setPlaceKind,
    repair,
    setRepairMode,
    sell,
    setSellMode,
    mobileCommand,
    setMobileCommandState,
    resetMobileCommand,
    cancelMobileCommand,
    clearTools,
    issueSelectedCommand,
    toggleRepair,
    toggleSell,
    activateCameo,
  } = actions;
  const mobileLauncherRef = useRef<HTMLButtonElement>(null);

  const input = useGameInput({
    stateRef,
    camRef,
    selectedRef: selected,
    commitSelection,
    cmdQRef: cmdQ,
    placeRef: place,
    setPlaceKind,
    repairRef: repair,
    setRepairMode,
    sellRef: sell,
    setSellMode,
    clearTools,
    mobileCommandRef: mobileCommand,
    setMobileCommandState,
    pausedRef,
    panAvailRef,
    applyEdgePan,
    selectionModeRef,
    setSelectionMode,
  });

  const { hoverRef, cursorRef, boxRef, commandMarkerRef, resetInput, onDown, onMove, onLeave, onUp, onCancel } = input;

  const { fxRef, fxSeq, redraw } = useGameRenderer({
    stateRef,
    hostRef,
    canvasRef,
    miniRef,
    mobileMiniRef,
    camRef,
    selected,
    hoverRef,
    cursorRef,
    boxRef,
    commandMarkerRef,
    place,
    repair,
    sell,
  });

  const resetTransientMobileUi = useCallback(() => {
    resetMobileCommand();
    clearTools();
    resetInput();
    setSelectionMode(false);
    setMobilePanelOpen(false);
  }, [clearTools, resetInput, resetMobileCommand, setMobilePanelOpen, setSelectionMode]);

  const session = useGameSession({
    seed,
    stateRef,
    setState,
    commitSelection,
    cmdQRef: cmdQ,
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
    settings: audioSettings,
    setSettings: setAudioSettings,
    saveSession,
    tutorialOrigin,
    browserBackGuardEnabled: !tutorial && state.result === "playing",
    onBrowserBackLeave: resetTransientMobileUi,
  });
  const { openPauseMenu: openMissionPause } = session;

  const openPauseMenu = useCallback(() => {
    resetTransientMobileUi();
    openMissionPause();
  }, [openMissionPause, resetTransientMobileUi]);

  const closeMobilePanel = useCallback(() => {
    setMobilePanelOpen(false);
    mobileLauncherRef.current?.focus();
  }, [setMobilePanelOpen]);
  const toggleMobilePanel = useCallback(() => {
    setSelectionMode(false);
    if (mobilePanelOpen) {
      closeMobilePanel();
      return;
    }
    setMobilePanelOpen(true);
  }, [closeMobilePanel, mobilePanelOpen, setMobilePanelOpen, setSelectionMode]);
  const cancelKeyboardTool = useCallback(() => {
    cancelMobileCommand();
    resetInput();
    setSelectionMode(false);
  }, [cancelMobileCommand, resetInput, setSelectionMode]);

  useEffect(() => {
    const onOrientationChange = () => resetTransientMobileUi();
    window.addEventListener("orientationchange", onOrientationChange);
    return () => window.removeEventListener("orientationchange", onOrientationChange);
  }, [resetTransientMobileUi]);

  useEffect(() => {
    if (tutorial || paused || state.result !== "playing") resetTransientMobileUi();
  }, [paused, resetTransientMobileUi, state.result, tutorial]);

  const { keys } = useGameKeyboard({
    stateRef,
    pausedRef,
    pauseViewRef,
    activeTabRef,
    place,
    repair,
    sell,
    openPauseMenu,
    resumeMission: session.resumeMission,
    setPauseView,
    setPauseNotice,
    setActiveTab,
    activateCameo,
    jumpHome,
    centerSelection: () => centerSelection(selected.current),
    toggleRepair,
    toggleSell,
    stopSelected: () => issueSelectedCommand("stop"),
    clearTools: cancelKeyboardTool,
    saveMission: session.saveMission,
    loadMission: session.loadMission,
    viewMissionBriefing: session.viewMissionBriefing,
    restartMission: session.restartMission,
    toggleSound: session.toggleSound,
    toggleMusic: session.toggleMusic,
    resultPrimary: session.resultPrimary,
    onNavigateHome: session.goHome,
    confirmationOpen: session.confirmation !== null,
    cancelConfirmation: session.cancelConfirmation,
    mobilePanelOpen,
    closeMobilePanel,
    mobileToolActive: selectionMode || actions.mobileCommandState !== null,
  });

  useGameLoop({
    stateRef,
    setState,
    cmdQ,
    pausedRef,
    camRef,
    canvasRef,
    keys,
    edgePanHover,
    panHold,
    panAvailRef,
    setPanAvail,
    applyEdgePan,
    fxRef,
    fxSeq,
    terminalSaveRef,
    campaignRecordedRef,
    saveSession,
    redraw,
    onAlert,
    onTacticalAnnouncement: announceTactical,
  });

  useGameAudioLifecycle({ seed, missionIndex: state.missionIndex, tutorial, paused });

  useEffect(() => () => clearRenderSessionCaches(), []);

  return {
    campaign,
    playerVisualProfile,
    palette: state.factions[0].palette,
    playField: {
      hostRef,
      canvasRef,
      panAvail,
      hotPan,
      campaign,
      state,
      tutorial,
      onPointerDown: onDown,
      onPointerMove: onMove,
      onPointerLeave: onLeave,
      onPointerUp: onUp,
      onPointerCancel: onCancel,
      onAdvanceTutorial: session.advanceTutorial,
      onExitTutorial: session.exitTutorial,
      onBackTutorial: session.backTutorial,
      onNextBriefing: session.goNextBriefing,
      onCampaignVictory: session.goCampaignVictory,
      onCampaignMap: session.goCampaignMap,
      onRetry: session.goRetry,
      onMenu: session.goMenu,
      combatAlert,
    },
    overlays: {
      campaign,
      state,
      playerVisualProfile,
      selectedIds,
      tutorial,
      selectionMode,
      mobilePanelOpen,
      mobileLauncherRef,
      miniRef,
      activeTab,
      onTab: setActiveTab,
      paused,
      pauseView,
      pauseNotice,
      tacticalAnnouncement,
      audioSettings,
      camera,
      setPauseView,
      setPauseNotice,
      onSelect: commitSelection,
      onAnnounce: announceTactical,
      onToggleMobilePanel: toggleMobilePanel,
      onPause: openPauseMenu,
      actions,
      session,
    },
  };
}

export type GameRuntime = ReturnType<typeof useGameRuntime>;
