import { useCallback, useRef, type MutableRefObject, type RefObject } from "react";
import type { Camera } from "@/lib/iso";
import type { FxBurst } from "@/lib/render/fx";
import type { RenderExtras } from "@/lib/render/renderer";
import type { CommandMarker } from "@/lib/render/renderOverlays/types";
import type { BuildingKind, SimState } from "@/lib/types";
import { renderGameFrame } from "../renderFrame";
import type { SelectionBox } from "./selectionBox";

type Point = { x: number; y: number };
export function useGameRenderer({
  stateRef,
  hostRef,
  canvasRef,
  miniRef,
  mobileMiniRef,
  camRef,
  selected,
  hoverRef,
  cursorRef,
  boxRef,
  commandMarkerRef,
  place,
  repair,
  sell,
}: {
  stateRef: RefObject<SimState | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  miniRef: RefObject<HTMLCanvasElement | null>;
  mobileMiniRef: RefObject<HTMLCanvasElement | null>;
  camRef: MutableRefObject<Camera>;
  selected: MutableRefObject<Set<number>>;
  hoverRef: MutableRefObject<Point | null>;
  cursorRef: MutableRefObject<Point | null>;
  boxRef: MutableRefObject<SelectionBox | null>;
  commandMarkerRef?: MutableRefObject<CommandMarker | null>;
  place: MutableRefObject<BuildingKind | null>;
  repair: MutableRefObject<boolean>;
  sell: MutableRefObject<boolean>;
}) {
  const extrasRef = useRef<RenderExtras>({
    cursor: null,
    placeKind: null,
    repairMode: false,
    sellMode: false,
  });
  const worldCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const miniCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const mobileMiniCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const fxRef = useRef<FxBurst[]>([]);
  const fxSeq = useRef(1);

  const redraw = useCallback((nowMs?: number, subTickAlpha = 0) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!s || !canvas || !host) return;
    extrasRef.current.commandMarker = commandMarkerRef?.current ?? null;
    const frame = renderGameFrame({
      state: s,
      canvas,
      host,
      worldCtx: worldCtxRef.current,
      miniCanvas: miniRef.current,
      miniCtx: miniCtxRef.current,
      secondaryMiniCanvas: mobileMiniRef.current,
      secondaryMiniCtx: mobileMiniCtxRef.current,
      cam: camRef.current,
      selected: selected.current,
      hover: hoverRef.current,
      cursor: cursorRef.current,
      placeKind: place.current,
      repairMode: repair.current,
      sellMode: sell.current,
      selectBox: boxRef.current,
      extras: extrasRef.current,
      fx: fxRef.current,
      nowMs,
      subTickAlpha,
    });
    worldCtxRef.current = frame.worldCtx;
    miniCtxRef.current = frame.miniCtx;
    mobileMiniCtxRef.current = frame.secondaryMiniCtx;
    fxRef.current = frame.fx;
  }, [boxRef, camRef, canvasRef, commandMarkerRef, cursorRef, hostRef, hoverRef, miniRef, mobileMiniRef, place, repair, selected, sell, stateRef]);

  return { extrasRef, fxRef, fxSeq, redraw };
}

export type GameRenderer = ReturnType<typeof useGameRenderer>;
