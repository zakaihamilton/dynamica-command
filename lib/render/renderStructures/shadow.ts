import { footprintOf } from "../../catalog";
import type { Camera } from "../../iso";
import type { BuildingKind, Entity, SimState } from "../../types";
import { footprintPath } from "./footprint";

export function drawBuildingShadow(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  e: Entity,
  z: number,
): void {
  const fp = footprintOf(e.kind as BuildingKind);
  ctx.save();
  ctx.translate(5 * z, 4 * z);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#000";
  footprintPath(ctx, state, cam, e.x, e.y, fp.w, fp.h);
  ctx.fill();
  ctx.restore();
}
