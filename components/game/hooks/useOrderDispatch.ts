import { useCallback, type MutableRefObject } from "react";
import { beep } from "@/lib/audio/synth";
import { beepForCommands } from "@/lib/audio/uiOrders";
import { commandMarkerKind, type CommandMarker } from "@/lib/render/renderOverlays";
import type { Camera } from "@/lib/iso";
import type { Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../mobileCommandTypes";
import { contextOrders, pickSelectableEntity, pointerTile } from "./gameInputOrders";

export function useOrderDispatch({
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
}: {
  camRef: MutableRefObject<Camera>;
  selectedRef: MutableRefObject<Set<number>>;
  cmdQRef: MutableRefObject<Command[]>;
  repairRef: MutableRefObject<boolean>;
  sellRef: MutableRefObject<boolean>;
  clearTools: () => void;
  mobileCommandRef: MutableRefObject<MobileCommand | null>;
  setMobileCommandState: (v: MobileCommand | null) => void;
  commandMarkerRef: MutableRefObject<CommandMarker | null>;
  syncCursor: () => void;
}) {
  const markUnitCommand = useCallback((s: SimState, p: { x: number; y: number }, commands: Command[]) => {
    const kind = commandMarkerKind(commands);
    if (!kind) return;
    const { x, y } = pointerTile(s, p, camRef.current);
    commandMarkerRef.current = { x, y, bornMs: performance.now(), kind };
  }, [camRef, commandMarkerRef]);

  const issueContextOrder = useCallback((s: SimState, p: { x: number; y: number }, attackMove = false) => {
    const { x: tx, y: ty } = pointerTile(s, p, camRef.current);
    if (repairRef.current || sellRef.current) {
      clearTools();
      beep("cancel");
      syncCursor();
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
  }, [camRef, clearTools, cmdQRef, markUnitCommand, mobileCommandRef, repairRef, selectedRef, sellRef, setMobileCommandState, syncCursor]);

  return { markUnitCommand, issueContextOrder };
}
