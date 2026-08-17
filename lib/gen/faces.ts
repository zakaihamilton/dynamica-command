import type { Rng } from "../seed/rng";
import type { CharacterRole, FaceDna } from "../types";

const SKINS = ["#e3b48a", "#c68642", "#8d5524", "#f0c9a0", "#d4a574", "#ad8b73"];
const HAIR = ["#1a1a1a", "#2c241e", "#6b4423", "#c4a35a", "#3b2f2f", "#8b1e3f", "#d8d0c8"];
const EYES = ["#2b2b2b", "#355c7d", "#3a7d44", "#5c3d1e", "#4a5a6a"];
const ALLY_UNIFORMS = ["#384333", "#3d4a38", "#2f3d3b", "#454c3c"];
const COMMAND_UNIFORMS = ["#353d46", "#3a4450", "#303840", "#48403b"];
const ENEMY_UNIFORMS = ["#514536", "#4a322c", "#3d2a28", "#5a4038"];

function headgearFor(rng: Rng, role?: CharacterRole): FaceDna["headgear"] {
  if (role === "advisor") return rng.chance(0.72) ? 0 : (rng.int(3) as FaceDna["headgear"]);
  if (role === "commander") return rng.chance(0.8) ? ((rng.chance(0.55) ? 1 : 2) as FaceDna["headgear"]) : 0;
  if (role === "enemyLeader") return rng.chance(0.78) ? 3 : ((rng.chance(0.5) ? 1 : 2) as FaceDna["headgear"]);
  return rng.int(4) as FaceDna["headgear"];
}

export function generateFace(rng: Rng, role?: CharacterRole): FaceDna {
  const roll = rng.next();
  const uniforms = role === "enemyLeader" ? ENEMY_UNIFORMS : role === "commander" ? COMMAND_UNIFORMS : ALLY_UNIFORMS;
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIR),
    hairStyle: rng.int(4) as FaceDna["hairStyle"],
    eyes: rng.pick(EYES),
    brow: rng.next() * 0.6 + 0.2,
    jaw: rng.next() * 0.4 + 0.8,
    mouthWidth: rng.next() * 0.3 + 0.35,
    nose: rng.next() * 0.4 + 0.4,
    uniform: rng.pick(uniforms),
    headgear: headgearFor(rng, role),
    insignia: rng.int(4) as FaceDna["insignia"],
    beard: (roll < 0.58 ? 0 : roll < 0.78 ? 1 : roll < 0.91 ? 2 : 3) as FaceDna["beard"],
    scar: rng.chance(role === "enemyLeader" ? 0.4 : 0.18),
  };
}

export function generateFaces() {
  return { generateFace };
}
