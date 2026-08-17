import { createRng } from "../seed/rng";
import type { FactionVisualProfile, Owner } from "../types";

const MATERIALS = ["brushed", "armored", "industrial"] as const;
const LIGHTS = ["cyan", "amber", "red"] as const;

export function generateVisualProfile(seed: number, owner: Owner): FactionVisualProfile {
  const rng = createRng(seed, `visual-profile:${owner}`);
  const designFamily = rng.int(3) as FactionVisualProfile["designFamily"];
  return {
    designFamily,
    material: MATERIALS[(designFamily + rng.int(2)) % MATERIALS.length]!,
    trimPattern: rng.int(4) as FactionVisualProfile["trimPattern"],
    insignia: rng.int(5) as FactionVisualProfile["insignia"],
    weathering: rng.int(4) as FactionVisualProfile["weathering"],
    lightRig: LIGHTS[(owner + rng.int(2)) % LIGHTS.length]!,
  };
}

export function profileKey(profile: FactionVisualProfile): string {
  return `${profile.designFamily}:${profile.material}:${profile.trimPattern}:${profile.insignia}:${profile.weathering}:${profile.lightRig}`;
}
