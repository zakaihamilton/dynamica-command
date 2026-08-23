import type { AnimFrame, UnitKind } from "../types";

export const GROUND_DUST_FILL = "rgba(140, 130, 115, 0.25)";
export const UNIT_SHADOW_FILL = "#000";
export const UNIT_SHADOW_ALPHA = 0.32;
export const UNIT_SHADOW_MOVE_ALPHA = 0.36;
export const UNIT_SHADOW_OFFSET_X = 5;
export const UNIT_SHADOW_OFFSET_Y = 4;

export type UnitMotionOptions = {
  strideRatio?: number;
  stridePhase?: number;
};

export function unitShadowRadii(kind: UnitKind, scale: number): { radX: number; radY: number } {
  if (kind === "infantry" || kind === "medic") return { radX: 10 * scale, radY: 5 * scale };
  if (kind === "antiArmor") return { radX: 12 * scale, radY: 6 * scale };
  if (kind === "tank") return { radX: 18 * scale, radY: 9 * scale };
  return { radX: 16 * scale, radY: 8 * scale };
}

/**
 * Draw a planted isometric contact shadow under a unit.
 * Rendered underneath the unit before drawing sprite geometry.
 */
export function drawUnitShadow(
  ctx: CanvasRenderingContext2D,
  kind: UnitKind,
  cx: number,
  groundY: number,
  scale: number,
  alpha: number = 1,
  isMoving: boolean = false,
): void {
  const { radX, radY } = unitShadowRadii(kind, scale);
  ctx.save();
  ctx.translate(UNIT_SHADOW_OFFSET_X * scale, UNIT_SHADOW_OFFSET_Y * scale);
  ctx.globalAlpha = alpha * (isMoving ? UNIT_SHADOW_MOVE_ALPHA : UNIT_SHADOW_ALPHA);
  ctx.fillStyle = UNIT_SHADOW_FILL;
  ctx.beginPath();
  ctx.ellipse(cx, groundY, radX, radY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function strideRatioFromOptions(frame: AnimFrame, options: UnitMotionOptions): number {
  if (options.strideRatio !== undefined) return options.strideRatio;
  const phase = options.stridePhase !== undefined
    ? options.stridePhase
    : (frame / 4) * Math.PI * 2;
  return Math.sin(phase);
}

/**
 * Paint ground dust under moving units. Never draws onto sprite pixels.
 */
export function paintUnitMovementFx(
  ctx: CanvasRenderingContext2D,
  kind: UnitKind,
  dx: number,
  _dy: number,
  dw: number,
  _dh: number,
  groundY: number,
  scale: number,
  frame: AnimFrame,
  alpha: number,
  options: UnitMotionOptions = {},
): void {
  const isWalker = kind === "infantry" || kind === "antiArmor" || kind === "medic";
  const ratio = strideRatioFromOptions(frame, options);
  const cx = dx + dw * 0.5;

  ctx.save();
  ctx.fillStyle = GROUND_DUST_FILL;
  ctx.globalAlpha = alpha;

  if (isWalker) {
    if (Math.abs(ratio) < 0.18) {
      ctx.beginPath();
      ctx.ellipse(cx, groundY, 4.2 * scale, 2.1 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 1 * scale, dw * 0.38, 2.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
