import { useCallback, useRef, type MutableRefObject, type PointerEvent } from "react";
import { beep } from "@/lib/audio/synth";
import { beepForCommands } from "@/lib/audio/uiOrders";
import { pickTile } from "@/lib/render/renderer";
import type { CommandMarker } from "@/lib/render/renderOverlays/types";
import { panDirFromPointer, EDGE_PAN_BAND, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { type Camera } from "@/lib/iso";
import type { BuildingKind, Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../mobileCommandTypes";
import { canvasPointerPos } from "./canvasPointer";
import { contextOrders, pickSelectableEntity, pointerTile } from "./gameInputOrders";
import { resolvePointerUp, type PointerUpEffect } from "./gamePointerUp";
import { selectionProjectionPoint, type SelectionBox } from "./selectionBox";
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
  const boxRef = useRef<SelectionBox | null>(null);
  const commandMarkerRef = useRef<CommandMarker | null>(null);

  const markUnitCommand = useCallback((s: SimState, p: { x: number; y: number }, commands: Command[]) => {
    if (!commands.some((command) => command.type === "move" || command.type === "attackMove" || command.type === "attack" || command.type === "support" || command.type === "harvest")) return;
    const { x, y } = pointerTile(s, p, camRef.current);
    commandMarkerRef.current = { x, y, bornMs: performance.now() };
  }, [camRef]);

  const issueContextOrder = useCallback((s: SimState, p: { x: number; y: number }, attackMove = false) => {
    const { x: tx, y: ty } = pointerTile(s, p, camRef.current);
    if (repairRef.current || sellRef.current) {
      clearTools();
      beep("cancel");
      return;
    }
    const ids = [...selectedRef.current];
    const target = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
    const commands = contextOrders(s, ids, target, tx, ty, attackMove);
    cmdQRef.current.push(...commands);
    markUnitCommand(s, p, commands);
    mobileCommandRef.current = null;
    setMobileCommandState(null);
    const kind = beepForCommands(commands);
    if (kind) beep(kind);
  }, [camRef, clearTools, cmdQRef, markUnitCommand, mobileCommandRef, repairRef, selectedRef, sellRef, setMobileCommandState]);

  const { beginTouch, moveTouch, endTouch, cancelTouch } = useTouchGestures({
    camRef,
    stateRef,
    selectionModeRef,
    boxRef,
    issueContextOrder,
  });

  const applyPointerUp = useCallback((effect: PointerUpEffect, event: PointerEvent<HTMLCanvasElement>) => {
    if (effect.preventDefault) event.preventDefault();
    if (effect.clearBox) boxRef.current = null;
    if (effect.commands?.length) {
      cmdQRef.current.push(...effect.commands);
      markUnitCommand(stateRef.current, canvasPointerPos(event), effect.commands);
    }
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
  }, [cmdQRef, commitSelection, markUnitCommand, mobileCommandRef, placeRef, repairRef, sellRef, setMobileCommandState, setPlaceKind, setRepairMode, setSelectionMode, setSellMode, stateRef]);

  const onDown = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
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

  const onMove = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPointerPos(e);
    const s = stateRef.current;
    if (e.pointerType === "touch" && moveTouch(e, p)) return;
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
  }, [applyEdgePan, camRef, moveTouch, panAvailRef, pausedRef, stateRef]);

  const onLeave = useCallback(() => {
    cursorRef.current = null;
    hoverRef.current = null;
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
    const effect = resolvePointerUp({
      pointerType: e.pointerType,
      button: e.button,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      p,
      state: s,
      cam: camRef.current,
      selectedIds: [...selectedRef.current],
      box: boxRef.current,
      selectionMode: selectionModeRef.current,
      mobileCommand: mobileCommandRef.current,
      placeKind: placeRef.current,
      repairMode: repairRef.current,
      sellMode: sellRef.current,
    });
    if (effect.contextOrder) {
      if (effect.preventDefault) e.preventDefault();
      issueContextOrder(s, p, effect.attackMove);
      return;
    }
    applyPointerUp(effect, e);
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
    mobileCommandRef.current = null;
    setMobileCommandState(null);
    clearTools();
    setSelectionMode(false);
    applyEdgePan(null);
  }, [applyEdgePan, cancelTouch, clearTools, mobileCommandRef, setMobileCommandState, setSelectionMode]);

  const resetInput = useCallback(() => {
    cancelTouch();
    hoverRef.current = null;
    cursorRef.current = null;
    boxRef.current = null;
    commandMarkerRef.current = null;
  }, [cancelTouch]);

  return {
    hoverRef,
    cursorRef,
    boxRef,
    commandMarkerRef,
    resetInput,
    onDown,
    onMove,
    onLeave,
    onUp,
    onCancel,
  };
}
