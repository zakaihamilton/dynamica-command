"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BUILDING_STATS, MAX_PRODUCTION_QUEUE, TICKS_PER_SECOND, UNIT_STATS, buildingCameoStatus, labelFor, producerFor, productionQueueSize, unitCameoStatus, type CameoStatus } from "@/lib/catalog";
import { beep, setMuted } from "@/lib/audio/synth";
import { TICK_MS } from "@/lib/game/loop";
import { createCampaign } from "@/lib/gen/campaign";
import { buildingSprite, unitSprite } from "@/lib/gen/assets";
import { localStorageAdapter, readSave, writeSave } from "@/lib/persist/save";
import { panAvailability, panCamera, panOffset, cameraPanBounds, clampCamera, panDirFromPointer, EDGE_PAN_BAND, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { cameraViewQuad, createCamera, screenToTile, tileToScreen, TILE_H } from "@/lib/render/iso";
import { renderMinimap } from "@/lib/render/minimap";
import { pickEntity } from "@/lib/render/pick";
import { renderWorld, pickTile, type RenderExtras } from "@/lib/render/renderer";
import { burstsFromDestroyed, cullFx, type FxBurst } from "@/lib/render/fx";
import { drawSprite, rasterize } from "@/lib/render/sprites";
import { formatSeed } from "@/lib/seed/rng";
import { createMission, tick } from "@/lib/sim/api";
import { objectiveProgress } from "@/lib/sim/objectives";
import { powerFor, buildingAt, heightAt } from "@/lib/sim/world";
import type { BuildingKind, Command, SimState, UnitKind } from "@/lib/types";
import { AssetsBrowser } from "@/components/AssetsBrowser";
import { gameCommandFromKey, isEditableTarget, SHORTCUT } from "@/lib/ui/shortcuts";

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

function initialMission(seed: number, mission: number, resume: boolean): SimState {
  if (resume && typeof window !== "undefined") {
    const saved = readSave(localStorageAdapter(), seed);
    if (saved) return saved;
  }
  return createMission({ seed, missionIndex: mission });
}

function SpritePreview({
  kind,
  palette,
}: {
  kind: BuildingKind | UnitKind;
  palette: SimState["factions"][number]["palette"];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const isUnit = kind === "harvester" || kind === "infantry" || kind === "antiArmor" || kind === "tank";
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let frame = 0;
    let last = 0;
    const paint = (animationFrame: 0 | 1 | 2 | 3) => {
      const spec = isUnit
        ? unitSprite(kind as UnitKind, palette, { facing: 0, animationFrame })
        : buildingSprite(kind as BuildingKind, palette);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const image = rasterize(spec);
      const scale = Math.min(canvas.width / spec.w, canvas.height / spec.h) * 0.9;
      const dw = Math.max(1, Math.round(spec.w * scale));
      const dh = Math.max(1, Math.round(spec.h * scale));
      drawSprite(ctx, spec, image, Math.round((canvas.width - dw) / 2), Math.round((canvas.height - dh) / 2), dw, dh);
    };
    paint(0);
    if (!isUnit) return;
    const loop = (now: number) => {
      if (now - last > 140) {
        frame = (frame + 1) & 3;
        last = now;
        paint(frame as 0 | 1 | 2 | 3);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isUnit, kind, palette]);
  return <canvas ref={ref} width={80} height={56} className="pixel-canvas cameo-sprite" aria-hidden />;
}

function ProgressMeter({
  label,
  ratio,
  detail,
}: {
  label: string;
  ratio: number;
  detail?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-[var(--chrome-muted)]">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-[var(--chrome-cyan)]">{pct}%{detail ? ` · ${detail}` : ""}</span>
      </div>
      <div className="progress-track mt-1">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ScrollArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" className="scroll-arrow-icon">
      <path
        d="M5 16 L12 7 L19 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SCROLL_ROTATION: Record<PanDir, number> = { up: 0, right: 90, down: 180, left: 270 };

function ScrollArrow({
  dir,
  available,
  hot,
}: {
  dir: PanDir;
  available: boolean;
  hot: boolean;
}) {
  const label = dir === "up" ? "north" : dir === "down" ? "south" : dir;
  const tooltipPos = dir === "up" ? "below" : dir === "left" ? "right" : dir === "right" ? "left" : "above";
  const showTip = hot && available;
  return (
    <div
      className={`scroll-arrow scroll-arrow-${dir} ${available ? "" : "scroll-arrow-off"} ${showTip ? "scroll-arrow-hot" : ""}`}
      data-testid={`scroll-arrow-${dir}`}
      data-tooltip={`Scroll ${label}`}
      data-shortcut={SHORTCUT.pan[dir]}
      data-tooltip-pos={tooltipPos}
      {...(showTip ? { "data-tooltip-open": "" } : {})}
      aria-hidden
    >
      <span className="scroll-arrow-glyph" style={{ transform: `rotate(${SCROLL_ROTATION[dir]}deg)` }}>
        <ScrollArrowIcon />
      </span>
    </div>
  );
}

function CommandTabIcon({ type }: { type: "construction" | "production" | "repair" }) {
  if (type === "construction") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M5 20h14M7 17h10M9 17V8l3-3 3 3v9M6 8h12M12 5V2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    );
  }
  if (type === "repair") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M8 4.5l3 3-6.5 6.5-3-3L8 4.5zM14.5 13.5l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M7 7.5l2 2M16.5 15.5l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M3 20h18M5 20v-8h5v8M14 20V8h5v12M5 12l3-4 3 3 4-6 4 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M16 4h3v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function CreditsCounter({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  useEffect(() => {
    const from = shownRef.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = Math.min(700, 160 + Math.abs(to - from) * 4);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - t) * (1 - t);
      const next = Math.round(from + (to - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div className="credits-counter" aria-label={`${value} credits`}>
      <span className="credits-label">Credits</span>
      <strong data-testid="credits" className="credits-digits">
        <span className="credits-currency">$</span>
        {shown.toLocaleString("en-US")}
      </strong>
    </div>
  );
}

function CommandCameo({
  kind,
  palette,
  cost,
  disabled,
  active,
  cameo,
  shortcut,
  onClick,
  onContextMenu,
}: {
  kind: BuildingKind | UnitKind;
  palette: SimState["factions"][number]["palette"];
  cost: number;
  disabled?: boolean;
  active?: boolean;
  cameo: CameoStatus;
  shortcut?: string;
  onClick: () => void;
  onContextMenu?: () => void;
}) {
  const busy = cameo.phase !== "idle";
  const showCount = cameo.queued > 1 || cameo.phase === "waiting";
  const tooltip = `${labelFor(kind)} · ${cost} credits${busy ? (cameo.phase === "waiting" ? ` · ${cameo.queued} queued` : ` · ${Math.round(cameo.ratio * 100)}%`) : ""}${busy || active ? " · Right-click to cancel" : ""}`;
  return (
    <span
      className="command-cameo-wrap has-tooltip"
      data-tooltip={tooltip}
      data-shortcut={shortcut}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.();
      }}
    >
    <button
      type="button"
      disabled={disabled}
      className={`command-card ${active ? "command-card-active" : ""} ${busy ? "cameo-busy" : ""}`}
      onClick={onClick}
      aria-label={`${labelFor(kind)}, ${cost} credits${busy ? `, ${cameo.phase === "waiting" ? `${cameo.queued} queued` : `${Math.round(cameo.ratio * 100)} percent`}` : ""}${busy || active ? ", right-click to cancel" : ""}`}
      aria-keyshortcuts={shortcut}
    >
      <span className="cameo-art">
        <SpritePreview kind={kind} palette={palette} />
        {busy ? (
          <span
            className={`cameo-progress cameo-progress-${cameo.phase}`}
            style={{ "--cameo-remain": `${Math.max(0, (1 - cameo.ratio) * 100)}%` } as React.CSSProperties}
            data-testid={`cameo-progress-${kind}`}
            data-phase={cameo.phase}
            data-queued={cameo.queued}
          />
        ) : null}
        {showCount ? <span className="cameo-count">{cameo.queued}</span> : null}
      </span>
      <span className="cameo-caption">
        <span>{labelFor(kind)}</span>
        <b>{cost}</b>
      </span>
    </button>
    </span>
  );
}

export function GameClient({
  seed,
  mission,
  resume,
}: {
  seed: number;
  mission: number;
  resume: boolean;
}) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const [state, setState] = useState<SimState>(() => initialMission(seed, mission, resume));
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
  const [activeTab, setActiveTab] = useState<"construction" | "production">("construction");
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [pauseView, setPauseView] = useState<"main" | "options" | "assets">("main");
  const pauseViewRef = useRef(pauseView);
  pauseViewRef.current = pauseView;
  const [pauseNotice, setPauseNotice] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const cmdQ = useRef<Command[]>([]);
  const minimapDragging = useRef(false);
  const panHold = useRef<PanDir | null>(null);
  const extrasRef = useRef<RenderExtras>({
    cursor: null,
    placeKind: null,
    repairMode: false,
  });
  const fxRef = useRef<FxBurst[]>([]);
  const fxSeq = useRef(1);
  const panAvailRef = useRef<PanAvailability>({ left: false, right: false, up: false, down: false });
  const [panAvail, setPanAvail] = useState<PanAvailability>(panAvailRef.current);
  const [hotPan, setHotPan] = useState<PanDir | null>(null);

  const applyEdgePan = useCallback((dir: PanDir | null) => {
    panHold.current = dir;
    setHotPan((prev) => (prev === dir ? prev : dir));
  }, []);

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
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const s = stateRef.current;
      if (!s) {
        raf = requestAnimationFrame(frame);
        return;
      }
      if (pausedRef.current) {
        acc = 0;
        last = now;
        redraw();
        raf = requestAnimationFrame(frame);
        return;
      }
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
      acc += now - last;
      last = now;
      while (acc >= TICK_MS && s.result === "playing" && !pausedRef.current) {
        const cmds = cmdQ.current.splice(0, cmdQ.current.length);
        const out = tick(s, cmds.length ? cmds : undefined);
        stateRef.current = out.state;
        if (out.state.tick % 48 === 0) writeSave(localStorageAdapter(), out.state);
        if (out.state.tick % 6 === 0) setState({ ...out.state, entities: [...out.state.entities] });
        if (out.events.some((e) => e.type === "won")) beep("win");
        if (out.events.some((e) => e.type === "lost")) beep("lose");
        if (out.events.some((e) => e.type === "destroyed")) {
          const spawned = burstsFromDestroyed(out.events, out.state, now, fxSeq.current);
          fxSeq.current = spawned.nextId;
          fxRef.current.push(...spawned.bursts);
        }
        acc -= TICK_MS;
      }
      if (stateRef.current && stateRef.current.result !== "playing") {
        writeSave(localStorageAdapter(), stateRef.current);
        setState({ ...stateRef.current, entities: [...stateRef.current.entities] });
      }
      redraw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
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

  const loadMission = useCallback(() => {
    const loaded = readSave(localStorageAdapter(), seed);
    if (!loaded) {
      setPauseNotice("No save found for this seed.");
      return;
    }
    stateRef.current = loaded;
    setState({ ...loaded, entities: [...loaded.entities] });
    selected.current.clear();
    setSelectedIds([]);
    setPauseNotice(`Loaded mission at tick ${loaded.tick}.`);
  }, [seed]);

  const viewMissionBriefing = useCallback(() => {
    writeSave(localStorageAdapter(), stateRef.current);
    router.push(`/briefing?seed=${formatSeed(stateRef.current.seed)}&mission=${stateRef.current.missionIndex}&return=game`);
  }, [router]);

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
  }, []);

  const togglePlace = useCallback((kind: BuildingKind) => {
    const next = place.current === kind ? null : kind;
    place.current = next;
    setPlaceKind(next);
    if (next) {
      repair.current = false;
      setRepairMode(false);
    }
  }, []);

  const toggleRepair = useCallback(() => {
    const next = !repair.current;
    repair.current = next;
    setRepairMode(next);
    if (next) {
      place.current = null;
      setPlaceKind(null);
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
        toolActive: !!(place.current || repair.current),
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
      else if (command.type === "cancelTool") {
        clearTools();
        beep("select");
      } else if (command.type === "save") saveMission();
      else if (command.type === "load") loadMission();
      else if (command.type === "briefing") viewMissionBriefing();
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
    router,
    saveMission,
    toggleRepair,
    toggleSound,
    viewMissionBriefing,
  ]);

  useEffect(() => () => setMuted(false), []);

  function canvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }

  function entityAt(s: SimState, tx: number, ty: number) {
    const unit = s.entities.find(
      (en) => en.hp > 0 && en.class === "unit" && Math.round(en.x) === tx && Math.round(en.y) === ty,
    );
    if (unit) return unit;
    return buildingAt(s, tx, ty);
  }

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const p = canvasPos(e);
    box.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = canvasPos(e);
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

  const onUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s) return;
    const p = canvasPos(e);
    const picked = pickTile(s, p.x, p.y, camRef.current);
    const t = picked ?? screenToTile(p.x, p.y, camRef.current);
    const tx = Math.round(t.x);
    const ty = Math.round(t.y);
    if (e.button === 2) {
      e.preventDefault();
      if (repair.current) {
        repair.current = false;
        setRepairMode(false);
        beep("select");
        return;
      }
      const ids = [...selected.current];
      const target = pickEntity(s, p.x, p.y, camRef.current) ?? entityAt(s, tx, ty);
      if (target && target.owner === 1) {
        cmdQ.current.push({ type: "attack", unitIds: ids, targetId: target.id });
      } else if (s.tiles[ty * s.width + tx] === 2) {
        cmdQ.current.push({ type: "harvest", unitIds: ids, x: tx, y: ty });
      } else {
        cmdQ.current.push({ type: "move", unitIds: ids, x: tx, y: ty });
      }
      beep("ack");
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
      const hit = pickEntity(s, p.x, p.y, camRef.current) ?? entityAt(s, tx, ty);
      if (hit && hit.owner === 0 && hit.class === "building") {
        cmdQ.current.push({ type: "repair", buildingId: hit.id });
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
        if (en.hp <= 0 || en.owner !== 0 || en.class !== "unit") continue;
        const elev = heightAt(s, Math.round(en.x), Math.round(en.y));
        const sp = tileToScreen(en.x, en.y, camRef.current, elev);
        if (sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) ids.push(en.id);
      }
      commitSelection(ids);
    } else {
      const hit = pickEntity(s, p.x, p.y, camRef.current) ?? entityAt(s, tx, ty);
      commitSelection(hit && hit.owner === 0 ? [hit.id] : []);
    }
    beep("select");
  };

  const s = state;
  const obj = objectiveProgress(s);
  const power = powerFor(s, 0);
  const selectedEnt = s.entities.find((e) => selectedIds.includes(e.id) && e.hp > 0);
  const pal = s.factions[0].palette;

  return (
    <div
      className="game-shell relative h-screen overflow-hidden bg-[var(--chrome-void)] text-[var(--chrome-body)]"
      style={
        {
          "--p": pal.primary,
          "--a": pal.accent,
        } as React.CSSProperties
      }
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={hostRef} className="game-battlefield relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={MIN_RENDER_WIDTH}
          height={MIN_RENDER_HEIGHT}
          className="pixel-canvas h-full w-full cursor-crosshair"
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          onMouseUp={onUp}
        />
        <ScrollArrow dir="left" available={panAvail.left} hot={hotPan === "left"} />
        <ScrollArrow dir="right" available={panAvail.right} hot={hotPan === "right"} />
        <ScrollArrow dir="up" available={panAvail.up} hot={hotPan === "up"} />
        <ScrollArrow dir="down" available={panAvail.down} hot={hotPan === "down"} />
        <div className="battlefield-status pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3 text-xs uppercase">
          <div>
            <div className="tracking-[0.3em] text-[var(--chrome-cyan)]" data-testid="seed">Seed {formatSeed(s.seed)}</div>
            <div className="mt-1 text-[var(--chrome-body)]">{s.missionName}</div>
          </div>
          <div className="max-w-[45%] text-right text-[var(--chrome-body)]" data-testid="objective">
            {obj.label}
          </div>
        </div>
        {s.result !== "playing" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75" data-testid="mission-result">
            <div className="metal-panel max-w-lg p-8 text-center">
              <p className="console-label">Theater status</p>
              <h2 className="mt-3 text-3xl font-black uppercase tracking-[0.16em] text-[var(--chrome-text)]">
                {s.result === "won" ? "Mission complete" : "Mission failed"}
              </h2>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {s.result === "won" && s.missionIndex < 7 ? (
                  <button type="button" className="console-button has-tooltip" data-tooltip="Advance to the next briefing" data-shortcut={SHORTCUT.resultPrimary} onClick={() => router.push(`/briefing?seed=${formatSeed(s.seed)}&mission=${s.missionIndex + 1}`)}>Next briefing</button>
                ) : null}
                {s.result === "won" && s.missionIndex >= 7 ? (
                  <button type="button" className="console-button has-tooltip" data-tooltip="Return to the main menu" data-shortcut={SHORTCUT.resultPrimary} onClick={() => router.push("/")}>Campaign victory</button>
                ) : null}
                {s.result === "lost" ? (
                  <button type="button" className="console-button has-tooltip" data-tooltip="Retry this mission" data-shortcut={SHORTCUT.resultPrimary} onClick={() => router.push(`/briefing?seed=${formatSeed(s.seed)}&mission=${s.missionIndex}`)}>Retry</button>
                ) : null}
                <button type="button" className="console-button console-button-muted has-tooltip" data-tooltip="Return to the main menu" data-shortcut={SHORTCUT.resultMenu} onClick={() => router.push("/")}>Menu</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="command-sidebar flex w-[17.5rem] shrink-0 flex-col overflow-y-auto px-2 py-2 pl-3.5 text-xs">
        <span className="sidebar-rail" aria-hidden />
        <button
          type="button"
          className="console-header has-tooltip w-full px-2 py-3 text-center text-inherit"
          data-tooltip="Open pause menu"
          data-shortcut={SHORTCUT.pause}
          onClick={openPauseMenu}
          aria-label="Open Genesis Command pause menu"
          aria-keyshortcuts="Escape"
        >
          <p className="text-sm font-black tracking-[0.22em] text-[var(--chrome-text)]">GENESIS COMMAND</p>
          <p className="mt-1 text-[10px] tracking-[0.2em] text-[var(--chrome-muted)]">{campaign.factions[0].name}</p>
        </button>

        <div className="has-tooltip mt-2" data-tooltip="Tactical radar. Click or drag to pan. H jumps to the yard." data-shortcut={SHORTCUT.home}>
        <div className="radar-frame p-1">
          <canvas
            ref={miniRef}
            width={224}
            height={160}
            className="pixel-canvas block h-40 w-full cursor-crosshair bg-black"
            aria-label="Tactical minimap. Click or drag to move the camera."
            onPointerDown={onMinimapPointerDown}
            onPointerMove={onMinimapPointerMove}
            onPointerUp={onMinimapPointerUp}
            onPointerCancel={onMinimapPointerUp}
          />
          <span className="radar-sweep" aria-hidden />
        </div>
        </div>

        <div className="resource-dock mt-2">
          <div className="has-tooltip" data-tooltip="Available credits">
            <CreditsCounter value={s.credits[0]} />
          </div>
          <div className={`power-chip has-tooltip ${power < 0 ? "text-[var(--chrome-alert)]" : ""}`} data-tooltip={power < 0 ? "Power deficit" : "Base power surplus"}>
            <span>Power</span>
            <strong className={power < 0 ? "text-[var(--chrome-alert)]" : "text-[var(--chrome-cyan)]"}>{power}</strong>
          </div>
        </div>

        <section className="console-section mt-2" data-testid="build-progress">
          <div className="cameo-tabs" role="toolbar" aria-label="Command options">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "construction"}
              aria-label="Construction"
              data-tooltip="Construction"
              data-shortcut={SHORTCUT.construction}
              aria-keyshortcuts="q"
              className={`icon-tab console-button has-tooltip ${activeTab === "construction" ? "" : "console-button-muted"}`}
              onClick={() => setActiveTab("construction")}
            >
              <CommandTabIcon type="construction" />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "production"}
              aria-label="Production"
              data-tooltip="Production"
              data-shortcut={SHORTCUT.production}
              aria-keyshortcuts="e"
              className={`icon-tab console-button has-tooltip ${activeTab === "production" ? "" : "console-button-muted"}`}
              onClick={() => setActiveTab("production")}
            >
              <CommandTabIcon type="production" />
            </button>
            <button
              type="button"
              aria-pressed={repairMode}
              aria-label="Repair structures"
              data-testid="repair-mode"
              data-tooltip="Repair structures. Click a damaged building to start or stop."
              data-shortcut={SHORTCUT.repair}
              aria-keyshortcuts="r"
              className={`icon-tab console-button has-tooltip ${repairMode ? "" : "console-button-muted"}`}
              onClick={toggleRepair}
            >
              <CommandTabIcon type="repair" />
            </button>
          </div>
          {activeTab === "construction" ? (
            <div className="cameo-grid">
              {PLACEABLE.map((kind, index) => {
                const cameo = buildingCameoStatus(s.entities, 0, kind);
                return (
                  <CommandCameo
                    key={kind}
                    kind={kind}
                    palette={pal}
                    cost={BUILDING_STATS[kind].cost}
                    disabled={cameo.phase === "idle" && s.credits[0] < BUILDING_STATS[kind].cost}
                    active={placeKind === kind}
                    cameo={cameo}
                    shortcut={SHORTCUT.cameo[index]}
                    onClick={() => togglePlace(kind)}
                    onContextMenu={() => cancelBuilding(kind)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="cameo-grid">
              {PRODUCIBLE.map((unit, index) => {
                const cameo = unitCameoStatus(s.entities, 0, unit);
                const producer = availableProducer(unit);
                const canBuy = s.credits[0] >= UNIT_STATS[unit].cost && !!producer && power >= 0;
                return (
                  <CommandCameo
                    key={unit}
                    kind={unit}
                    palette={pal}
                    cost={UNIT_STATS[unit].cost}
                    disabled={cameo.phase === "idle" && !canBuy}
                    cameo={cameo}
                    shortcut={SHORTCUT.cameo[index]}
                    onClick={() => queueUnit(unit)}
                    onContextMenu={() => cancelUnit(unit)}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="console-section mt-2 min-h-20 p-2">
          <p className="console-label">Selected</p>
          {selectedEnt ? (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="w-16 shrink-0 overflow-hidden border border-[var(--chrome-inset)] bg-[var(--chrome-void)]">
                  <SpritePreview kind={selectedEnt.kind as BuildingKind | UnitKind} palette={pal} />
                </div>
                <div>
                  <strong className="block uppercase text-[var(--chrome-text)] has-tooltip" data-testid="selected-kind" data-tooltip={labelFor(selectedEnt.kind as BuildingKind | UnitKind)} data-shortcut={SHORTCUT.center}>
                    {labelFor(selectedEnt.kind as BuildingKind | UnitKind)}
                  </strong>
                  <span className="text-[var(--chrome-muted)]">HP {Math.ceil(selectedEnt.hp)} / {selectedEnt.maxHp}</span>
                  {selectedEnt.kind === "harvester" ? (
                    <span className="mt-0.5 block text-[var(--chrome-muted)]">
                      Carry {selectedEnt.carry} / {UNIT_STATS.harvester.carryMax}
                    </span>
                  ) : null}
                </div>
              </div>
              {selectedEnt.constructing > 0 ? (
                <ProgressMeter
                  label="Constructing"
                  ratio={1 - selectedEnt.constructing / (BUILDING_STATS[selectedEnt.kind as BuildingKind].buildTicks || 1)}
                  detail={`${Math.ceil(selectedEnt.constructing / TICKS_PER_SECOND)}s`}
                />
              ) : null}
              {selectedEnt.producing ? (
                <ProgressMeter
                  label={`Produce ${labelFor(selectedEnt.producing.kind)}`}
                  ratio={1 - selectedEnt.producing.remaining / (UNIT_STATS[selectedEnt.producing.kind].buildTicks || 1)}
                  detail={
                    (selectedEnt.queue?.length ?? 0) > 0
                      ? `Q ${(selectedEnt.queue?.length ?? 0) + 1}/${MAX_PRODUCTION_QUEUE}`
                      : `${Math.ceil(selectedEnt.producing.remaining / TICKS_PER_SECOND)}s`
                  }
                />
              ) : null}
              {selectedEnt.repairing ? (
                <ProgressMeter
                  label="Repairing"
                  ratio={selectedEnt.maxHp > 0 ? selectedEnt.hp / selectedEnt.maxHp : 1}
                />
              ) : null}
            </div>
          ) : <p className="mt-2 text-[var(--chrome-muted)]">Awaiting selection</p>}
        </section>

      </aside>

      {paused ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4" data-testid="pause-menu">
          {pauseView === "assets" ? (
            <AssetsBrowser palette={pal} onClose={() => setPauseView("main")} />
          ) : (
          <div className="metal-panel w-full max-w-sm p-6" role="dialog" aria-modal="true" aria-labelledby="pause-title">
            {pauseView === "main" ? (
              <>
                <p className="console-label">Genesis Command</p>
                <h2 id="pause-title" className="mt-2 text-2xl font-black uppercase tracking-[0.12em] text-[var(--chrome-text)]">Game paused</h2>
                <div className="mt-6 grid gap-2">
                  <button type="button" className="console-button has-tooltip w-full text-left" data-tooltip="Return to the battlefield" data-shortcut={SHORTCUT.resume} onClick={resumeMission}>Resume Mission</button>
                  <button type="button" className="console-button has-tooltip w-full text-left" data-tooltip="Write the current mission to disk" data-shortcut={SHORTCUT.save} onClick={saveMission}>Save Mission</button>
                  <button type="button" className="console-button has-tooltip w-full text-left" data-tooltip="Restore the last save for this seed" data-shortcut={SHORTCUT.load} onClick={loadMission}>Load Mission</button>
                  <button type="button" className="console-button has-tooltip w-full text-left" data-tooltip="Open the mission briefing" data-shortcut={SHORTCUT.briefing} onClick={viewMissionBriefing}>Mission Briefing</button>
                  <button type="button" className="console-button has-tooltip w-full text-left" data-tooltip="Inspect generated sprites and animations" data-shortcut={SHORTCUT.assets} onClick={() => { setPauseView("assets"); setPauseNotice(""); }}>Assets</button>
                  <button type="button" className="console-button has-tooltip w-full text-left" data-tooltip="Audio and game options" data-shortcut={SHORTCUT.options} onClick={() => { setPauseView("options"); setPauseNotice(""); }}>Options</button>
                  <button type="button" className="console-button console-button-muted has-tooltip w-full text-left" data-tooltip="Leave the theater" data-shortcut={SHORTCUT.menu} onClick={() => router.push("/")}>Escape to Menu</button>
                </div>
              </>
            ) : (
              <>
                <p className="console-label">Options</p>
                <h2 id="pause-title" className="mt-2 text-2xl font-black uppercase tracking-[0.12em] text-[var(--chrome-text)]">Game options</h2>
                <div className="mt-6 grid gap-2">
                  <button type="button" className="console-button has-tooltip w-full text-left" data-tooltip="Toggle synthesized audio cues" data-shortcut={SHORTCUT.mute} onClick={toggleSound}>Audio feedback: {soundEnabled ? "On" : "Off"}</button>
                  <button type="button" className="console-button console-button-muted has-tooltip w-full text-left" data-tooltip="Return to the pause menu" data-shortcut={SHORTCUT.back} onClick={() => setPauseView("main")}>Back</button>
                </div>
              </>
            )}
            {pauseNotice ? <p className="mt-4 text-xs uppercase tracking-wide text-[var(--chrome-cyan)]" role="status">{pauseNotice}</p> : null}
            <p className="mt-4 text-[10px] uppercase tracking-wide text-[var(--chrome-muted)]">{pauseView === "main" ? "Escape resumes the mission" : "Escape returns to the pause menu"}</p>
          </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
