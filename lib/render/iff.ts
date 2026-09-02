import type { Owner, UnitKind } from "../types";
import { unitShadowRadii } from "./unitMotion";

/** Matches turret aim lasers and `--chrome-cyan`. */
export const ALLY_IFF_HEX = "#46e2ff";
/** Matches turret aim lasers. */
export const ENEMY_IFF_HEX = "#ff4d36";
/** Scenario neutrals (convoy / stranded) — not hostile. */
export const NEUTRAL_IFF_HEX = "#f5e6a8";

export type IffColors = {
  hex: string;
  laser: string;
  laserFill: string;
  fill: string;
  stroke: string;
  pip: string;
  frame: string;
};

const ALLY_IFF: IffColors = {
  hex: ALLY_IFF_HEX,
  laser: "rgba(70, 226, 255, 0.45)",
  laserFill: "rgba(70, 226, 255, 0.28)",
  fill: "rgba(70, 226, 255, 0.16)",
  stroke: "rgba(70, 226, 255, 0.72)",
  pip: ALLY_IFF_HEX,
  frame: "rgba(70, 226, 255, 0.9)",
};

const ENEMY_IFF: IffColors = {
  hex: ENEMY_IFF_HEX,
  laser: "rgba(255, 77, 54, 0.45)",
  laserFill: "rgba(255, 77, 54, 0.28)",
  fill: "rgba(255, 77, 54, 0.18)",
  stroke: "rgba(255, 77, 54, 0.75)",
  pip: ENEMY_IFF_HEX,
  frame: "rgba(255, 77, 54, 0.9)",
};

const NEUTRAL_IFF: IffColors = {
  hex: NEUTRAL_IFF_HEX,
  laser: "rgba(245, 230, 168, 0.45)",
  laserFill: "rgba(245, 230, 168, 0.28)",
  fill: "rgba(245, 230, 168, 0.16)",
  stroke: "rgba(245, 230, 168, 0.72)",
  pip: NEUTRAL_IFF_HEX,
  frame: "rgba(245, 230, 168, 0.9)",
};

export function iffColors(owner: Owner, neutral = false): IffColors {
  if (neutral) return NEUTRAL_IFF;
  return owner === 0 ? ALLY_IFF : ENEMY_IFF;
}

/**
 * Ground IFF ring at a unit's feet. Drawn under the sprite, over the contact shadow.
 */
export function drawUnitIffMarker(
  ctx: CanvasRenderingContext2D,
  kind: UnitKind,
  cx: number,
  groundY: number,
  scale: number,
  alpha: number,
  owner: Owner,
  neutral = false,
): void {
  const iff = iffColors(owner, neutral);
  const { radX, radY } = unitShadowRadii(kind, scale);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, groundY, radX * 1.08, radY * 1.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = iff.fill;
  ctx.globalAlpha = alpha * 0.4;
  ctx.fill();
  ctx.strokeStyle = iff.stroke;
  ctx.lineWidth = Math.max(1.25, 1.55 * scale);
  ctx.globalAlpha = alpha * 0.85;
  ctx.stroke();
  ctx.restore();
}
