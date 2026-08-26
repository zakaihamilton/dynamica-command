import type { FxBurst } from "../fx";
import type { BuildingKind } from "../../types";

export type CommandMarker = {
  x: number;
  y: number;
  bornMs: number;
};

export type RenderExtras = {
  cursor?: { x: number; y: number } | null;
  placeKind?: BuildingKind | null;
  repairMode?: boolean;
  sellMode?: boolean;
  clockMs?: number;
  selectBox?: { x0: number; y0: number; x1: number; y1: number } | null;
  fx?: FxBurst[];
  commandMarker?: CommandMarker | null;
  subTickAlpha?: number;
  render3dUnits?: boolean;
};
