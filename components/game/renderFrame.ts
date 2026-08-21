import { cameraViewQuad, type Camera } from "@/lib/render/iso";
import { renderMinimap } from "@/lib/render/minimap";
import { renderWorld, type RenderExtras } from "@/lib/render/renderer";
import { drawPerfHud, isPerfHudEnabled } from "@/lib/render/perfHud";
import { cullFx, type FxBurst } from "@/lib/render/fx";
import type { BuildingKind, SimState } from "@/lib/types";
import { renderDimensions } from "./hooks/useGameCamera";

type Point = { x: number; y: number };
type SelectBox = { x0: number; y0: number; x1: number; y1: number };

export type RenderFrameOptions = {
  state: SimState;
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  worldCtx: CanvasRenderingContext2D | null;
  miniCanvas: HTMLCanvasElement | null;
  miniCtx: CanvasRenderingContext2D | null;
  cam: Camera;
  selected: Set<number>;
  hover: Point | null;
  cursor: Point | null;
  placeKind: BuildingKind | null;
  repairMode: boolean;
  sellMode: boolean;
  selectBox: SelectBox | null;
  extras: RenderExtras;
  fx: FxBurst[];
  nowMs?: number;
  subTickAlpha?: number;
};

export type RenderFrameResult = {
  worldCtx: CanvasRenderingContext2D | null;
  miniCtx: CanvasRenderingContext2D | null;
  fx: FxBurst[];
};

/** Keeps canvas sizing, world rendering, minimap rendering, and frame diagnostics together. */
export function renderGameFrame(options: RenderFrameOptions): RenderFrameResult {
  const {
    state,
    canvas,
    host,
    cam,
    selected,
    hover,
    cursor,
    placeKind,
    repairMode,
    sellMode,
    selectBox,
    extras,
    nowMs,
    subTickAlpha = 0,
  } = options;

  const dimensions = renderDimensions(host);
  if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
  }

  let worldCtx = options.worldCtx;
  if (!worldCtx || worldCtx.canvas !== canvas) {
    worldCtx = canvas.getContext("2d", { alpha: false });
  }
  if (!worldCtx) return { worldCtx: null, miniCtx: options.miniCtx, fx: options.fx };

  extras.cursor = cursor;
  extras.placeKind = placeKind;
  extras.repairMode = repairMode;
  extras.sellMode = sellMode;
  const now = nowMs ?? performance.now();
  extras.clockMs = now;
  extras.selectBox = selectBox;
  extras.subTickAlpha = subTickAlpha;
  const fx = cullFx(options.fx, now);
  extras.fx = fx;

  const perfStarted = isPerfHudEnabled() ? performance.now() : 0;
  const worldTimings = renderWorld(worldCtx, state, cam, selected, hover, extras);
  let miniCtx = options.miniCtx;
  let minimapMs = 0;
  if (options.miniCanvas) {
    if (!miniCtx || miniCtx.canvas !== options.miniCanvas) {
      miniCtx = options.miniCanvas.getContext("2d", { alpha: false });
    }
    if (miniCtx) {
      const miniStarted = worldTimings ? performance.now() : 0;
      renderMinimap(miniCtx, state, cameraViewQuad(cam, canvas.width, canvas.height), selected);
      if (worldTimings) minimapMs = performance.now() - miniStarted;
    }
  }
  if (worldTimings && isPerfHudEnabled()) {
    drawPerfHud(worldCtx, now, worldTimings, minimapMs);
  }
  if (perfStarted > 0) {
    canvas.dataset.perfFrameMs = (performance.now() - perfStarted).toFixed(2);
  }

  return { worldCtx, miniCtx, fx };
}
