import { useCallback, useLayoutEffect, useRef, type MutableRefObject, type PointerEvent } from "react";
import { pickTile } from "@/lib/render/renderer";
import type { CommandMarker } from "@/lib/render/renderOverlays";
import { panDirFromPointer, EDGE_PAN_BAND, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { type Camera } from "@/lib/iso";
import type { BuildingKind, Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../mobileCommandTypes";
import { canvasPointerPos } from "./canvasPointer";
import { entityAt, pickSelectableEntity, pointerTile } from "./gameInputOrders";
import { battlefieldCursor } from "@/lib/ui/battlefieldCursor";
import { resolvePointerUp, isSameKindDoubleClick, type LastUnitClick } from "./gamePointerUp";
import { selectionBoxDistance, selectionProjectionPoint, type SelectionBox } from "./selectionBox";
import { useTouchGestures } from "./useTouchGestures";
import { useOrderDispatch } from "./useOrderDispatch";
import { usePointerUpHandler } from "./usePointerUpHandler";

export function useGameInput({
  stateRef,
  camRef,
  selectedRef,
  selectedIds,
  commitSelection,
  cmdQRef,
  placeRef,
  placeKind,
  setPlaceKind,
  repairRef,
  repairMode,
  setRepairMode,
  sellRef,
  sellMode,
  setSellMode,
  clearTools,
  mobileCommandRef,
  setMobileCommandState,
  pausedRef,
  panAvailRef,
  applyEdgePan,
  selectionModeRef,
  setSelectionMode,
}: {
  stateRef: MutableRefObject<SimState>;
  camRef: MutableRefObject<Camera>;
  selectedRef: MutableRefObject<Set<number>>;
  selectedIds?: readonly number[];
  commitSelection: (ids: number[]) => void;
  cmdQRef: MutableRefObject<Command[]>;
  placeRef: MutableRefObject<BuildingKind | null>;
  placeKind?: BuildingKind | null;
  setPlaceKind: (v: BuildingKind | null) => void;
  repairRef: MutableRefObject<boolean>;
  repairMode?: boolean;
  setRepairMode: (v: boolean) => void;
  sellRef: MutableRefObject<boolean>;
  sellMode?: boolean;
  setSellMode: (v: boolean) => void;
  clearTools: () => void;
  mobileCommandRef: MutableRefObject<MobileCommand | null>;
  setMobileCommandState: (v: MobileCommand | null) => void;
  pausedRef: MutableRefObject<boolean>;
  panAvailRef: MutableRefObject<PanAvailability>;
  applyEdgePan: (dir: PanDir | null) => void;
  selectionModeRef: MutableRefObject<boolean>;
  setSelectionMode: (active: boolean) => void;
}) {
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const boxRef = useRef<SelectionBox | null>(null);
  const commandMarkerRef = useRef<CommandMarker | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const lastUnitClickRef = useRef<LastUnitClick | null>(null);

  const syncCursor = useCallback((canvas?: HTMLCanvasElement | null) => {
    if (canvas) canvasElRef.current = canvas;
    const target = canvasElRef.current;
    if (!target?.style) return;
    const s = stateRef.current;
    if (!s) {
      target.style.cursor = "";
      return;
    }
    const tile = hoverRef.current;
    target.style.cursor = battlefieldCursor({
      state: s,
      hoverTile: tile,
      hoverEntity: tile ? entityAt(s, tile.x, tile.y) : undefined,
      selectedIds: [...selectedRef.current],
      placeKind: placeRef.current,
      repairMode: repairRef.current,
      sellMode: sellRef.current,
    });
  }, [placeRef, repairRef, selectedRef, sellRef, stateRef]);

  useLayoutEffect(() => {
    syncCursor();
  }, [placeKind, repairMode, sellMode, selectedIds, syncCursor]);

  const { markUnitCommand, issueContextOrder } = useOrderDispatch({
    camRef,
    selectedRef,
    cmdQRef,
    repairRef,
    sellRef,
    clearTools,
    mobileCommandRef,
    setMobileCommandState,
    commandMarkerRef,
    syncCursor,
  });

  const { beginTouch, moveTouch, endTouch, cancelTouch } = useTouchGestures({
    camRef,
    stateRef,
    selectionModeRef,
    boxRef,
    issueContextOrder,
  });

  const { applyPointerUp } = usePointerUpHandler({
    stateRef,
    cmdQRef,
    boxRef,
    commitSelection,
    setSelectionMode,
    mobileCommandRef,
    setMobileCommandState,
    placeRef,
    setPlaceKind,
    repairRef,
    setRepairMode,
    sellRef,
    setSellMode,
    markUnitCommand,
    syncCursor,
  });

  const onDown = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    canvasElRef.current = e.currentTarget;
    const p = canvasPointerPos(e);
    if (e.pointerType === "touch") {
      beginTouch(e, p);
      return;
    }
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events used by accessibility and browser tests may not support capture.
    }
    boxRef.current = {
      x0: p.x,
      y0: p.y,
      x1: p.x,
      y1: p.y,
      anchor: selectionProjectionPoint(p, camRef.current),
    };
  }, [beginTouch, camRef]);

  const hoverAtPointer = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPointerPos(e);
    const s = stateRef.current;
    cursorRef.current = p;
    if (s) hoverRef.current = pickTile(s, p.x, p.y, camRef.current);
    syncCursor(e.currentTarget);
    return p;
  }, [camRef, stateRef, syncCursor]);

  const onEnter = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    canvasElRef.current = e.currentTarget;
    hoverAtPointer(e);
  }, [hoverAtPointer]);

  const onMove = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    if (e.type === "pointerenter") {
      hoverAtPointer(e);
      return;
    }
    const p = canvasPointerPos(e);
    const s = stateRef.current;
    if (e.pointerType === "touch" && moveTouch(e, p)) return;
    cursorRef.current = p;
    if (s) hoverRef.current = pickTile(s, p.x, p.y, camRef.current);
    syncCursor(e.currentTarget);
    if (e.pointerType !== "touch" && boxRef.current && e.buttons === 1) {
      boxRef.current.x1 = p.x;
      boxRef.current.y1 = p.y;
    }
    const r = e.currentTarget.getBoundingClientRect();
    applyEdgePan(
      e.pointerType === "touch" || pausedRef.current
        ? null
        : panDirFromPointer(e.clientX - r.left, e.clientY - r.top, r.width, r.height, EDGE_PAN_BAND, panAvailRef.current),
    );
  }, [applyEdgePan, camRef, hoverAtPointer, moveTouch, panAvailRef, pausedRef, stateRef, syncCursor]);

  const onLeave = useCallback((e?: PointerEvent<HTMLCanvasElement>) => {
    cursorRef.current = null;
    hoverRef.current = null;
    if (e?.currentTarget.style) e.currentTarget.style.cursor = "";
    applyEdgePan(null);
  }, [applyEdgePan]);

  const onUp = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    applyEdgePan(null);
    if (e.pointerType !== "touch") {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Synthetic pointer events used by accessibility and browser tests may not support capture.
      }
    }
    const s = stateRef.current;
    if (!s) return;
    if (e.pointerType === "touch" && endTouch(e)) return;
    const p = canvasPointerPos(e);
    const cam = camRef.current;
    const drag = Boolean(boxRef.current && selectionBoxDistance(boxRef.current, cam) > 8);
    const nowMs = performance.now();
    const { x: tx, y: ty } = pointerTile(s, p, cam);
    const hoverHit = !drag && (e.button === 0 || e.pointerType === "touch")
      ? pickSelectableEntity(s, p.x, p.y, tx, ty, cam)
      : undefined;
    const doubleClick = Boolean(
      hoverHit &&
        hoverHit.class === "unit" &&
        isSameKindDoubleClick(lastUnitClickRef.current, {
          atMs: nowMs,
          kind: hoverHit.kind,
          x: p.x,
          y: p.y,
        }),
    );
    const effect = resolvePointerUp({
      pointerType: e.pointerType,
      button: e.button,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      p,
      state: s,
      cam,
      selectedIds: [...selectedRef.current],
      box: boxRef.current,
      selectionMode: selectionModeRef.current,
      mobileCommand: mobileCommandRef.current,
      placeKind: placeRef.current,
      repairMode: repairRef.current,
      sellMode: sellRef.current,
      doubleClick,
      viewport: { width: e.currentTarget.width, height: e.currentTarget.height },
    });
    const rememberUnitClick = () => {
      if (
        !drag &&
        hoverHit &&
        hoverHit.class === "unit" &&
        effect.select?.includes(hoverHit.id)
      ) {
        lastUnitClickRef.current = { atMs: nowMs, kind: hoverHit.kind, x: p.x, y: p.y };
      } else {
        lastUnitClickRef.current = null;
      }
    };
    if (effect.contextOrder) {
      lastUnitClickRef.current = null;
      if (effect.preventDefault) e.preventDefault();
      issueContextOrder(s, p, effect.attackMove);
      return;
    }
    applyPointerUp(effect, e);
    rememberUnitClick();
  }, [applyEdgePan, applyPointerUp, camRef, endTouch, issueContextOrder, mobileCommandRef, placeRef, repairRef, selectedRef, selectionModeRef, sellRef, stateRef]);

  const onCancel = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events used by accessibility and browser tests may not support capture.
    }
    cancelTouch();
    boxRef.current = null;
    hoverRef.current = null;
    cursorRef.current = null;
    commandMarkerRef.current = null;
    lastUnitClickRef.current = null;
    mobileCommandRef.current = null;
    setMobileCommandState(null);
    clearTools();
    setSelectionMode(false);
    applyEdgePan(null);
    if (e.currentTarget.style) e.currentTarget.style.cursor = "";
  }, [applyEdgePan, cancelTouch, clearTools, mobileCommandRef, setMobileCommandState, setSelectionMode]);

  const resetInput = useCallback(() => {
    cancelTouch();
    hoverRef.current = null;
    cursorRef.current = null;
    boxRef.current = null;
    commandMarkerRef.current = null;
    lastUnitClickRef.current = null;
  }, [cancelTouch]);

  return {
    hoverRef,
    cursorRef,
    boxRef,
    commandMarkerRef,
    resetInput,
    onDown,
    onEnter,
    onMove,
    onLeave,
    onUp,
    onCancel,
  };
}
