import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  cameraPanBounds,
  clampCamera,
  minimapPoint,
  MINIMAP_DRAG_THRESHOLD,
  panCameraByMinimapDelta,
  panAvailability,
  type PanAvailability,
  type PanDir,
} from "@/lib/render/camera";
import { createCamera, tileToScreen, TILE_H, type Camera } from "@/lib/render/iso";
import { heightAt } from "@/lib/sim/world";
import type { SimState } from "@/lib/types";

export const MIN_RENDER_WIDTH = 640;
export const MIN_RENDER_HEIGHT = 480;

export function renderDimensions(host: HTMLElement): { width: number; height: number } {
  return {
    width: Math.max(MIN_RENDER_WIDTH, Math.floor(host.clientWidth)),
    height: Math.max(MIN_RENDER_HEIGHT, Math.floor(host.clientHeight)),
  };
}

type MinimapDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPointerX: number;
  startPointerY: number;
  startCameraX: number;
  startCameraY: number;
  dragging: boolean;
};

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
  const minimapDrag = useRef<MinimapDragState | null>(null);
  const [isMinimapDragging, setIsMinimapDragging] = useState(false);

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

  const minimapPointFromEvent = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const mini = e.currentTarget;
    const r = mini.getBoundingClientRect();
    return minimapPoint(
      (e.clientX - r.left) * (mini.width / Math.max(1, r.width)),
      (e.clientY - r.top) * (mini.height / Math.max(1, r.height)),
      mini.width,
      mini.height,
      stateRef.current?.width ?? 1,
      stateRef.current?.height ?? 1,
    );
  }, [stateRef]);

  const focusFromMinimap = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!s || !canvas) return;
    const point = minimapPointFromEvent(e);
    const tx = Math.max(0, Math.min(s.width - 1, Math.floor(point.x)));
    const ty = Math.max(0, Math.min(s.height - 1, Math.floor(point.y)));
    const elev = heightAt(s, tx, ty);
    const anchor = tileToScreen(tx, ty, { x: 0, y: 0, zoom: camRef.current.zoom }, elev);
    camRef.current.x = canvas.width / 2 - anchor.x;
    camRef.current.y = canvas.height / 2 - anchor.y - (TILE_H * camRef.current.zoom) / 2;
    const bounds = cameraPanBounds(camRef.current, s.width, s.height, canvas.width, canvas.height);
    clampCamera(camRef.current, bounds);
  }, [canvasRef, camRef, minimapPointFromEvent, stateRef]);

  const onMinimapPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const point = minimapPointFromEvent(e);
    minimapDrag.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPointerX: point.x,
      startPointerY: point.y,
      startCameraX: camRef.current.x,
      startCameraY: camRef.current.y,
      dragging: false,
    };
    setIsMinimapDragging(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [camRef, minimapPointFromEvent]);

  const onMinimapPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = minimapDrag.current;
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !s || !canvas) return;
    if (!drag.dragging) {
      const distance = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
      if (distance < MINIMAP_DRAG_THRESHOLD) return;
      drag.dragging = true;
      setIsMinimapDragging(true);
    }
    const point = minimapPointFromEvent(e);
    const bounds = cameraPanBounds(camRef.current, s.width, s.height, canvas.width, canvas.height);
    camRef.current.x = drag.startCameraX;
    camRef.current.y = drag.startCameraY;
    panCameraByMinimapDelta(
      camRef.current,
      point.x - drag.startPointerX,
      point.y - drag.startPointerY,
      bounds,
    );
  }, [camRef, canvasRef, minimapPointFromEvent, stateRef]);

  const onMinimapPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = minimapDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.type !== "pointercancel" && !drag.dragging) focusFromMinimap(e);
    minimapDrag.current = null;
    setIsMinimapDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, [focusFromMinimap]);

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
    isMinimapDragging,
    onMinimapPointerDown,
    onMinimapPointerMove,
    onMinimapPointerUp,
  };
}

export type GameCamera = ReturnType<typeof useGameCamera>;
