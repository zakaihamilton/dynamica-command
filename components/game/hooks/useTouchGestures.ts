import { useCallback, useRef, type MutableRefObject, type PointerEvent } from "react";
import { cameraPanBounds, panCamera } from "@/lib/render/camera";
import type { Camera } from "@/lib/iso";
import type { SimState } from "@/lib/types";

export function useTouchGestures({
  camRef,
  stateRef,
  selectionModeRef,
  boxRef,
  issueContextOrder,
}: {
  camRef: MutableRefObject<Camera>;
  stateRef: MutableRefObject<SimState>;
  selectionModeRef: MutableRefObject<boolean>;
  boxRef: MutableRefObject<{ x0: number; y0: number; x1: number; y1: number } | null>;
  issueContextOrder: (s: SimState, p: { x: number; y: number }) => void;
}) {
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const touchGesture = useRef<{ center: { x: number; y: number }; distance: number } | null>(null);
  const touchMultiTouch = useRef(false);
  const touchPan = useRef<{ pointerId: number; start: { x: number; y: number }; last: { x: number; y: number }; moved: boolean } | null>(null);
  const longPress = useRef<{ pointerId: number; timer: number; x: number; y: number; fired: boolean } | null>(null);

  const beginTouch = useCallback((e: PointerEvent<HTMLCanvasElement>, p: { x: number; y: number }) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events used by accessibility and browser tests do not have capture targets.
    }
    touchPoints.current.set(e.pointerId, p);
    if (touchPoints.current.size >= 2) {
      touchMultiTouch.current = true;
      touchGesture.current = null;
      touchPan.current = null;
      boxRef.current = null;
      if (longPress.current) window.clearTimeout(longPress.current.timer);
      longPress.current = null;
      return;
    }
    touchPan.current = { pointerId: e.pointerId, start: p, last: p, moved: false };
    if (selectionModeRef.current) {
      boxRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      return;
    }
    const timer = window.setTimeout(() => {
      const held = longPress.current;
      if (held && held.pointerId === e.pointerId && !held.fired && !touchGesture.current && !selectionModeRef.current) {
        held.fired = true;
        issueContextOrder(stateRef.current, { x: held.x, y: held.y });
      }
    }, 480);
    longPress.current = { pointerId: e.pointerId, timer, x: p.x, y: p.y, fired: false };
  }, [boxRef, issueContextOrder, selectionModeRef, stateRef]);

  const moveTouch = useCallback((e: PointerEvent<HTMLCanvasElement>, p: { x: number; y: number }): boolean => {
    const s = stateRef.current;
    const bounds = s
      ? cameraPanBounds(camRef.current, s.width, s.height, e.currentTarget.width, e.currentTarget.height)
      : undefined;
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
      return true;
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
      return false;
    }
    const pan = touchPan.current;
    if (pan && pan.pointerId === e.pointerId) {
      const distance = Math.hypot(p.x - pan.start.x, p.y - pan.start.y);
      if (distance > 10) pan.moved = true;
      if (pan.moved) {
        panCamera(camRef.current, p.x - pan.last.x, p.y - pan.last.y, bounds);
        pan.last = p;
      }
    }
    return false;
  }, [boxRef, camRef, selectionModeRef, stateRef]);

  const endTouch = useCallback((e: PointerEvent<HTMLCanvasElement>): boolean => {
    const held = longPress.current;
    touchPoints.current.delete(e.pointerId);
    if (held?.pointerId === e.pointerId) {
      window.clearTimeout(held.timer);
      longPress.current = null;
    }
    if (touchPoints.current.size > 0) return true;
    const wasGesture = !!touchGesture.current || touchMultiTouch.current || !!touchPan.current?.moved;
    touchGesture.current = null;
    touchMultiTouch.current = false;
    touchPan.current = null;
    return Boolean(held?.fired || wasGesture);
  }, []);

  const cancelTouch = useCallback(() => {
    if (longPress.current) window.clearTimeout(longPress.current.timer);
    longPress.current = null;
    touchPoints.current.clear();
    touchGesture.current = null;
    touchMultiTouch.current = false;
    touchPan.current = null;
  }, []);

  return { beginTouch, moveTouch, endTouch, cancelTouch };
}
