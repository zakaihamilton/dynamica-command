import { createRng, type Rng } from "../seed/rng";
import type { FaceDna } from "../types";

const SKINS = ["#e8c39e", "#c68642", "#8d5524", "#f1c27d", "#ffdbac", "#ad8b73"];
const HAIR = ["#1a1a1a", "#3b2f2f", "#6b4423", "#c4a35a", "#4a2c82", "#8b1e3f", "#d8d0c8"];
const EYES = ["#2b2b2b", "#355c7d", "#3a7d44", "#6b3fa0", "#8b4513"];

export function generateFace(rng: Rng): FaceDna {
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIR),
    hairStyle: rng.int(4) as FaceDna["hairStyle"],
    eyes: rng.pick(EYES),
    brow: rng.next() * 0.6 + 0.2,
    jaw: rng.next() * 0.4 + 0.8,
    mouthWidth: rng.next() * 0.3 + 0.35,
    nose: rng.next() * 0.4 + 0.4,
  };
}

export function generateFaces() {
  return { generateFace };
}
