import type { Rng } from "../seed/rng";
import type { FaceDna } from "../types";

const SKINS = ["#e3b48a", "#c68642", "#8d5524", "#f0c9a0", "#d4a574", "#ad8b73"];
const HAIR = ["#1a1a1a", "#2c241e", "#6b4423", "#c4a35a", "#3b2f2f", "#8b1e3f", "#d8d0c8"];
const EYES = ["#2b2b2b", "#355c7d", "#3a7d44", "#5c3d1e", "#4a5a6a"];
const UNIFORMS = ["#384333", "#353d46", "#514536", "#2f3d3b", "#48403b", "#303840"];

export function generateFace(rng: Rng): FaceDna {
  const roll = rng.next();
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIR),
    hairStyle: rng.int(4) as FaceDna["hairStyle"],
    eyes: rng.pick(EYES),
    brow: rng.next() * 0.6 + 0.2,
    jaw: rng.next() * 0.4 + 0.8,
    mouthWidth: rng.next() * 0.3 + 0.35,
    nose: rng.next() * 0.4 + 0.4,
    uniform: rng.pick(UNIFORMS),
    headgear: rng.int(4) as FaceDna["headgear"],
    insignia: rng.int(4) as FaceDna["insignia"],
    beard: (roll < 0.58 ? 0 : roll < 0.78 ? 1 : roll < 0.91 ? 2 : 3) as FaceDna["beard"],
    scar: rng.chance(0.22),
  };
}

export function generateFaces() {
  return { generateFace };
}
