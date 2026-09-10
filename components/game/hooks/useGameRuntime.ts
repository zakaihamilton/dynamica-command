"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { clearRenderSessionCaches } from "@/lib/render/sessionCache";
import { canonicalCommandRejectionReason, createMissionUxTelemetry } from "@/lib/persist/telemetry";
import { consumeBriefingSkippedIntent } from "@/lib/persist/navigation";
import type { PauseView } from "@/lib/ui/shortcuts";
import { createRuntimeCommandPort } from "./runtime/facade";
import type { CommandNoticeKind } from "./useGameChrome";

export function useGameRuntime({
  seed,
  mission,
  resume,
  fresh = false,
  slot,
  tutorial = false,
}: {
  seed: number;
  mission: number;
  resume: boolean;
  fresh?: boolean;
  slot?: string;
  tutorial?: boolean;
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
  } = useGameRuntimeState({ seed, mission, resume, fresh, slot, tutorial });
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
    commandNotice,
    announceCommand: showCommandNotice,
    audioSettings,
    setAudioSettings,
    cmdQ,
  } = chrome;
  const uxRef = useRef(createMissionUxTelemetry());
  const recordCommandRejection = useCallback((text: string) => {
    const reason = canonicalCommandRejectionReason(text);
    uxRef.current.commandRejectionsByReason[reason] = (uxRef.current.commandRejectionsByReason[reason] ?? 0) + 1;
  }, [uxRef]);
  const announceCommandFeedback = useCallback((text: string, kind: CommandNoticeKind = "info") => {
    uxRef.current.commandFeedbackCount += 1;
    showCommandNotice(text, kind);
    announceTactical(text);
  }, [announceTactical, showCommandNotice, uxRef]);
  const commandPort = useMemo(() => createRuntimeCommandPort(cmdQ), [cmdQ]);
  useEffect(() => {
    if (!tutorial && consumeBriefingSkippedIntent(seed, mission)) uxRef.current.briefingSkipped = true;
  }, [mission, seed, tutorial, uxRef]);

  const selection = useGameSelection({ stateRef, setState, uxRef });
  const { selected, selectedIds, selectionMode, selectionModeRef, commitSelection, setSelectionMode } = selection;
  const { combatAlert, combatAlertKind, onAlert } = useCombatAlert();

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

  const actions = useGameActions({ stateRef, commandPort, selected, selectedIds, onCommandNotice: announceCommandFeedback, onCommandRejection: recordCommandRejection, uxRef });
  const {
    place,
    placeKind,
    setPlaceKind,
    repair,
    repairMode,
    setRepairMode,
    sell,
    sellMode,
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
    selectedIds,
    commitSelection,
    commandPort,
    placeRef: place,
    placeKind,
    setPlaceKind,
    repairRef: repair,
    repairMode,
    setRepairMode,
    sellRef: sell,
    sellMode,
    setSellMode,
    clearTools,
    mobileCommandRef: mobileCommand,
    setMobileCommandState,
    pausedRef,
    panAvailRef,
    applyEdgePan,
    selectionModeRef,
    setSelectionMode,
    onCommandNotice: announceCommandFeedback,
    onCommandRejection: recordCommandRejection,
    uxRef,
  });

  const { hoverRef, cursorRef, boxRef, commandMarkerRef, resetInput, onDown, onEnter, onMove, onLeave, onUp, onCancel } = input;

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
    reducedMotionOverride: audioSettings.reducedMotion,
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
    commandPort,
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
    tutorial,
    browserBackGuardEnabled: !tutorial && state.result === "playing",
    onBrowserBackLeave: resetTransientMobileUi,
  });
  const { openPauseMenu: openMissionPause } = session;

  const recordControlsOpened = useCallback(() => {
    uxRef.current.controlsOpened += 1;
  }, [uxRef]);

  const openPauseMenu = useCallback((view: PauseView = "main") => {
    if (view === "controls") recordControlsOpened();
    resetTransientMobileUi();
    openMissionPause(view);
  }, [openMissionPause, recordControlsOpened, resetTransientMobileUi]);

  const closeMobilePanel = useCallback(() => {
    setMobilePanelOpen(false);
    mobileLauncherRef.current?.focus();
  }, [setMobilePanelOpen]);
  const openMobilePanel = useCallback(() => {
    setSelectionMode(false);
    setMobilePanelOpen(true);
    uxRef.current.mobilePanelOpened += 1;
  }, [setMobilePanelOpen, setSelectionMode, uxRef]);
  const toggleMobilePanel = useCallback(() => {
    if (mobilePanelOpen) {
      closeMobilePanel();
      return;
    }
    openMobilePanel();
  }, [closeMobilePanel, mobilePanelOpen, openMobilePanel]);
  const onMobileSheetDrag = useCallback((direction: "open" | "close") => {
    if (direction === "open" && !mobilePanelOpen) openMobilePanel();
    if (direction === "close" && mobilePanelOpen) closeMobilePanel();
  }, [closeMobilePanel, mobilePanelOpen, openMobilePanel]);

  const onObjectivePanelToggle = useCallback(() => {
    uxRef.current.objectivePanelToggles += 1;
  }, [uxRef]);

  const onExitTutorial = useCallback(() => {
    if (state.tutorialStage === "complete") uxRef.current.tutorialCompleted = true;
    else uxRef.current.tutorialExited = true;
    session.exitTutorial();
  }, [session, state.tutorialStage, uxRef]);
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
    onCommandNotice: announceCommandFeedback,
    persistCampaign: !tutorial,
    uxRef,
  });

  useGameAudioLifecycle({ seed, missionIndex: state.missionIndex, tutorial, paused, result: state.result });

  useEffect(() => () => clearRenderSessionCaches(), []);

  return {
    campaign,
    playerVisualProfile,
    palette: state.factions[0].palette,
    state,
    tutorial,
    paused,
    hostRef,
    canvasRef,
    miniRef,
    panAvail,
    hotPan,
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerEnter: onEnter,
    onPointerLeave: onLeave,
    onPointerUp: onUp,
    onPointerCancel: onCancel,
    onAdvanceTutorial: session.advanceTutorial,
    onExitTutorial,
    onBackTutorial: session.backTutorial,
    onNextBriefing: session.goNextBriefing,
    onCampaignVictory: session.goCampaignVictory,
    onCampaignMap: session.goCampaignMap,
    onRetry: session.goRetry,
    onMenu: session.goMenu,
    combatAlert,
    combatAlertKind,
    commandNotice,
    selectedIds,
    selectionMode,
    setSelectionMode,
    mobilePanelOpen,
    mobileLauncherRef,
    activeTab,
    onTab: setActiveTab,
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
    onMobileSheetDrag,
    onObjectivePanelToggle,
    onControlsOpened: recordControlsOpened,
    onPause: openPauseMenu,
    actions,
    session,
  };
}

export type GameRuntime = ReturnType<typeof useGameRuntime>;
