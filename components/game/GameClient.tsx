"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { setMuted } from "@/lib/audio/synth";
import { createCampaign } from "@/lib/gen/campaign";
import { listTacticalRasterSources } from "@/lib/gen/visualAssets";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { cameraViewQuad } from "@/lib/render/iso";
import { renderMinimap } from "@/lib/render/minimap";
import { renderWorld, type RenderExtras } from "@/lib/render/renderer";
import { preloadRasterSources } from "@/lib/render/sprites";
import { cullFx, type FxBurst } from "@/lib/render/fx";
import { shouldShowCommandSidebar } from "@/lib/sim/debrief";
import { powerBreakdown } from "@/lib/sim/world";
import type { Command, SimState } from "@/lib/types";
import type { PauseView, CommandTab } from "@/lib/ui/shortcuts";
import { CommandSidebar } from "./CommandSidebar";
import { GamePlayField } from "./GamePlayField";
import { MobileCommandTray } from "./MobileCommandTray";
import { PauseMenu } from "./PauseMenu";
import { useGameCamera, renderDimensions } from "./hooks/useGameCamera";
import { useGameActions } from "./hooks/useGameActions";
import { useGameInput } from "./hooks/useGameInput";
import { useGameKeyboard } from "./hooks/useGameKeyboard";
import { useGameLoop } from "./hooks/useGameLoop";
import { initialMission, useGameSession } from "./hooks/useGameSession";
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
  const selected = useRef(new Set<number>());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<CommandTab>("construction");
  const activeTabRef = useRef(activeTab);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const terminalSaveRef = useRef(false);
  const campaignRecordedRef = useRef(false);
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const pauseViewRef = useRef(pauseView);
  const [pauseNotice, setPauseNotice] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [combatAlert, setCombatAlert] = useState<string | null>(null);
  const combatAlertClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cmdQ = useRef<Command[]>([]);
  const fxRef = useRef<FxBurst[]>([]);
  const fxSeq = useRef(1);

  const extrasRef = useRef<RenderExtras>({
    cursor: null,
    placeKind: null,
    repairMode: false,
    sellMode: false,
  });

  const commitSelection = useCallback((ids: number[]) => {
    selected.current = new Set(ids);
    setSelectedIds(ids);
  }, []);

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
    onMinimapPointerDown,
    onMinimapPointerMove,
    onMinimapPointerUp,
  } = camera;

  const actions = useGameActions({ stateRef, cmdQ, selected });
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
    mobileCommandState,
    setMobileCommandState,
    clearTools,
    chooseMobileCommand,
    cancelMobileCommand,
    issueSelectedCommand,
    togglePlace,
    toggleRepair,
    toggleSell,
    cancelBuilding,
    availableProducer,
    queueUnit,
    cancelUnit,
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
  });

  const { hoverRef, cursorRef, boxRef, resetInput, onDown, onMove, onLeave, onUp } = input;

  const redraw = useCallback((nowMs?: number, subTickAlpha = 0) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!s || !canvas || !host) return;
    const dimensions = renderDimensions(host);
    if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    extrasRef.current.cursor = cursorRef.current;
    extrasRef.current.placeKind = place.current;
    extrasRef.current.repairMode = repair.current;
    extrasRef.current.sellMode = sell.current;
    const now = nowMs ?? performance.now();
    extrasRef.current.clockMs = now;
    extrasRef.current.selectBox = boxRef.current;
    extrasRef.current.subTickAlpha = subTickAlpha;
    fxRef.current = cullFx(fxRef.current, now);
    extrasRef.current.fx = fxRef.current;
    renderWorld(ctx, s, camRef.current, selected.current, hoverRef.current, extrasRef.current);
    const mini = miniRef.current;
    if (mini) {
      const mctx = mini.getContext("2d");
      if (mctx) {
        renderMinimap(mctx, s, cameraViewQuad(camRef.current, canvas.width, canvas.height));
      }
    }
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
    setSoundEnabled,
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
    pauseViewRef.current = pauseView;
  }, [pauseView]);

  useEffect(() => () => setMuted(false), []);

  useEffect(() => () => {
    if (combatAlertClearRef.current) window.clearTimeout(combatAlertClearRef.current);
  }, []);

  const s = state;
  const grid = powerBreakdown(s, 0);
  const selectedEnt = s.entities.find((e) => selectedIds.includes(e.id) && e.hp > 0);
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
        onAdvanceTutorial={session.advanceTutorial}
        onExitTutorial={session.exitTutorial}
        onNextBriefing={session.goNextBriefing}
        onCampaignVictory={session.goCampaignVictory}
        onRetry={session.goRetry}
        onMenu={session.goMenu}
        combatAlert={combatAlert}
      />

      <MobileCommandTray
        command={mobileCommandState}
        onCommand={chooseMobileCommand}
        onStop={() => issueSelectedCommand("stop")}
        onRepair={toggleRepair}
        onSell={toggleSell}
        onStance={(stance) => issueSelectedCommand("stance", stance)}
        onFormation={(formation) => issueSelectedCommand("formation", formation)}
        onCancel={cancelMobileCommand}
      />

      {shouldShowCommandSidebar(s.result) ? (
        <CommandSidebar
          factionName={campaign.factions[0].name}
          state={s}
          palette={pal}
          profile={playerVisualProfile}
          selected={selectedEnt}
          placeKind={placeKind}
          repairMode={repairMode}
          sellMode={sellMode}
          activeTab={activeTab}
          power={grid.surplus}
          produced={grid.produced}
          used={grid.used}
          miniRef={miniRef}
          onPause={session.openPauseMenu}
          onMinimapPointerDown={onMinimapPointerDown}
          onMinimapPointerMove={onMinimapPointerMove}
          onMinimapPointerUp={onMinimapPointerUp}
          onTab={setActiveTab}
          onRepair={toggleRepair}
          onSell={toggleSell}
          onPlace={togglePlace}
          onCancelBuilding={cancelBuilding}
          onQueueUnit={queueUnit}
          onCancelUnit={cancelUnit}
          availableProducer={availableProducer}
          onStop={() => issueSelectedCommand("stop")}
          onStance={(stance) => issueSelectedCommand("stance", stance)}
          onFormation={(formation) => issueSelectedCommand("formation", formation)}
        />
      ) : null}

      {paused ? (
        <PauseMenu
          view={pauseView}
          notice={pauseNotice}
          soundEnabled={soundEnabled}
          palette={pal}
          onResume={session.resumeMission}
          onSave={session.saveMission}
          onLoad={session.loadMission}
          onBriefing={session.viewMissionBriefing}
          onRestart={session.restartMission}
          onAssets={() => {
            setPauseView("assets");
            setPauseNotice("");
          }}
          onOptions={() => {
            setPauseView("options");
            setPauseNotice("");
          }}
          onMenu={session.goMenu}
          onToggleSound={session.toggleSound}
          onBack={() => setPauseView("main")}
          onCloseAssets={() => setPauseView("main")}
        />
      ) : null}
    </div>
  );
}
