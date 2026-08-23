"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { setMusicCue, setMusicDucked, TUTORIAL_MUSIC_MISSION } from "@/lib/audio/music";
import { createCampaign } from "@/lib/gen/campaign";
import { listTacticalRasterSources } from "@/lib/gen/visualAssets";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import type { RenderExtras } from "@/lib/render/renderer";
import { preloadRasterSources } from "@/lib/render/sprites";
import type { FxBurst } from "@/lib/render/fx";
import { localStorageAdapter } from "@/lib/persist/save";
import { readSettings } from "@/lib/persist/settings";
import type { Command, SimState } from "@/lib/types";
import type { PauseView, CommandTab } from "@/lib/ui/shortcuts";
import { GamePlayField } from "./GamePlayField";
import { GameOverlays } from "./GameOverlays";
import { useGameCamera } from "./hooks/useGameCamera";
import { useGameActions } from "./hooks/useGameActions";
import { useGameInput } from "./hooks/useGameInput";
import { useGameKeyboard } from "./hooks/useGameKeyboard";
import { useGameLoop } from "./hooks/useGameLoop";
import { initialMission, useGameSession } from "./hooks/useGameSession";
import { renderGameFrame } from "./renderFrame";
import styles from "./GameClient.module.css";

export function GameClient({
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
  const selected = useRef(new Set<number>());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const selectionModeRef = useRef(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CommandTab>("construction");
  const activeTabRef = useRef(activeTab);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const terminalSaveRef = useRef(false);
  const campaignRecordedRef = useRef(false);
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const pauseViewRef = useRef(pauseView);
  const [pauseNotice, setPauseNotice] = useState("");
  const [audioSettings, setAudioSettings] = useState(() => readSettings(localStorageAdapter()));
  const [combatAlert, setCombatAlert] = useState<string | null>(null);
  const combatAlertClearRef = useRef<number | null>(null);
  const cmdQ = useRef<Command[]>([]);
  const fxRef = useRef<FxBurst[]>([]);
  const fxSeq = useRef(1);

  const extrasRef = useRef<RenderExtras>({
    cursor: null,
    placeKind: null,
    repairMode: false,
    sellMode: false,
  });
  const worldCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const miniCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const mobileMiniCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const commitSelection = useCallback((ids: number[]) => {
    selected.current = new Set(ids);
    setSelectedIds(ids);
    const current = stateRef.current;
    if (current.tutorialStage === "select" && ids.some((id) => {
      const entity = current.entities.find((item) => item.id === id);
      return entity?.owner === 0 && entity.class === "unit" && entity.kind === "infantry" && !entity.neutral;
    })) {
      current.tutorialStage = "move";
      setState({ ...current, entities: [...current.entities] });
    }
  }, [setState, stateRef]);

  const camera = useGameCamera({ stateRef, canvasRef, hostRef });
  const {
    camRef,
    panAvail,
    panAvailRef,
    hotPan,
    panHold,
    edgePanHover,
    applyEdgePan,
    jumpHome,
    centerSelection,
    resetCamera,
  } = camera;

  const actions = useGameActions({ stateRef, cmdQ, selected });
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

  const redraw = useCallback((nowMs?: number, subTickAlpha = 0) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!s || !canvas || !host) return;
    const frame = renderGameFrame({
      state: s,
      canvas,
      host,
      worldCtx: worldCtxRef.current,
      miniCanvas: miniRef.current,
      miniCtx: miniCtxRef.current,
      secondaryMiniCanvas: mobileMiniRef.current,
      secondaryMiniCtx: mobileMiniCtxRef.current,
      cam: camRef.current,
      selected: selected.current,
      hover: hoverRef.current,
      cursor: cursorRef.current,
      placeKind: place.current,
      repairMode: repair.current,
      sellMode: sell.current,
      selectBox: boxRef.current,
      extras: extrasRef.current,
      fx: fxRef.current,
      nowMs,
      subTickAlpha,
    });
    worldCtxRef.current = frame.worldCtx;
    miniCtxRef.current = frame.miniCtx;
    mobileMiniCtxRef.current = frame.secondaryMiniCtx;
    fxRef.current = frame.fx;
  }, [boxRef, camRef, cursorRef, hoverRef, place, repair, sell]);

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
  });

  const onAlert = useCallback((text: string) => {
    setCombatAlert(text);
    if (combatAlertClearRef.current) window.clearTimeout(combatAlertClearRef.current);
    combatAlertClearRef.current = window.setTimeout(() => {
      setCombatAlert(null);
      combatAlertClearRef.current = null;
    }, 3000);
  }, []);

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
    setPanAvail: () => {},
    applyEdgePan,
    fxRef,
    fxSeq,
    terminalSaveRef,
    campaignRecordedRef,
    redraw,
    onAlert,
  });

  useEffect(() => {
    preloadRasterSources(listTacticalRasterSources());
  }, []);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    pauseViewRef.current = pauseView;
  }, [pauseView]);

  useEffect(() => {
    setMusicCue("mission", seed, tutorial ? TUTORIAL_MUSIC_MISSION : stateRef.current.missionIndex);
  }, [seed, tutorial]);

  useEffect(() => {
    setMusicDucked(paused);
  }, [paused]);

  useEffect(() => () => {
    setMusicDucked(false);
  }, []);

  useEffect(() => () => {
    if (combatAlertClearRef.current) window.clearTimeout(combatAlertClearRef.current);
  }, []);

  const s = state;
  const pal = s.factions[0].palette;

  return (
    <div
      className={styles.shell}
      style={
        {
          "--p": pal.primary,
          "--a": pal.accent,
        } as CSSProperties
      }
      onContextMenu={(e) => e.preventDefault()}
    >
      <GamePlayField
        hostRef={hostRef}
        canvasRef={canvasRef}
        panAvail={panAvail}
        hotPan={hotPan}
        campaign={campaign}
        state={s}
        tutorial={tutorial}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onAdvanceTutorial={session.advanceTutorial}
        onExitTutorial={session.exitTutorial}
        onNextBriefing={session.goNextBriefing}
        onCampaignVictory={session.goCampaignVictory}
        onRetry={session.goRetry}
        onMenu={session.goMenu}
        combatAlert={combatAlert}
      />

      <GameOverlays
        campaign={campaign}
        state={s}
        playerVisualProfile={playerVisualProfile}
        selectedIds={selectedIds}
        tutorial={tutorial}
        selectionMode={selectionMode}
        mobileSheetOpen={mobileSheetOpen}
        miniRef={miniRef}
        mobileMiniRef={mobileMiniRef}
        activeTab={activeTab}
        onTab={setActiveTab}
        paused={paused}
        pauseView={pauseView}
        pauseNotice={pauseNotice}
        audioSettings={audioSettings}
        camera={camera}
        setPauseView={setPauseView}
        setPauseNotice={setPauseNotice}
        onSelectionMode={(active) => {
          actions.cancelMobileCommand();
          setSelectionMode(active);
          if (active) setMobileSheetOpen(false);
        }}
        onOpenMobileSheet={() => {
          setSelectionMode(false);
          setMobileSheetOpen(true);
        }}
        onCloseMobileSheet={() => setMobileSheetOpen(false)}
        actions={actions}
        session={session}
      />
    </div>
  );
}
