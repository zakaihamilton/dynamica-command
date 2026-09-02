import type { Owner } from "../types";

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
  fill: "rgba(70, 226, 255, 0.2)",
  stroke: "rgba(90, 236, 255, 0.95)",
  pip: ALLY_IFF_HEX,
  frame: "rgba(70, 226, 255, 0.95)",
};

const ENEMY_IFF: IffColors = {
  hex: ENEMY_IFF_HEX,
  laser: "rgba(255, 77, 54, 0.45)",
  laserFill: "rgba(255, 77, 54, 0.28)",
  fill: "rgba(255, 90, 54, 0.24)",
  stroke: "rgba(255, 96, 64, 0.98)",
  pip: ENEMY_IFF_HEX,
  frame: "rgba(255, 96, 64, 0.95)",
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
