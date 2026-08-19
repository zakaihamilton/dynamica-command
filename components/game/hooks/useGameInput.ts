import { useCallback, useRef, type MutableRefObject, type PointerEvent } from "react";
import { beep } from "@/lib/audio/synth";
import { pickEntity } from "@/lib/render/pick";
import { pickTile, visibleBuildingAt } from "@/lib/render/renderer";
import { panCamera, panDirFromPointer, EDGE_PAN_BAND, type PanAvailability, type PanDir } from "@/lib/render/camera";
import { screenToTile, tileToScreen, type Camera } from "@/lib/render/iso";
import { groundOrders } from "@/lib/sim/orders";
import { heightAt } from "@/lib/sim/world";
import type { BuildingKind, Command, SimState } from "@/lib/types";
import type { MobileCommand } from "../MobileCommandTray";

function isContactTarget(s: SimState, entity: SimState["entities"][number]): boolean {
  return (
    entity.neutral === true &&
    (s.runtime?.kind === "rescue" || s.runtime?.kind === "extraction") &&
    Boolean(s.runtime.targetIds?.includes(entity.id))
  );
}

function entityAt(s: SimState, tx: number, ty: number) {
  const unit = s.entities.find(
    (en) =>
      en.hp > 0 &&
      en.class === "unit" &&
      (isContactTarget(s, en) || !en.neutral) &&
      Math.round(en.x) === tx &&
      Math.round(en.y) === ty,
  );
  if (unit) return unit;
  return visibleBuildingAt(s, tx, ty);
}

