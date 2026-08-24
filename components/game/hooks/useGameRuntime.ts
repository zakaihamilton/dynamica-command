"use client";

import { useMemo, useRef, useState } from "react";
import { createCampaign } from "@/lib/gen/campaign";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import type { SimState } from "@/lib/types";
import { useCombatAlert } from "./useCombatAlert";
import { useGameActions } from "./useGameActions";
import { useGameAudioLifecycle } from "./useGameAudioLifecycle";
import { useGameCamera } from "./useGameCamera";
import { useGameChrome } from "./useGameChrome";
import { useGameInput } from "./useGameInput";
import { useGameKeyboard } from "./useGameKeyboard";
import { useGameLoop } from "./useGameLoop";
import { useGameRenderer } from "./useGameRenderer";
import { initialMission, useGameSession } from "./useGameSession";
import { useGameSelection } from "./useGameSelection";

export function useGameRuntime({
  seed,
  mission,
  resume,
  tutorial = false,
}: {
  seed: number;
  mission: number;
  resume: boolean;
  tutorial?: boolean;
}) {
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const playerVisualProfile = useMemo(() => generateVisualProfile(seed, 0), [seed]);
  const [state, setState] = useState<SimState>(() => initialMission(seed, mission, resume, tutorial));
  const stateRef = useRef<SimState>(state);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const mobileMiniRef = useRef<HTMLCanvasElement>(null);
  const chrome = useGameChrome();
  const {
    mobileSheetOpen,
    setMobileSheetOpen,
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
    clearTools,
    issueSelectedCommand,
    toggleRepair,
    toggleSell,
    activateCameo,
  } = actions;

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

  const { hoverRef, cursorRef, boxRef, resetInput, onDown, onMove, onLeave, onUp, onCancel } = input;

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
    place,
    repair,
    sell,
  });

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
  });

  const { keys } = useGameKeyboard({
    stateRef,
    pausedRef,
    pauseViewRef,
    activeTabRef,
    place,
    repair,
    sell,
    openPauseMenu: session.openPauseMenu,
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
    clearTools,
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
    redraw,
    onAlert,
  });

  useGameAudioLifecycle({ seed, missionIndex: state.missionIndex, tutorial, paused });

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
      mobileSheetOpen,
      miniRef,
      mobileMiniRef,
      activeTab,
      onTab: setActiveTab,
      paused,
      pauseView,
      pauseNotice,
      audioSettings,
      camera,
      setPauseView,
      setPauseNotice,
      onSelectionMode: (active: boolean) => {
        actions.cancelMobileCommand();
        setSelectionMode(active);
        if (active) setMobileSheetOpen(false);
      },
      onOpenMobileSheet: () => {
        setSelectionMode(false);
        setMobileSheetOpen(true);
      },
      onCloseMobileSheet: () => setMobileSheetOpen(false),
      actions,
      session,
    },
  };
}

export type GameRuntime = ReturnType<typeof useGameRuntime>;
