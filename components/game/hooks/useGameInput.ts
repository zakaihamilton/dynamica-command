import { useCallback, useRef, type MutableRefObject, type PointerEvent } from "react";
import { beep } from "@/lib/audio/synth";
import { pickTile } from "@/lib/render/renderer";
import { panDirFromPointer, EDGE_PAN_BAND, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { type Camera } from "@/lib/iso";
import type { BuildingKind, Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../mobileCommandTypes";
import { canvasPointerPos } from "./canvasPointer";
import { contextOrders, pickSelectableEntity, pointerTile } from "./gameInputOrders";
import { resolvePointerUp, type PointerUpEffect } from "./gamePointerUp";
import { useTouchGestures } from "./useTouchGestures";

export function useGameInput({
  stateRef,
  camRef,
  selectedRef,
  commitSelection,
  cmdQRef,
  placeRef,
  setPlaceKind,
  repairRef,
  setRepairMode,
  sellRef,
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
  commitSelection: (ids: number[]) => void;
  cmdQRef: MutableRefObject<Command[]>;
  placeRef: MutableRefObject<BuildingKind | null>;
  setPlaceKind: (v: BuildingKind | null) => void;
  repairRef: MutableRefObject<boolean>;
  setRepairMode: (v: boolean) => void;
  sellRef: MutableRefObject<boolean>;
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
  const boxRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const issueContextOrder = useCallback((s: SimState, p: { x: number; y: number }, attackMove = false) => {
    const { x: tx, y: ty } = pointerTile(s, p, camRef.current);
    if (repairRef.current || sellRef.current) {
      clearTools();
      beep("select");
      return;
    }
    const ids = [...selectedRef.current];
    const target = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
    cmdQRef.current.push(...contextOrders(s, ids, target, tx, ty, attackMove));
    mobileCommandRef.current = null;
    setMobileCommandState(null);
    beep("ack");
  }, [camRef, clearTools, cmdQRef, mobileCommandRef, repairRef, selectedRef, sellRef, setMobileCommandState]);

  const touch = useTouchGestures({
    camRef,
    stateRef,
    selectionModeRef,
    boxRef,
    issueContextOrder,
  });

  const applyPointerUp = useCallback((effect: PointerUpEffect, event: PointerEvent<HTMLCanvasElement>) => {
    if (effect.preventDefault) event.preventDefault();
    if (effect.clearBox) boxRef.current = null;
    if (effect.commands?.length) cmdQRef.current.push(...effect.commands);
    if (effect.select) commitSelection(effect.select);
    if (effect.endSelectionMode) setSelectionMode(false);
    if (effect.clearMobileCommand) {
      mobileCommandRef.current = null;
      setMobileCommandState(null);
    }
    if (effect.clearPlace) {
      placeRef.current = null;
      setPlaceKind(null);
    }
    if (effect.clearRepairAndSell) {
      repairRef.current = false;
      setRepairMode(false);
      sellRef.current = false;
      setSellMode(false);
    }
    if (effect.beep) beep(effect.beep);
  }, [cmdQRef, commitSelection, mobileCommandRef, placeRef, repairRef, sellRef, setMobileCommandState, setPlaceKind, setRepairMode, setSelectionMode, setSellMode]);

  const onDown = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPointerPos(e);
    if (e.pointerType === "touch") {
      touch.beginTouch(e, p);
      return;
    }
    if (e.button !== 0) return;
    boxRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  }, [touch]);

  const onMove = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPointerPos(e);
    const s = stateRef.current;
    if (e.pointerType === "touch" && touch.moveTouch(e, p)) return;
    cursorRef.current = p;
    if (s) hoverRef.current = pickTile(s, p.x, p.y, camRef.current);
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
  }, [applyEdgePan, camRef, panAvailRef, pausedRef, stateRef, touch]);

  const onLeave = useCallback(() => {
    cursorRef.current = null;
    hoverRef.current = null;
    applyEdgePan(null);
  }, [applyEdgePan]);

  const onUp = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s) return;
    if (e.pointerType === "touch" && touch.endTouch(e)) return;
    applyPointerUp(resolvePointerUp({
      pointerType: e.pointerType,
      button: e.button,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      p: canvasPointerPos(e),
      state: s,
      cam: camRef.current,
      selectedIds: [...selectedRef.current],
      box: boxRef.current,
      selectionMode: selectionModeRef.current,
      mobileCommand: mobileCommandRef.current,
      placeKind: placeRef.current,
      repairMode: repairRef.current,
      sellMode: sellRef.current,
    }), e);
  }, [applyPointerUp, camRef, mobileCommandRef, placeRef, repairRef, selectedRef, selectionModeRef, sellRef, stateRef, touch]);

  const onCancel = useCallback(() => {
    touch.cancelTouch();
    boxRef.current = null;
    mobileCommandRef.current = null;
    setMobileCommandState(null);
    setSelectionMode(false);
    applyEdgePan(null);
  }, [applyEdgePan, mobileCommandRef, setMobileCommandState, setSelectionMode, touch]);

  const resetInput = useCallback(() => {
    hoverRef.current = null;
    cursorRef.current = null;
    boxRef.current = null;
  }, []);

  return {
    hoverRef,
    cursorRef,
    boxRef,
    resetInput,
    onDown,
    onMove,
    onLeave,
    onUp,
    onCancel,
  };
}