function pickSelectableEntity(s: SimState, x: number, y: number, tx: number, ty: number, cam: Camera) {
  return (
    pickEntity(s, x, y, cam, s.runtime?.kind === "rescue" || s.runtime?.kind === "extraction") ??
    entityAt(s, tx, ty)
  );
}

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
}) {
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const boxRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const touchGesture = useRef<{ center: { x: number; y: number }; distance: number } | null>(null);
  const touchMultiTouch = useRef(false);
  const longPress = useRef<{ pointerId: number; timer: number; x: number; y: number; fired: boolean } | null>(null);

  function canvasPos(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }

  const issueContextOrder = useCallback((s: SimState, p: { x: number; y: number }, attackMove = false) => {
    const picked = pickTile(s, p.x, p.y, camRef.current);
    const t = picked ?? screenToTile(p.x, p.y, camRef.current);
    const tx = Math.round(t.x);
    const ty = Math.round(t.y);
    if (repairRef.current || sellRef.current) {
      clearTools();
      beep("select");
      return;
    }
    const ids = [...selectedRef.current];
    const target = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
    if (target && target.owner === 1) cmdQRef.current.push({ type: "attack", unitIds: ids, targetId: target.id });
    else cmdQRef.current.push(...groundOrders(s, ids, tx, ty, attackMove));
    beep("ack");
  }, [camRef, clearTools, cmdQRef, repairRef, selectedRef, sellRef]);

  const onDown = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") {
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = canvasPos(e);
      touchPoints.current.set(e.pointerId, p);
      if (touchPoints.current.size >= 2) {
        touchMultiTouch.current = true;
        touchGesture.current = null;
        if (longPress.current) window.clearTimeout(longPress.current.timer);
        longPress.current = null;
      } else {
        const timer = window.setTimeout(() => {
          const held = longPress.current;
          if (held && held.pointerId === e.pointerId && !held.fired && !touchGesture.current) {
            held.fired = true;
            issueContextOrder(stateRef.current, { x: held.x, y: held.y });
          }
        }, 480);
        longPress.current = { pointerId: e.pointerId, timer, x: p.x, y: p.y, fired: false };
      }
      return;
    }
    if (e.button !== 0) return;
    const p = canvasPos(e);
    boxRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  }, [issueContextOrder, stateRef]);

  const onMove = useCallback((e: PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPos(e);
    if (e.pointerType === "touch") {
      touchPoints.current.set(e.pointerId, p);
      if (touchPoints.current.size >= 2) {
        const points = [...touchPoints.current.values()];
        const center = { x: (points[0]!.x + points[1]!.x) / 2, y: (points[0]!.y + points[1]!.y) / 2 };
        const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
        const previous = touchGesture.current;
        if (previous) {
          panCamera(camRef.current, center.x - previous.center.x, center.y - previous.center.y, undefined);
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
    }
    cursorRef.current = p;
    const s = stateRef.current;
    if (s) {
      hoverRef.current = pickTile(s, p.x, p.y, camRef.current);
    }
    if (boxRef.current && e.buttons === 1) {
      boxRef.current.x1 = p.x;
      boxRef.current.y1 = p.y;
    }
    const r = e.currentTarget.getBoundingClientRect();
    applyEdgePan(
      pausedRef.current
        ? null
        : panDirFromPointer(e.clientX - r.left, e.clientY - r.top, r.width, r.height, EDGE_PAN_BAND, panAvailRef.current),
    );
  }, [applyEdgePan, camRef, panAvailRef, pausedRef, stateRef]);

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
      const wasGesture = !!touchGesture.current || touchMultiTouch.current;
      touchGesture.current = null;
      touchMultiTouch.current = false;
      if (held?.fired || wasGesture) return;
    }
    const p = canvasPos(e);
    const picked = pickTile(s, p.x, p.y, camRef.current);
    const t = picked ?? screenToTile(p.x, p.y, camRef.current);
    const tx = Math.round(t.x);
    const ty = Math.round(t.y);
    if (e.pointerType === "touch" && mobileCommandRef.current) {
      const command = mobileCommandRef.current;
      const target = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
      const ids = [...selectedRef.current];
      if (ids.length > 0) {
        if (command === "move") cmdQRef.current.push({ type: "move", unitIds: ids, x: tx, y: ty });
        else if (command === "attackMove") cmdQRef.current.push({ type: "attackMove", unitIds: ids, x: tx, y: ty });
        else if (command === "attack" && target?.owner === 1) cmdQRef.current.push({ type: "attack", unitIds: ids, targetId: target.id });
        else if (command === "harvest" && s.tiles[ty * s.width + tx] === 2) cmdQRef.current.push({ type: "harvest", unitIds: ids, x: tx, y: ty });
      }
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
      const ids: number[] = [];
      const x0 = Math.min(b.x0, b.x1);
      const y0 = Math.min(b.y0, b.y1);
      const x1 = Math.max(b.x0, b.x1);
      const y1 = Math.max(b.y0, b.y1);
      for (const en of s.entities) {
        if (en.hp <= 0 || en.owner !== 0 || en.class !== "unit" || (en.neutral && !isContactTarget(s, en))) continue;
        const elev = heightAt(s, Math.round(en.x), Math.round(en.y));
        const sp = tileToScreen(en.x, en.y, camRef.current, elev);
        if (sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) ids.push(en.id);
      }
      commitSelection(ids);
    } else {
      const hit = pickSelectableEntity(s, p.x, p.y, tx, ty, camRef.current);
      if (e.pointerType === "touch" && selectedRef.current.size > 0 && !hit) {
        cmdQRef.current.push(...groundOrders(s, [...selectedRef.current], tx, ty));
        beep("ack");
      } else if (e.pointerType === "touch" && selectedRef.current.size > 0 && hit?.owner === 1 && !hit.neutral) {
        cmdQRef.current.push({ type: "attack", unitIds: [...selectedRef.current], targetId: hit.id });
        beep("ack");
      } else {
        commitSelection(hit && hit.owner === 0 && (!hit.neutral || isContactTarget(s, hit)) ? [hit.id] : []);
        beep("select");
      }
    }
  }, [camRef, cmdQRef, commitSelection, issueContextOrder, mobileCommandRef, placeRef, repairRef, selectedRef, sellRef, setMobileCommandState, setPlaceKind, setRepairMode, setSellMode, stateRef]);

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
  };
}
