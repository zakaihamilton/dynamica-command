import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  cameraPanBounds,
  clampCamera,
  panAvailability,
  type PanAvailability,
  type PanDir,
} from "@/lib/render/camera";
import { createCamera, tileToScreen, type Camera } from "@/lib/iso";
import { heightAt } from "@/lib/sim/world";
import type { SimState } from "@/lib/types";
import { useMinimapInteraction } from "./useMinimapInteraction";

export const MIN_RENDER_WIDTH = 640;
export const MIN_RENDER_HEIGHT = 480;

export function renderDimensions(host: HTMLElement): { width: number; height: number } {
  return {
    width: Math.max(MIN_RENDER_WIDTH, Math.floor(host.clientWidth)),
    height: Math.max(MIN_RENDER_HEIGHT, Math.floor(host.clientHeight)),
  };
}

export function useGameCamera({
  stateRef,
  canvasRef,
  hostRef,
}: {
  stateRef: RefObject<SimState | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
}) {
  const camRef = useRef<Camera>(createCamera());
  const panAvailRef = useRef<PanAvailability>({ left: false, right: false, up: false, down: false });
  const [panAvail, setPanAvail] = useState<PanAvailability>({ left: false, right: false, up: false, down: false });
  const [hotPan, setHotPan] = useState<PanDir | null>(null);
  const panHold = useRef<PanDir | null>(null);
  const edgePanHover = useRef<{ dir: PanDir; startedAt: number } | null>(null);
  const minimap = useMinimapInteraction({ stateRef, canvasRef, camRef });

  const applyEdgePan = useCallback((dir: PanDir | null) => {
    if (dir === null) {
      edgePanHover.current = null;
      panHold.current = null;
    } else if (edgePanHover.current?.dir !== dir) {
      edgePanHover.current = { dir, startedAt: performance.now() };
      panHold.current = null;
    }
    setHotPan((prev) => (prev === dir ? prev : dir));
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
  }, [canvasRef, stateRef]);

  const jumpHome = useCallback(() => {
    const cy = stateRef.current?.entities.find((e) => e.hp > 0 && e.owner === 0 && e.kind === "constructionYard");
    if (cy) focusTile(cy.x, cy.y, 1 / 3);
  }, [focusTile, stateRef]);

  const centerSelection = useCallback((selectedIds: Set<number>) => {
    const id = [...selectedIds][0];
    const ent = stateRef.current?.entities.find((e) => e.id === id && e.hp > 0);
    if (ent) focusTile(ent.x, ent.y);
  }, [focusTile, stateRef]);

  const resetCamera = useCallback((s: SimState) => {
    const cy = s.entities.find((e) => e.owner === 0 && e.kind === "constructionYard");
    const canvas = canvasRef.current;
    if (cy && canvas) {
      const elev = heightAt(s, cy.x, cy.y);
      const p = tileToScreen(cy.x, cy.y, { x: 0, y: 0, zoom: camRef.current.zoom }, elev);
      camRef.current.x = canvas.width / 2 - p.x;
      camRef.current.y = canvas.height / 3 - p.y;
      const bounds = cameraPanBounds(camRef.current, s.width, s.height, canvas.width, canvas.height);
      clampCamera(camRef.current, bounds);
      const avail = panAvailability(camRef.current, bounds);
      panAvailRef.current = avail;
      setPanAvail(avail);
    }
  }, [canvasRef]);

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
    if (s) resetCamera(s);
    return () => observer.disconnect();
  }, [canvasRef, hostRef, resetCamera, stateRef]);

  return {
    camRef,
    panAvail,
    panAvailRef,
    hotPan,
    panHold,
    edgePanHover,
    applyEdgePan,
    focusTile,
    jumpHome,
    centerSelection,
    resetCamera,
    ...minimap,
  };
}

export type GameCamera = ReturnType<typeof useGameCamera>;
