"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { beep, setMuted } from "@/lib/audio/synth";
import { createCampaign } from "@/lib/gen/campaign";
import { generateVisualProfile } from "@/lib/gen/visualProfile";
import { localStorageAdapter, readSave, writeSave } from "@/lib/persist/save";
import { readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import { cameraViewQuad } from "@/lib/render/iso";
import { renderMinimap } from "@/lib/render/minimap";
import { renderWorld, type RenderExtras } from "@/lib/render/renderer";
import { cullFx, type FxBurst } from "@/lib/render/fx";
import { formatSeed } from "@/lib/seed/rng";
import { createMission } from "@/lib/sim/api";
import { createTutorialMission, tutorialPrompt } from "@/lib/sim/tutorial";
import { shouldShowCommandSidebar } from "@/lib/sim/debrief";
import { objectiveProgress } from "@/lib/sim/objectives";
import { powerBreakdown } from "@/lib/sim/world";
import type { Command, SimState } from "@/lib/types";
import type { PauseView } from "@/lib/ui/shortcuts";
import { Battlefield } from "./Battlefield";
import { CommandSidebar } from "./CommandSidebar";
import { MissionResult } from "./MissionResult";
import { MobileCommandTray } from "./MobileCommandTray";
import { PauseMenu } from "./PauseMenu";
import { TutorialOverlay } from "./TutorialOverlay";
import { useGameCamera, renderDimensions, MIN_RENDER_WIDTH, MIN_RENDER_HEIGHT } from "./hooks/useGameCamera";
import { useGameActions } from "./hooks/useGameActions";
import { useGameInput } from "./hooks/useGameInput";
import { useGameKeyboard } from "./hooks/useGameKeyboard";
import { useGameLoop } from "./hooks/useGameLoop";
import styles from "./GameClient.module.css";

function initialMission(seed: number, mission: number, resume: boolean, tutorial: boolean): SimState {
  if (tutorial) return createTutorialMission(seed);
  if (resume && typeof window !== "undefined") {
    const saved = readSave(localStorageAdapter(), seed);
    if (saved) return saved;
  }
  return createMission({ seed, missionIndex: mission });
}

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
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const playerVisualProfile = useMemo(() => generateVisualProfile(seed, 0), [seed]);
  const [state, setState] = useState<SimState>(() => initialMission(seed, mission, resume, tutorial));
  const stateRef = useRef<SimState>(state);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const selected = useRef(new Set<number>());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<"construction" | "production">("construction");
  const activeTabRef = useRef(activeTab);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const terminalSaveRef = useRef(false);
  const campaignRecordedRef = useRef(false);
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const pauseViewRef = useRef(pauseView);
  const [pauseNotice, setPauseNotice] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
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

  const openPauseMenu = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
    setPauseView("main");
    setPauseNotice("");
  }, []);

  const resumeMission = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    setPauseView("main");
    setPauseNotice("");
  }, []);

  const saveMission = useCallback(() => {
    writeSave(localStorageAdapter(), stateRef.current);
    setPauseNotice("Mission saved.");
  }, []);

  const loadMission = useCallback(() => {
    const loaded = readSave(localStorageAdapter(), seed);
    if (!loaded) {
      setPauseNotice("No save found for this seed.");
      return;
    }
    stateRef.current = loaded;
    campaignRecordedRef.current = loaded.result === "won";
    terminalSaveRef.current = loaded.result !== "playing";
    setState({ ...loaded, entities: [...loaded.entities] });
    commitSelection([]);
    setPauseNotice(`Loaded mission at tick ${loaded.tick}.`);
  }, [commitSelection, seed]);

  const viewMissionBriefing = useCallback(() => {
    writeSave(localStorageAdapter(), stateRef.current);
    router.push(`/briefing?seed=${formatSeed(stateRef.current.seed)}&mission=${stateRef.current.missionIndex}&return=game`);
  }, [router]);

  const restartMission = useCallback(() => {
    const world = stateRef.current;
    const fresh = createMission({ seed: world.seed, missionIndex: world.missionIndex });
    stateRef.current = fresh;
    terminalSaveRef.current = false;
    campaignRecordedRef.current = false;
    setState({ ...fresh, entities: [...fresh.entities] });
    commitSelection([]);
    cmdQ.current = [];
    fxRef.current = [];
    clearTools();
    resetInput();
    pausedRef.current = false;
    setPaused(false);
    setPauseView("main");
    setPauseNotice("");
    resetCamera(fresh);
    beep("select");
  }, [clearTools, commitSelection, resetCamera, resetInput]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      setMuted(prev);
      return !prev;
    });
  }, []);

  const advanceTutorial = useCallback(() => {
    const stages: NonNullable<SimState["tutorialStage"]>[] = ["select", "move", "harvest", "build", "produce", "attack", "repair", "complete"];
    const current = stateRef.current.tutorialStage ?? "select";
    const next = stages[Math.min(stages.length - 1, stages.indexOf(current) + 1)]!;
    stateRef.current.tutorialStage = next;
    setState({ ...stateRef.current, entities: [...stateRef.current.entities] });
    if (next === "complete") {
      const progress = readCampaignProgress(localStorageAdapter(), seed);
      progress.tutorialComplete = true;
      writeCampaignProgress(localStorageAdapter(), progress);
    }
  }, [seed]);

  const exitTutorial = useCallback(() => {
    const progress = readCampaignProgress(localStorageAdapter(), seed);
    progress.tutorialComplete = true;
    writeCampaignProgress(localStorageAdapter(), progress);
    router.push(`/briefing?seed=${formatSeed(seed)}&mission=0`);
  }, [router, seed]);

  const resultPrimary = useCallback(() => {
    const world = stateRef.current;
    if (world.result === "won" && world.missionIndex < 7) {
      router.push(`/briefing?seed=${formatSeed(world.seed)}&mission=${world.missionIndex + 1}`);
      return;
    }
    if (world.result === "lost") {
      router.push(`/briefing?seed=${formatSeed(world.seed)}&mission=${world.missionIndex}`);
      return;
    }
    router.push("/");
  }, [router]);

  const { keys } = useGameKeyboard({
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
    centerSelection: () => centerSelection(selected.current),
    toggleRepair,
    toggleSell,
    clearTools,
    saveMission,
    loadMission,
    viewMissionBriefing,
    restartMission,
    toggleSound,
    resultPrimary,
    onNavigateHome: () => router.push("/"),
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
    setPanAvail: () => {},
    applyEdgePan,
    fxRef,
    fxSeq,
    terminalSaveRef,
    campaignRecordedRef,
    redraw,
  });

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    pauseViewRef.current = pauseView;
  }, [pauseView]);

  useEffect(() => () => setMuted(false), []);

  const s = state;
  const obj = objectiveProgress(s);
  const grid = powerBreakdown(s, 0);
  const power = grid.surplus;
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
      <Battlefield
        hostRef={hostRef}
        canvasRef={canvasRef}
        width={MIN_RENDER_WIDTH}
        height={MIN_RENDER_HEIGHT}
        panAvail={panAvail}
        hotPan={hotPan}
        seed={s.seed}
        levelNumber={s.missionIndex + 1}
        levelCount={campaign.missions.length}
        missionName={s.missionName}
        objective={obj.label}
        biome={s.biome}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerUp={onUp}
      >
        <MissionResult
          state={s}
          onNextBriefing={() => router.push(`/briefing?seed=${formatSeed(s.seed)}&mission=${s.missionIndex + 1}`)}
          onCampaignVictory={() => router.push(`/campaign-complete?seed=${formatSeed(s.seed)}`)}
          onRetry={() => router.push(`/briefing?seed=${formatSeed(s.seed)}&mission=${s.missionIndex}`)}
          onMenu={() => router.push("/")}
        />
        {tutorial ? (
          <TutorialOverlay
            prompt={tutorialPrompt(s)}
            complete={s.tutorialStage === "complete"}
            onAdvance={s.tutorialStage === "complete" ? exitTutorial : advanceTutorial}
            onSkip={exitTutorial}
          />
        ) : null}
      </Battlefield>

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
          power={power}
          produced={grid.produced}
          used={grid.used}
          miniRef={miniRef}
          onPause={openPauseMenu}
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
        />
      ) : null}

      {paused ? (
        <PauseMenu
          view={pauseView}
          notice={pauseNotice}
          soundEnabled={soundEnabled}
          palette={pal}
          onResume={resumeMission}
          onSave={saveMission}
          onLoad={loadMission}
          onBriefing={viewMissionBriefing}
          onRestart={restartMission}
          onAssets={() => {
            setPauseView("assets");
            setPauseNotice("");
          }}
          onOptions={() => {
            setPauseView("options");
            setPauseNotice("");
          }}
          onMenu={() => router.push("/")}
          onToggleSound={toggleSound}
          onBack={() => setPauseView("main")}
          onCloseAssets={() => setPauseView("main")}
        />
      ) : null}
    </div>
  );
}
