import type { Formation, Stance } from "@/lib/types";

export const STANCE_OPTIONS: { id: Stance; label: string }[] = [
  { id: "aggressive", label: "Aggressive" },
  { id: "defensive", label: "Defend" },
  { id: "hold", label: "Hold" },
];

export const FORMATION_OPTIONS: { id: Formation; label: string }[] = [
  { id: "line", label: "Line" },
  { id: "column", label: "Column" },
  { id: "wedge", label: "Wedge" },
];

export const STANCE_IDS = STANCE_OPTIONS.map((option) => option.id);
export const FORMATION_IDS = FORMATION_OPTIONS.map((option) => option.id);
