import { useCallback, useRef, type MutableRefObject, type PointerEvent } from "react";
import { beep } from "@/lib/audio/synth";
import { pickTile } from "@/lib/render/renderer";
import { cameraPanBounds, panCamera, panDirFromPointer, EDGE_PAN_BAND, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { type Camera } from "@/lib/iso";
import type { BuildingKind, Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../mobileCommandTypes";
import {
  contextOrders,
  friendlySupportOrders,
  mobileCommandOrders,
  pickSelectableEntity,
  pointerTile,
  selectionIdsInBox,
  isContactTarget,
} from "./gameInputOrders";

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
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const touchGesture = useRef<{ center: { x: number; y: number }; distance: number } | null>(null);
  const touchMultiTouch = useRef(false);
  const touchPan = useRef<{ pointerId: number; start: { x: number; y: number }; last: { x: number; y: number }; moved: boolean } | null>(null);
  const longPress = useRef<{ pointerId: number; timer: number; x: number; y: number; fired: boolean } | null>(null);

  function canvasPos(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }

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

  const onDown = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointer events used by accessibility and browser tests do not have capture targets.
      }
      const p = canvasPos(e);
      touchPoints.current.set(e.pointerId, p);
      if (touchPoints.current.size >= 2) {
        touchMultiTouch.current = true;
        touchGesture.current = null;
        touchPan.current = null;
        boxRef.current = null;
        if (longPress.current) window.clearTimeout(longPress.current.timer);
        longPress.current = null;
      } else {
        touchPan.current = { pointerId: e.pointerId, start: p, last: p, moved: false };
        if (selectionModeRef.current) {
          boxRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        } else {
          const timer = window.setTimeout(() => {
            const held = longPress.current;
            if (held && held.pointerId === e.pointerId && !held.fired && !touchGesture.current && !selectionModeRef.current) {
              held.fired = true;
              issueContextOrder(stateRef.current, { x: held.x, y: held.y });
            }
          }, 480);
          longPress.current = { pointerId: e.pointerId, timer, x: p.x, y: p.y, fired: false };
        }
      }
      return;
    }
    if (e.button !== 0) return;
    const p = canvasPos(e);
    boxRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  }, [issueContextOrder, selectionModeRef, stateRef]);

  const onMove = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPos(e);
    const s = stateRef.current;
    const bounds = s
      ? cameraPanBounds(camRef.current, s.width, s.height, e.currentTarget.width, e.currentTarget.height)
      : undefined;
    if (e.pointerType === "touch") {
      touchPoints.current.set(e.pointerId, p);
      if (touchPoints.current.size >= 2) {
        const points = [...touchPoints.current.values()];
        const center = { x: (points[0]!.x + points[1]!.x) / 2, y: (points[0]!.y + points[1]!.y) / 2 };
        const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
        const previous = touchGesture.current;
        if (previous) {
          panCamera(camRef.current, center.x - previous.center.x, center.y - previous.center.y, bounds);
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
      if (selectionModeRef.current) {
        if (boxRef.current) {
          boxRef.current.x1 = p.x;
          boxRef.current.y1 = p.y;
        }
      } else {
        const pan = touchPan.current;
        if (pan && pan.pointerId === e.pointerId) {
          const distance = Math.hypot(p.x - pan.start.x, p.y - pan.start.y);
          if (distance > 10) pan.moved = true;
          if (pan.moved) {
            panCamera(camRef.current, p.x - pan.last.x, p.y - pan.last.y, bounds);
            pan.last = p;
          }
        }
      }
    }
    cursorRef.current = p;
    if (s) {
      hoverRef.current = pickTile(s, p.x, p.y, camRef.current);
    }
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
  }, [applyEdgePan, camRef, panAvailRef, pausedRef, selectionModeRef, stateRef]);

  const onLeave = useCallback(() => {
    cursorRef.current = null;
    hoverRef.current = null;
    applyEdgePan(null);
  }, [applyEdgePan]);

  const onUp = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
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
      const wasGesture = !!touchGesture.current || touchMultiTouch.current || !!touchPan.current?.moved;
      touchGesture.current = null;
      touchMultiTouch.current = false;
      touchPan.current = null;
      if (held?.fired || wasGesture) return;
    }
    const p = canvasPos(e);
    const { x: tx, y: ty } = pointerTile(s, p, camRef.current);
    if (e.pointerType === "touch" && selectionModeRef.current) {
      const b = boxRef.current;
      boxRef.current = null;
      const drag = b && Math.hypot(b.x1 - b.x0, b.y1 - b.y0) > 8;
      if (drag && b) {
        // Explicit mobile marquee selection includes every friendly unit in the box,
        // including harvesters; desktop drag-selection keeps its existing filtering.
        commitSelection(selectionIdsInBox(s, camRef.current, b, false));
      } else {
        const hit = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
        commitSelection(hit && hit.owner === 0 && (!hit.neutral || isContactTarget(s, hit)) ? [hit.id] : []);
      }
      setSelectionMode(false);
      beep("select");
      return;
    }
    if (e.pointerType === "touch" && mobileCommandRef.current) {
      const command = mobileCommandRef.current;
      const target = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
      const ids = [...selectedRef.current];
      if (ids.length > 0) cmdQRef.current.push(...mobileCommandOrders(s, command, ids, target, tx, ty));
      mobileCommandRef.current = null;
      setMobileCommandState(null);
      beep("ack");
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      if (repairRef.current || sellRef.current) {
        repairRef.current = false;
        setRepairMode(false);
        sellRef.current = false;
        setSellMode(false);
        beep("select");
        return;
      }
      issueContextOrder(s, p, e.ctrlKey || e.metaKey);
      return;
    }
    if (placeRef.current) {
      boxRef.current = null;
      cmdQRef.current.push({ type: "build", building: placeRef.current, x: tx, y: ty });
      beep("build");
      placeRef.current = null;
      setPlaceKind(null);
      return;
    }
    if (repairRef.current) {
      boxRef.current = null;
      const hit = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
      if (hit && hit.owner === 0 && hit.class === "building") {
        cmdQRef.current.push({ type: "repair", buildingId: hit.id });
        beep("build");
      }
      return;
    }
    if (sellRef.current) {
      boxRef.current = null;
      const hit = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
      if (hit && hit.owner === 0 && hit.class === "building") {
        cmdQRef.current.push({ type: "sell", buildingId: hit.id });
        beep("build");
      }
      return;
    }
    const b = boxRef.current;
    boxRef.current = null;
    const drag = b && Math.hypot(b.x1 - b.x0, b.y1 - b.y0) > 8;
    if (drag && b) {
      commitSelection(selectionIdsInBox(s, camRef.current, b, true));
    } else {
      const hit = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
      if (e.pointerType === "touch" && selectedRef.current.size > 0 && !hit) {
        cmdQRef.current.push(...contextOrders(s, [...selectedRef.current], undefined, tx, ty));
        beep("ack");
      } else if (e.pointerType === "touch" && selectedRef.current.size > 0 && hit?.owner === 0) {
        const supportOrders = friendlySupportOrders(s, [...selectedRef.current], hit, tx, ty);
        if (supportOrders.length) {
          cmdQRef.current.push(...supportOrders);
          beep("ack");
        } else {
          commitSelection([hit.id]);
          beep("select");
        }
      } else if (e.pointerType === "touch" && selectedRef.current.size > 0 && hit?.owner === 1 && !hit.neutral) {
        cmdQRef.current.push({ type: "attack", unitIds: [...selectedRef.current], targetId: hit.id });
        beep("ack");
      } else {
        commitSelection(hit && hit.owner === 0 && (!hit.neutral || isContactTarget(s, hit)) ? [hit.id] : []);
        beep("select");
      }
    }
  }, [camRef, cmdQRef, commitSelection, issueContextOrder, mobileCommandRef, placeRef, repairRef, selectedRef, sellRef, selectionModeRef, setMobileCommandState, setPlaceKind, setRepairMode, setSelectionMode, setSellMode, stateRef]);

  const onCancel = useCallback(() => {
    if (longPress.current) window.clearTimeout(longPress.current.timer);
    longPress.current = null;
    touchPoints.current.clear();
    touchGesture.current = null;
    touchMultiTouch.current = false;
    touchPan.current = null;
    boxRef.current = null;
    mobileCommandRef.current = null;
    setMobileCommandState(null);
    setSelectionMode(false);
    applyEdgePan(null);
  }, [applyEdgePan, mobileCommandRef, setMobileCommandState, setSelectionMode]);

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
