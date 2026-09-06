import { useCallback, type MutableRefObject, type PointerEvent } from "react";
import { beep } from "@/lib/audio/synth";
import type { BuildingKind, Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../mobileCommandTypes";
import { canvasPointerPos } from "./canvasPointer";
import type { SelectionBox } from "./selectionBox";
import type { PointerUpEffect } from "./gamePointerUp";

export function usePointerUpHandler({
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
}: {
  stateRef: MutableRefObject<SimState>;
  cmdQRef: MutableRefObject<Command[]>;
  boxRef: MutableRefObject<SelectionBox | null>;
  commitSelection: (ids: number[]) => void;
  setSelectionMode: (active: boolean) => void;
  mobileCommandRef: MutableRefObject<MobileCommand | null>;
  setMobileCommandState: (v: MobileCommand | null) => void;
  placeRef: MutableRefObject<BuildingKind | null>;
  setPlaceKind: (v: BuildingKind | null) => void;
  repairRef: MutableRefObject<boolean>;
  setRepairMode: (v: boolean) => void;
  sellRef: MutableRefObject<boolean>;
  setSellMode: (v: boolean) => void;
  markUnitCommand: (s: SimState, p: { x: number; y: number }, commands: Command[]) => void;
  syncCursor: (canvas?: HTMLCanvasElement | null) => void;
}) {
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
    syncCursor(event.currentTarget);
  }, [
    boxRef,
    cmdQRef,
    commitSelection,
    markUnitCommand,
    mobileCommandRef,
    placeRef,
    repairRef,
    sellRef,
    setMobileCommandState,
    setPlaceKind,
    setRepairMode,
    setSelectionMode,
    setSellMode,
    stateRef,
    syncCursor,
  ]);

  return { applyPointerUp };
}
