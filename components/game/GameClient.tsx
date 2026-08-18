"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_PRODUCTION_QUEUE, UPGRADE_COST, buildingCameoStatus, producerFor, productionQueueSize, unitCameoStatus } from "@/lib/catalog";
import { beep, setMuted } from "@/lib/audio/synth";
import { startLoop } from "@/lib/game/loop";
import { createCampaign } from "@/lib/gen/campaign";
import { localStorageAdapter, readSave, writeSave } from "@/lib/persist/save";
import { buyUpgrade, completeMission, readCampaignProgress, writeCampaignProgress } from "@/lib/persist/campaign";
import { panAvailability, panCamera, panOffset, cameraPanBounds, clampCamera, panDirFromPointer, EDGE_PAN_BAND, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { cameraViewQuad, createCamera, screenToTile, tileToScreen, TILE_H } from "@/lib/render/iso";
import { renderMinimap } from "@/lib/render/minimap";
import { pickEntity } from "@/lib/render/pick";
import { renderWorld, pickTile, visibleBuildingAt, type RenderExtras } from "@/lib/render/renderer";
import { burstsFromDestroyed, cullFx, type FxBurst } from "@/lib/render/fx";
import { formatSeed } from "@/lib/seed/rng";
import { createMission } from "@/lib/sim/api";
import { createTutorialMission, tutorialPrompt } from "@/lib/sim/tutorial";
import { shouldShowCommandSidebar } from "@/lib/sim/debrief";
import { objectiveProgress } from "@/lib/sim/objectives";
import { powerBreakdown, heightAt } from "@/lib/sim/world";
import { applyUpgradeSnapshot } from "@/lib/sim/upgrades";
import type { BuildingKind, Command, Formation, SimState, Stance, UnitKind, UpgradeId } from "@/lib/types";
import { gameCommandFromKey, isEditableTarget } from "@/lib/ui/shortcuts";
import { Battlefield } from "./Battlefield";
import { CommandSidebar } from "./CommandSidebar";
import { MissionResult } from "./MissionResult";
import { MobileCommandTray, type MobileCommand } from "./MobileCommandTray";
import { PauseMenu } from "./PauseMenu";
import { TutorialOverlay } from "./TutorialOverlay";
import styles from "./GameClient.module.css";

const PLACEABLE: BuildingKind[] = ["power", "refinery", "barracks", "factory", "turret"];
const PRODUCIBLE: UnitKind[] = ["infantry", "antiArmor", "harvester", "tank"];
const MIN_RENDER_WIDTH = 640;
const MIN_RENDER_HEIGHT = 480;

function renderDimensions(host: HTMLElement): { width: number; height: number } {
  return {
    width: Math.max(MIN_RENDER_WIDTH, Math.floor(host.clientWidth)),
    height: Math.max(MIN_RENDER_HEIGHT, Math.floor(host.clientHeight)),
  };
}

function initialMission(seed: number, mission: number, resume: boolean, tutorial: boolean): SimState {
  if (tutorial) return createTutorialMission(seed);
  if (resume && typeof window !== "undefined") {
    const saved = readSave(localStorageAdapter(), seed);
    if (saved) return saved;
  }
  const fresh = createMission({ seed, missionIndex: mission });
  applyUpgradeSnapshot(fresh, readCampaignProgress(localStorageAdapter(), seed).upgrades);
  return fresh;
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
  const [state, setState] = useState<SimState>(() => initialMission(seed, mission, resume, tutorial));
  const stateRef = useRef<SimState>(state);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef(createCamera());
  const selected = useRef(new Set<number>());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const keys = useRef<Record<string, boolean>>({});
  const hover = useRef<{ x: number; y: number } | null>(null);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const place = useRef<BuildingKind | null>(null);
  const [placeKind, setPlaceKind] = useState<BuildingKind | null>(null);
  const repair = useRef(false);
  const [repairMode, setRepairMode] = useState(false);
  const sell = useRef(false);
  const [sellMode, setSellMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"construction" | "production">("construction");
  const activeTabRef = useRef(activeTab);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const terminalSaveRef = useRef(false);
  const campaignRecordedRef = useRef(false);
  const [pauseView, setPauseView] = useState<"main" | "options" | "assets" | "upgrades">("main");
  const pauseViewRef = useRef(pauseView);
  const [pauseNotice, setPauseNotice] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [campaignProgress, setCampaignProgress] = useState(() => readCampaignProgress(localStorageAdapter(), seed));
  const cmdQ = useRef<Command[]>([]);
  const minimapDragging = useRef(false);
  const panHold = useRef<PanDir | null>(null);
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const touchGesture = useRef<{ center: { x: number; y: number }; distance: number } | null>(null);
  const touchMultiTouch = useRef(false);
  const mobileCommand = useRef<MobileCommand | null>(null);
  const [mobileCommandState, setMobileCommandState] = useState<MobileCommand | null>(null);
  const longPress = useRef<{ pointerId: number; timer: number; x: number; y: number; fired: boolean } | null>(null);
  const extrasRef = useRef<RenderExtras>({
    cursor: null,
    placeKind: null,
    repairMode: false,
    sellMode: false,
  });
  const fxRef = useRef<FxBurst[]>([]);
  const fxSeq = useRef(1);
  const panAvailRef = useRef<PanAvailability>({ left: false, right: false, up: false, down: false });
  const [panAvail, setPanAvail] = useState<PanAvailability>({ left: false, right: false, up: false, down: false });
  const [hotPan, setHotPan] = useState<PanDir | null>(null);

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

  const applyEdgePan = useCallback((dir: PanDir | null) => {
    panHold.current = dir;
    setHotPan((prev) => (prev === dir ? prev : dir));
  }, []);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    pauseViewRef.current = pauseView;
  }, [pauseView]);

  useEffect(() => {
    const s = stateRef.current;
    const resize = () => {
      const c = canvasRef.current;
      const host = hostRef.current;
      if (!c || !host) return;
      const dimensions = renderDimensions(host);
      c.width = dimensions.width;
      c.height = dimensions.height;
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (hostRef.current) observer.observe(hostRef.current);
    const cy = s.entities.find((e) => e.owner === 0 && e.kind === "constructionYard");
    if (cy) {
      const elev = heightAt(s, cy.x, cy.y);
      const p = tileToScreen(cy.x, cy.y, { x: 0, y: 0, zoom: 1 }, elev);
      const c = canvasRef.current;
      camRef.current.x = (c?.width ?? MIN_RENDER_WIDTH) / 2 - p.x;
      camRef.current.y = (c?.height ?? MIN_RENDER_HEIGHT) / 3 - p.y;
      const bounds = cameraPanBounds(camRef.current, s.width, s.height, c?.width ?? MIN_RENDER_WIDTH, c?.height ?? MIN_RENDER_HEIGHT);
      clampCamera(camRef.current, bounds);
      const avail = panAvailability(camRef.current, bounds);
      panAvailRef.current = avail;
      setPanAvail(avail);
    }
    return () => observer.disconnect();
  }, []);

  const redraw = useCallback(() => {
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
    extrasRef.current.cursor = cursor.current;
    extrasRef.current.placeKind = place.current;
    extrasRef.current.repairMode = repair.current;
    extrasRef.current.sellMode = sell.current;
    const now = performance.now();
    extrasRef.current.clockMs = now;
    extrasRef.current.selectBox = box.current;
    fxRef.current = cullFx(fxRef.current, now);
    extrasRef.current.fx = fxRef.current;
    renderWorld(ctx, s, camRef.current, selected.current, hover.current, extrasRef.current);
    const mini = miniRef.current;
    if (mini) {
      const mctx = mini.getContext("2d");
      if (mctx) {
        renderMinimap(mctx, s, cameraViewQuad(camRef.current, canvas.width, canvas.height));
      }
    }
  }, []);

  useEffect(() => {
    const loop = startLoop({
      getState: () => stateRef.current,
      setState: (next) => {
        stateRef.current = next;
      },
      drainCommands: () => cmdQ.current.splice(0, cmdQ.current.length),
      isPaused: () => pausedRef.current,
      onTick: (next, events, now) => {
        if (next.tick % 48 === 0) writeSave(localStorageAdapter(), next);
        if (next.tick % 6 === 0) setState({ ...next, entities: [...next.entities] });
        if (events.some((e) => e.type === "won")) beep("win");
        if (events.some((e) => e.type === "lost")) beep("lose");
        if (events.some((e) => e.type === "commandRejected")) beep("alert");
        if (events.some((e) => e.type === "destroyed")) {
          const spawned = burstsFromDestroyed(events, next, now, fxSeq.current);
          fxSeq.current = spawned.nextId;
          fxRef.current.push(...spawned.bursts);
        }
      },
      onFrame: (_now, s, paused) => {
        if (!paused) {
          const cam = camRef.current;
          const canvas = canvasRef.current;
          const bounds = canvas
            ? cameraPanBounds(cam, s.width, s.height, canvas.width, canvas.height)
            : undefined;
          if (keys.current.w || keys.current.ArrowUp) panCamera(cam, 0, 10, bounds);
          if (keys.current.s || keys.current.ArrowDown) panCamera(cam, 0, -10, bounds);
          if (keys.current.a || keys.current.ArrowLeft) panCamera(cam, 10, 0, bounds);
          if (keys.current.d || keys.current.ArrowRight) panCamera(cam, -10, 0, bounds);
          const hold = panHold.current;
          if (hold && bounds) {
            if (!panAvailability(cam, bounds)[hold]) applyEdgePan(null);
            else {
              const off = panOffset(hold);
              panCamera(cam, off.dx, off.dy, bounds);
            }
          } else if (bounds) {
            clampCamera(cam, bounds);
          }
          if (bounds) {
            const next = panAvailability(cam, bounds);
            const prev = panAvailRef.current;
            if (prev.left !== next.left || prev.right !== next.right || prev.up !== next.up || prev.down !== next.down) {
              panAvailRef.current = next;
              setPanAvail(next);
            }
          }
        }
        if (s.result !== "playing" && !terminalSaveRef.current) {
          terminalSaveRef.current = true;
          writeSave(localStorageAdapter(), s);
          setState({ ...s, entities: [...s.entities] });
        }
        if (s.result === "won" && !campaignRecordedRef.current) {
          campaignRecordedRef.current = true;
          const medals = 1 + (s.runtime?.secondary.every((objective) => objective.kind !== "preserveYard" || s.entities.some((e) => e.owner === 0 && e.kind === "constructionYard" && e.hp > 0)) ? 1 : 0) + (s.losses.units[0] === 0 ? 1 : 0);
          const progress = readCampaignProgress(localStorageAdapter(), s.seed);
          writeCampaignProgress(localStorageAdapter(), completeMission(progress, s.missionIndex, medals, Math.max(0, s.creditsEarned[0] - s.losses.units[0] * 100)));
        }
        redraw();
      },
    });
    return () => loop.stop();
  }, [redraw, applyEdgePan]);

  const commitSelection = useCallback((ids: number[]) => {
    selected.current = new Set(ids);
    setSelectedIds(ids);
  }, []);

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

  const openUpgrades = useCallback(() => {
    setCampaignProgress(readCampaignProgress(localStorageAdapter(), seed));
    setPauseView("upgrades");
    setPauseNotice("");
  }, [seed]);

  const purchaseUpgrade = useCallback((id: UpgradeId) => {
    const next = buyUpgrade(campaignProgress, id, UPGRADE_COST[id]);
    if (!next) {
      setPauseNotice("Upgrade locked or insufficient research points.");
      return;
    }
    writeCampaignProgress(localStorageAdapter(), next);
    setCampaignProgress(next);
    setPauseNotice("Upgrade installed for the next mission.");
  }, [campaignProgress]);

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
    selected.current.clear();
    setSelectedIds([]);
    setPauseNotice(`Loaded mission at tick ${loaded.tick}.`);
  }, [seed]);

  const viewMissionBriefing = useCallback(() => {
    writeSave(localStorageAdapter(), stateRef.current);
    router.push(`/briefing?seed=${formatSeed(stateRef.current.seed)}&mission=${stateRef.current.missionIndex}&return=game`);
  }, [router]);

  const restartMission = useCallback(() => {
    const world = stateRef.current;
    const fresh = createMission({ seed: world.seed, missionIndex: world.missionIndex });
    applyUpgradeSnapshot(fresh, world.appliedUpgrades ?? []);
    stateRef.current = fresh;
    terminalSaveRef.current = false;
    campaignRecordedRef.current = false;
    setState({ ...fresh, entities: [...fresh.entities] });
    selected.current.clear();
    setSelectedIds([]);
    cmdQ.current = [];
    fxRef.current = [];
    place.current = null;
    setPlaceKind(null);
    repair.current = false;
    setRepairMode(false);
    sell.current = false;
    setSellMode(false);
    hover.current = null;
    cursor.current = null;
    box.current = null;
    pausedRef.current = false;
    setPaused(false);
    setPauseView("main");
    setPauseNotice("");
    const cy = fresh.entities.find((e) => e.owner === 0 && e.kind === "constructionYard");
    const canvas = canvasRef.current;
    if (cy && canvas) {
      const elev = heightAt(fresh, cy.x, cy.y);
      const p = tileToScreen(cy.x, cy.y, { x: 0, y: 0, zoom: camRef.current.zoom }, elev);
      camRef.current.x = canvas.width / 2 - p.x;
      camRef.current.y = canvas.height / 3 - p.y;
      const bounds = cameraPanBounds(camRef.current, fresh.width, fresh.height, canvas.width, canvas.height);
      clampCamera(camRef.current, bounds);
      const avail = panAvailability(camRef.current, bounds);
      panAvailRef.current = avail;
      setPanAvail(avail);
    }
    beep("select");
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      setMuted(prev);
      return !prev;
    });
  }, []);

  const availableProducer = useCallback((unit: UnitKind) => {
    const world = stateRef.current;
    const kind = producerFor(unit);
    let best: typeof world.entities[number] | undefined;
    let bestN = Infinity;
    for (const e of world.entities) {
      if (e.hp <= 0 || e.owner !== 0 || e.class !== "building" || e.kind !== kind || e.constructing > 0) continue;
      const n = productionQueueSize(e);
      if (n >= MAX_PRODUCTION_QUEUE) continue;
      if (n < bestN) {
        best = e;
        bestN = n;
      }
    }
    return best;
  }, []);

  const focusTile = useCallback((tx: number, ty: number, yBias = 0.5) => {
    const world = stateRef.current;
    const canvas = canvasRef.current;
    if (!world || !canvas) return;
    const elev = heightAt(world, tx, ty);
    const p = tileToScreen(tx, ty, { x: 0, y: 0, zoom: camRef.current.zoom }, elev);
    camRef.current.x = canvas.width / 2 - p.x;
    camRef.current.y = canvas.height * yBias - p.y;
    const bounds = cameraPanBounds(camRef.current, world.width, world.height, canvas.width, canvas.height);
    clampCamera(camRef.current, bounds);
  }, []);

  const jumpHome = useCallback(() => {
    const cy = stateRef.current.entities.find((e) => e.hp > 0 && e.owner === 0 && e.kind === "constructionYard");
    if (cy) focusTile(cy.x, cy.y, 1 / 3);
  }, [focusTile]);

  const centerSelection = useCallback(() => {
    const id = [...selected.current][0];
    const ent = stateRef.current.entities.find((e) => e.id === id && e.hp > 0);
    if (ent) focusTile(ent.x, ent.y);
  }, [focusTile]);

  const clearTools = useCallback(() => {
    place.current = null;
    setPlaceKind(null);
    repair.current = false;
    setRepairMode(false);
    sell.current = false;
    setSellMode(false);
  }, []);

  const chooseMobileCommand = useCallback((command: MobileCommand) => {
    clearTools();
    mobileCommand.current = command;
    setMobileCommandState(command);
    beep("select");
  }, [clearTools]);

  const cancelMobileCommand = useCallback(() => {
    mobileCommand.current = null;
    setMobileCommandState(null);
    clearTools();
    beep("select");
  }, [clearTools]);

  const issueSelectedCommand = useCallback((command: "stop" | "stance" | "formation", value?: Stance | Formation) => {
    const unitIds = [...selected.current];
    if (unitIds.length === 0) return;
    if (command === "stop") cmdQ.current.push({ type: "stop", unitIds });
    else if (command === "stance" && value) cmdQ.current.push({ type: "stance", unitIds, stance: value as Stance });
    else if (command === "formation" && value) cmdQ.current.push({ type: "formation", unitIds, formation: value as Formation });
    mobileCommand.current = null;
    setMobileCommandState(null);
    beep("ack");
  }, []);

  const togglePlace = useCallback((kind: BuildingKind) => {
    const next = place.current === kind ? null : kind;
    place.current = next;
    setPlaceKind(next);
    if (next) {
      repair.current = false;
      setRepairMode(false);
      sell.current = false;
      setSellMode(false);
    }
  }, []);

  const toggleRepair = useCallback(() => {
    const next = !repair.current;
    repair.current = next;
    setRepairMode(next);
    if (next) {
      place.current = null;
      setPlaceKind(null);
      sell.current = false;
      setSellMode(false);
    }
  }, []);

  const toggleSell = useCallback(() => {
    const next = !sell.current;
    sell.current = next;
    setSellMode(next);
    if (next) {
      place.current = null;
      setPlaceKind(null);
      repair.current = false;
      setRepairMode(false);
    }
  }, []);

  const cancelBuilding = useCallback((kind: BuildingKind) => {
    if (place.current === kind) {
      place.current = null;
      setPlaceKind(null);
      beep("select");
      return;
    }
    if (buildingCameoStatus(stateRef.current.entities, 0, kind).phase === "idle") return;
    cmdQ.current.push({ type: "cancelBuild", building: kind });
    beep("select");
  }, []);

  const queueUnit = useCallback((unit: UnitKind) => {
    const next = availableProducer(unit);
    if (!next) return;
    cmdQ.current.push({ type: "produce", fromId: next.id, unit });
    beep("build");
  }, [availableProducer]);

  const cancelUnit = useCallback((unit: UnitKind) => {
    if (unitCameoStatus(stateRef.current.entities, 0, unit).phase === "idle") return;
    cmdQ.current.push({ type: "cancelProduce", unit });
    beep("select");
  }, []);

  const activateCameo = useCallback((index: number, cancel: boolean) => {
    if (activeTabRef.current === "construction") {
      const kind = PLACEABLE[index];
      if (!kind) return;
      if (cancel) cancelBuilding(kind);
      else togglePlace(kind);
      return;
    }
    const unit = PRODUCIBLE[index];
    if (!unit) return;
    if (cancel) cancelUnit(unit);
    else queueUnit(unit);
  }, [cancelBuilding, cancelUnit, queueUnit, togglePlace]);

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

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key] = true;
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
      else if (command.type === "cameo") activateCameo(command.index, command.cancel);
      else if (command.type === "home") jumpHome();
      else if (command.type === "center") centerSelection();
      else if (command.type === "repair") toggleRepair();
      else if (command.type === "sell") toggleSell();
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
      } else if (command.type === "menu") router.push("/");
      else if (command.type === "toggleSound") toggleSound();
      else if (command.type === "resultPrimary") resultPrimary();
      else if (command.type === "resultMenu") router.push("/");
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
    centerSelection,
    clearTools,
    jumpHome,
    loadMission,
    openPauseMenu,
    resultPrimary,
    resumeMission,
    restartMission,
    router,
    saveMission,
    toggleRepair,
    toggleSell,
    toggleSound,
    viewMissionBriefing,
  ]);

  useEffect(() => () => setMuted(false), []);

  function canvasPos(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }

  function entityAt(s: SimState, tx: number, ty: number) {
    const unit = s.entities.find(
      (en) => en.hp > 0 && en.class === "unit" && (isContactTarget(s, en) || !en.neutral) && Math.round(en.x) === tx && Math.round(en.y) === ty,
    );
    if (unit) return unit;
    return visibleBuildingAt(s, tx, ty);
  }

  function isContactTarget(s: SimState, entity: SimState["entities"][number]): boolean {
    return entity.neutral === true
      && (s.runtime?.kind === "rescue" || s.runtime?.kind === "extraction")
      && s.runtime.targetIds.includes(entity.id);
  }

  function pickSelectableEntity(s: SimState, x: number, y: number, tx: number, ty: number) {
    return pickEntity(s, x, y, camRef.current, s.runtime?.kind === "rescue" || s.runtime?.kind === "extraction") ?? entityAt(s, tx, ty);
  }

  const issueContextOrder = (s: SimState, p: { x: number; y: number }) => {
    const picked = pickTile(s, p.x, p.y, camRef.current);
    const t = picked ?? screenToTile(p.x, p.y, camRef.current);
    const tx = Math.round(t.x);
    const ty = Math.round(t.y);
    if (repair.current || sell.current) {
      clearTools();
      beep("select");
      return;
    }
    const ids = [...selected.current];
    const target = pickSelectableEntity(s, p.x, p.y, tx, ty);
    if (target && target.owner === 1) cmdQ.current.push({ type: "attack", unitIds: ids, targetId: target.id });
    else if (s.tiles[ty * s.width + tx] === 2) cmdQ.current.push({ type: "harvest", unitIds: ids, x: tx, y: ty });
    else cmdQ.current.push({ type: "move", unitIds: ids, x: tx, y: ty });
    beep("ack");
  };

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") {
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = canvasPos(e);
      touchPoints.current.set(e.pointerId, p);
      if (touchPoints.current.size >= 2) {
        touchMultiTouch.current = true;
        touchGesture.current = null;
        if (longPress.current) window.clearTimeout(longPress.current.timer);
        longPress.current = null;
      } else {
        const timer = window.setTimeout(() => {
          const held = longPress.current;
          if (held && held.pointerId === e.pointerId && !held.fired && !touchGesture.current) {
            held.fired = true;
            issueContextOrder(stateRef.current, { x: held.x, y: held.y });
          }
        }, 480);
        longPress.current = { pointerId: e.pointerId, timer, x: p.x, y: p.y, fired: false };
      }
      return;
    }
    if (e.button !== 0) return;
    const p = canvasPos(e);
    box.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPos(e);
    if (e.pointerType === "touch") {
      touchPoints.current.set(e.pointerId, p);
      if (touchPoints.current.size >= 2) {
        const points = [...touchPoints.current.values()];
        const center = { x: (points[0]!.x + points[1]!.x) / 2, y: (points[0]!.y + points[1]!.y) / 2 };
        const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
        const previous = touchGesture.current;
        if (previous) {
          panCamera(camRef.current, center.x - previous.center.x, center.y - previous.center.y, undefined);
          camRef.current.zoom = Math.max(0.55, Math.min(1.8, camRef.current.zoom * (distance / Math.max(1, previous.distance))));
        }
        touchGesture.current = { center, distance };
        return;
      }
      const held = longPress.current;
      if (held && Math.hypot(p.x - held.x, p.y - held.y) > 12) {
        held.fired = true;
        window.clearTimeout(held.timer);
      }
    }
    cursor.current = p;
    const s = stateRef.current;
    if (s) {
      hover.current = pickTile(s, p.x, p.y, camRef.current);
    }
    if (box.current && e.buttons === 1) {
      box.current.x1 = p.x;
      box.current.y1 = p.y;
    }
    const r = e.currentTarget.getBoundingClientRect();
    applyEdgePan(
      pausedRef.current
        ? null
        : panDirFromPointer(e.clientX - r.left, e.clientY - r.top, r.width, r.height, EDGE_PAN_BAND, panAvailRef.current),
    );
  };

  const onLeave = () => {
    cursor.current = null;
    hover.current = null;
    applyEdgePan(null);
  };

  function minimapPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width - 1, (e.clientX - r.left) * (canvas.width / r.width))),
      y: Math.max(0, Math.min(canvas.height - 1, (e.clientY - r.top) * (canvas.height / r.height))),
    };
  }

  function focusFromMinimap(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const mini = e.currentTarget;
    if (!s || !canvas) return;
    const p = minimapPos(e);
    const tx = Math.max(0, Math.min(s.width - 1, Math.floor((p.x / mini.width) * s.width)));
    const ty = Math.max(0, Math.min(s.height - 1, Math.floor((p.y / mini.height) * s.height)));
    const elev = heightAt(s, tx, ty);
    const anchor = tileToScreen(tx, ty, { x: 0, y: 0, zoom: camRef.current.zoom }, elev);
    camRef.current.x = canvas.width / 2 - anchor.x;
    camRef.current.y = canvas.height / 2 - anchor.y - (TILE_H * camRef.current.zoom) / 2;
    const bounds = cameraPanBounds(camRef.current, s.width, s.height, canvas.width, canvas.height);
    clampCamera(camRef.current, bounds);
  }

  const onMinimapPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    minimapDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    focusFromMinimap(e);
  };

  const onMinimapPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (minimapDragging.current) focusFromMinimap(e);
  };

  const onMinimapPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    minimapDragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s) return;
    if (e.pointerType === "touch") {
      const held = longPress.current;
      touchPoints.current.delete(e.pointerId);
      if (held?.pointerId === e.pointerId) {
        window.clearTimeout(held.timer);
        longPress.current = null;
      }
      if (touchPoints.current.size > 0) {
        return;
      }
      const wasGesture = !!touchGesture.current || touchMultiTouch.current;
      touchGesture.current = null;
      touchMultiTouch.current = false;
      if (held?.fired || wasGesture) return;
    }
    const p = canvasPos(e);
    const picked = pickTile(s, p.x, p.y, camRef.current);
    const t = picked ?? screenToTile(p.x, p.y, camRef.current);
    const tx = Math.round(t.x);
    const ty = Math.round(t.y);
    if (e.pointerType === "touch" && mobileCommand.current) {
      const command = mobileCommand.current;
      const target = pickSelectableEntity(s, p.x, p.y, tx, ty);
      const ids = [...selected.current];
      if (ids.length > 0) {
        if (command === "move") cmdQ.current.push({ type: "move", unitIds: ids, x: tx, y: ty });
        else if (command === "attackMove") cmdQ.current.push({ type: "attackMove", unitIds: ids, x: tx, y: ty });
        else if (command === "attack" && target?.owner === 1) cmdQ.current.push({ type: "attack", unitIds: ids, targetId: target.id });
        else if (command === "harvest" && s.tiles[ty * s.width + tx] === 2) cmdQ.current.push({ type: "harvest", unitIds: ids, x: tx, y: ty });
      }
      mobileCommand.current = null;
      setMobileCommandState(null);
      beep("ack");
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      if (repair.current || sell.current) {
        repair.current = false;
        setRepairMode(false);
        sell.current = false;
        setSellMode(false);
        beep("select");
        return;
      }
      issueContextOrder(s, p);
      return;
    }
    if (place.current) {
      box.current = null;
      cmdQ.current.push({ type: "build", building: place.current, x: tx, y: ty });
      beep("build");
      place.current = null;
      setPlaceKind(null);
      return;
    }
    if (repair.current) {
      box.current = null;
      const hit = pickSelectableEntity(s, p.x, p.y, tx, ty);
      if (hit && hit.owner === 0 && hit.class === "building") {
        cmdQ.current.push({ type: "repair", buildingId: hit.id });
        beep("build");
      }
      return;
    }
    if (sell.current) {
      box.current = null;
      const hit = pickSelectableEntity(s, p.x, p.y, tx, ty);
      if (hit && hit.owner === 0 && hit.class === "building") {
        cmdQ.current.push({ type: "sell", buildingId: hit.id });
        beep("build");
      }
      return;
    }
    const b = box.current;
    box.current = null;
    const drag = b && Math.hypot(b.x1 - b.x0, b.y1 - b.y0) > 8;
    if (drag && b) {
      const ids: number[] = [];
      const x0 = Math.min(b.x0, b.x1);
      const y0 = Math.min(b.y0, b.y1);
      const x1 = Math.max(b.x0, b.x1);
      const y1 = Math.max(b.y0, b.y1);
      for (const en of s.entities) {
        if (en.hp <= 0 || en.owner !== 0 || en.class !== "unit" || (en.neutral && !isContactTarget(s, en))) continue;
        const elev = heightAt(s, Math.round(en.x), Math.round(en.y));
        const sp = tileToScreen(en.x, en.y, camRef.current, elev);
        if (sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) ids.push(en.id);
      }
      commitSelection(ids);
    } else {
      const hit = pickSelectableEntity(s, p.x, p.y, tx, ty);
      if (e.pointerType === "touch" && selected.current.size > 0 && !hit) {
        const ids = [...selected.current];
        const hasHarvester = ids.some((id) => s.entities.some((entity) => entity.id === id && entity.owner === 0 && entity.kind === "harvester"));
        if (hasHarvester && s.tiles[ty * s.width + tx] === 2) {
          cmdQ.current.push({ type: "harvest", unitIds: ids, x: tx, y: ty });
        } else {
          cmdQ.current.push({ type: "move", unitIds: ids, x: tx, y: ty });
        }
        beep("ack");
      } else if (e.pointerType === "touch" && selected.current.size > 0 && hit?.owner === 1 && !hit.neutral) {
        cmdQ.current.push({ type: "attack", unitIds: [...selected.current], targetId: hit.id });
        beep("ack");
      } else {
        commitSelection(hit && hit.owner === 0 && (!hit.neutral || isContactTarget(s, hit)) ? [hit.id] : []);
        beep("select");
      }
    }
  };

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

      {shouldShowCommandSidebar(s.result) ? <CommandSidebar
        factionName={campaign.factions[0].name}
        state={s}
        palette={pal}
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
      /> : null}

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
          onAssets={() => { setPauseView("assets"); setPauseNotice(""); }}
          onOptions={() => { setPauseView("options"); setPauseNotice(""); }}
          onMenu={() => router.push("/")}
          onToggleSound={toggleSound}
          onBack={() => setPauseView("main")}
          onCloseAssets={() => setPauseView("main")}
          progress={campaignProgress}
          onUpgrades={openUpgrades}
          onBuyUpgrade={purchaseUpgrade}
        />
      ) : null}
    </div>
  );
}
