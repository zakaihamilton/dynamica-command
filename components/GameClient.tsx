"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BUILDING_STATS, UNIT_STATS, producerFor } from "@/lib/catalog";
import { beep } from "@/lib/audio/synth";
import { TICK_MS } from "@/lib/game/loop";
import { createCampaign } from "@/lib/gen/campaign";
import { localStorageAdapter, readSave, writeSave } from "@/lib/persist/save";
import { panCamera, zoomAt } from "@/lib/render/camera";
import { createCamera, screenToTile, tileToScreen } from "@/lib/render/iso";
import { renderMinimap } from "@/lib/render/minimap";
import { renderWorld } from "@/lib/render/renderer";
import { formatSeed } from "@/lib/seed/rng";
import { createMission, tick } from "@/lib/sim/api";
import { objectiveProgress } from "@/lib/sim/objectives";
import { powerFor } from "@/lib/sim/world";
import type { BuildingKind, Command, SimState, UnitKind } from "@/lib/types";

const PLACEABLE: BuildingKind[] = ["power", "refinery", "barracks", "factory", "turret"];

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
  const [state, setState] = useState<SimState | null>(null);
  const stateRef = useRef<SimState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef(createCamera());
  const selected = useRef(new Set<number>());
  const [, bump] = useState(0);
  const keys = useRef<Record<string, boolean>>({});
  const hover = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const place = useRef<BuildingKind | null>(null);
  const cmdQ = useRef<Command[]>([]);

  useEffect(() => {
    let s: SimState | null = null;
    if (resume) s = readSave(localStorageAdapter(), seed);
    if (!s) s = createMission({ seed, missionIndex: mission });
    stateRef.current = s;
    setState(s);
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const cy = s.entities.find((e) => e.owner === 0 && e.kind === "constructionYard");
    if (cy) {
      const p = tileToScreen(cy.x, cy.y, { x: 0, y: 0, zoom: 1 });
      camRef.current.x = window.innerWidth / 2 - p.x;
      camRef.current.y = window.innerHeight / 3 - p.y;
    }
    return () => window.removeEventListener("resize", resize);
  }, [seed, mission, resume]);

  const redraw = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!s || !canvas) return;
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderWorld(ctx, s, camRef.current, selected.current, hover.current);
    const mini = miniRef.current;
    if (mini) {
      const mctx = mini.getContext("2d");
      if (mctx) {
        const tl = screenToTile(0, 0, camRef.current);
        const br = screenToTile(canvas.width, canvas.height, camRef.current);
        renderMinimap(mctx, s, {
          x0: Math.min(tl.x, br.x),
          y0: Math.min(tl.y, br.y),
          x1: Math.max(tl.x, br.x),
          y1: Math.max(tl.y, br.y),
        });
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
      const cam = camRef.current;
      if (keys.current.w || keys.current.ArrowUp) panCamera(cam, 0, 10);
      if (keys.current.s || keys.current.ArrowDown) panCamera(cam, 0, -10);
      if (keys.current.a || keys.current.ArrowLeft) panCamera(cam, 10, 0);
      if (keys.current.d || keys.current.ArrowRight) panCamera(cam, -10, 0);
      acc += now - last;
      last = now;
      while (acc >= TICK_MS && s.result === "playing") {
        const cmds = cmdQ.current.splice(0, cmdQ.current.length);
        const out = tick(s, cmds.length ? cmds : undefined);
        stateRef.current = out.state;
        if (out.state.tick % 48 === 0) writeSave(localStorageAdapter(), out.state);
        if (out.events.some((e) => e.type === "won")) beep("win");
        if (out.events.some((e) => e.type === "lost")) beep("lose");
        acc -= TICK_MS;
      }
      if (stateRef.current && stateRef.current.result !== "playing") {
        writeSave(localStorageAdapter(), stateRef.current);
        setState({ ...stateRef.current });
      }
      redraw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [redraw]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key] = true;
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
  }, []);

  function canvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }

  function entityAt(s: SimState, tx: number, ty: number) {
    return s.entities.find(
      (en) => en.hp > 0 && Math.round(en.x) === tx && Math.round(en.y) === ty,
    );
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = canvasPos(e);
    zoomAt(camRef.current, p.x, p.y, e.deltaY);
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const p = canvasPos(e);
    box.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = canvasPos(e);
    const t = screenToTile(p.x, p.y, camRef.current);
    hover.current = { x: Math.round(t.x), y: Math.round(t.y) };
    if (box.current && e.buttons === 1) {
      box.current.x1 = p.x;
      box.current.y1 = p.y;
    }
  };

  const onUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s) return;
    const p = canvasPos(e);
    const t = screenToTile(p.x, p.y, camRef.current);
    const tx = Math.round(t.x);
    const ty = Math.round(t.y);
    if (e.button === 2) {
      e.preventDefault();
      const ids = [...selected.current];
      const target = entityAt(s, tx, ty);
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
      cmdQ.current.push({ type: "build", building: place.current, x: tx, y: ty });
      beep("build");
      place.current = null;
      bump((n) => n + 1);
      return;
    }
    const b = box.current;
    box.current = null;
    const drag = b && Math.hypot(b.x1 - b.x0, b.y1 - b.y0) > 8;
    if (drag && b) {
      selected.current.clear();
      const x0 = Math.min(b.x0, b.x1);
      const y0 = Math.min(b.y0, b.y1);
      const x1 = Math.max(b.x0, b.x1);
      const y1 = Math.max(b.y0, b.y1);
      for (const en of s.entities) {
        if (en.hp <= 0 || en.owner !== 0 || en.class !== "unit") continue;
        const sp = tileToScreen(en.x, en.y, camRef.current);
        if (sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) selected.current.add(en.id);
      }
    } else {
      const hit = entityAt(s, tx, ty);
      selected.current.clear();
      if (hit && hit.owner === 0) selected.current.add(hit.id);
    }
    beep("select");
    bump((n) => n + 1);
  };

  const s = stateRef.current ?? state;
  if (!s) return <div className="min-h-screen bg-[#0b0d10] text-[#e8e0d0]">Loading theater…</div>;
  const obj = objectiveProgress(s);
  const power = powerFor(s, 0);
  const selectedEnt = s.entities.find((e) => selected.current.has(e.id));
  const pal = s.factions[0].palette;

  return (
    <div
      className="relative h-screen overflow-hidden bg-[#0b0d10] text-[#e8e0d0]"
      style={
        {
          "--p": pal.primary,
          "--a": pal.accent,
        } as React.CSSProperties
      }
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="h-full w-full cursor-crosshair"
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/70 to-transparent p-3 text-sm">
        <div>
          <div className="font-mono tracking-[0.25em] text-[#c4b37a]" data-testid="seed">
            SEED {formatSeed(s.seed)}
          </div>
          <div>
            {s.missionName} · {campaign.factions[0].name}
          </div>
        </div>
        <div className="text-right">
          <div data-testid="credits">Credits {s.credits[0]}</div>
          <div>Power {power}</div>
        </div>
        <div className="max-w-sm text-right" data-testid="objective">
          {obj.label}
        </div>
      </div>
      <div className="absolute bottom-3 left-3 flex gap-3">
        <canvas ref={miniRef} width={180} height={180} className="border border-[#3d4a38] bg-black/60" />
        <div className="pointer-events-auto w-56 border border-[#3d4a38] bg-[#14180f]/90 p-3 text-xs">
          <p className="mb-2 font-mono tracking-widest text-[#8f9a6a]">BUILD</p>
          <div className="grid grid-cols-2 gap-1">
            {PLACEABLE.map((k) => (
              <button
                key={k}
                type="button"
                className={`rounded border px-2 py-1 text-left ${place.current === k ? "border-[#c4b37a]" : "border-[#2a3324]"}`}
                onClick={() => {
                  place.current = k;
                  bump((n) => n + 1);
                }}
              >
                {k} · {BUILDING_STATS[k].cost}
              </button>
            ))}
          </div>
          {selectedEnt?.class === "building" &&
          (selectedEnt.kind === "barracks" || selectedEnt.kind === "factory") ? (
            <div className="mt-3">
              <p className="mb-1 font-mono text-[#8f9a6a]">PRODUCE</p>
              {(["infantry", "antiArmor", "harvester", "tank"] as UnitKind[])
                .filter((u) => producerFor(u) === selectedEnt.kind)
                .map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="mr-1 mt-1 rounded border border-[#2a3324] px-2 py-1"
                    onClick={() => {
                      cmdQ.current.push({ type: "produce", fromId: selectedEnt.id, unit: u });
                      beep("build");
                    }}
                  >
                    {u} · {UNIT_STATS[u].cost}
                  </button>
                ))}
            </div>
          ) : null}
          <p className="mt-3 text-[#6d7260]">LMB select · RMB move/attack · wheel zoom · WASD pan</p>
        </div>
      </div>
      {s.result !== "playing" ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/70"
          data-testid="mission-result"
        >
          <div className="border border-[#c4b37a] bg-[#14180f] p-8 text-center">
            <h2 className="font-serif text-3xl text-[#f3e6c4]">
              {s.result === "won" ? "Mission complete" : "Mission failed"}
            </h2>
            <div className="mt-6 flex justify-center gap-3">
              {s.result === "won" && s.missionIndex < 7 ? (
                <button
                  type="button"
                  className="rounded border border-[#c4b37a] px-4 py-2"
                  onClick={() =>
                    router.push(`/briefing?seed=${formatSeed(s.seed)}&mission=${s.missionIndex + 1}`)
                  }
                >
                  Next briefing
                </button>
              ) : null}
              {s.result === "won" && s.missionIndex >= 7 ? (
                <button
                  type="button"
                  className="rounded border border-[#c4b37a] px-4 py-2"
                  onClick={() => router.push("/")}
                >
                  Campaign victory
                </button>
              ) : null}
              {s.result === "lost" ? (
                <button
                  type="button"
                  className="rounded border border-[#c4b37a] px-4 py-2"
                  onClick={() =>
                    router.push(`/briefing?seed=${formatSeed(s.seed)}&mission=${s.missionIndex}`)
                  }
                >
                  Retry
                </button>
              ) : null}
              <button type="button" className="rounded border border-[#3d4a38] px-4 py-2" onClick={() => router.push("/")}>
                Menu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
