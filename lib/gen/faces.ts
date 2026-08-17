import type { Rng } from "../seed/rng";
import type { CharacterRole, FaceDna } from "../types";

const SKINS = [
  "#f3d1b0", "#e3b48a", "#d4a574", "#c68642", "#a86b3c", "#8d5524",
  "#6d3d22", "#f0c9a0", "#ad8b73", "#c49a78", "#b07a58", "#5c3317",
];
const HAIR = [
  "#1a1a1a", "#2c241e", "#3b2f2f", "#6b4423", "#8a5a2b", "#c4a35a",
  "#d8d0c8", "#8b1e3f", "#4a3728", "#1c1410", "#6e3b2a", "#b9bcc4",
];
const EYES = ["#2b2b2b", "#355c7d", "#3a7d44", "#5c3d1e", "#4a5a6a", "#6b4ea0", "#1f4a5c"];
const ALLY_UNIFORMS = ["#384333", "#3d4a38", "#2f3d3b", "#454c3c", "#2a3830"];
const COMMAND_UNIFORMS = ["#353d46", "#3a4450", "#303840", "#48403b", "#2c3340"];
const ENEMY_UNIFORMS = ["#514536", "#4a322c", "#3d2a28", "#5a4038", "#46302c"];

function pickHeadgear(rng: Rng, role?: CharacterRole): FaceDna["headgear"] {
  if (role === "advisor") return rng.pick([0, 0, 0, 0, 1, 1, 4, 4, 2]);
  if (role === "commander") return rng.pick([0, 1, 1, 1, 2, 2, 4, 4, 3]);
  if (role === "enemyLeader") return rng.pick([0, 1, 1, 2, 2, 3, 3, 3, 4]);
  return rng.int(5) as FaceDna["headgear"];
}

function pickHair(rng: Rng, feminine: boolean): FaceDna["hairStyle"] {
  if (feminine) return rng.pick([0, 1, 1, 2, 4, 4, 5, 5, 5, 3]);
  return rng.pick([0, 0, 1, 1, 2, 2, 3, 5]);
}

function pickBeard(rng: Rng, feminine: boolean): FaceDna["beard"] {
  if (feminine) return 0;
  const roll = rng.next();
  if (roll < 0.5) return 0;
  if (roll < 0.7) return 1;
  if (roll < 0.88) return 2;
  return 3;
}

function pickScar(rng: Rng, role?: CharacterRole): FaceDna["scar"] {
  const chance = role === "enemyLeader" ? 0.38 : role === "commander" ? 0.2 : 0.12;
  if (!rng.chance(chance)) return 0;
  return (1 + rng.int(3)) as FaceDna["scar"];
}

export function generateFace(
  rng: Rng,
  role?: CharacterRole,
  opts?: { feminine?: boolean },
): FaceDna {
  const feminine = opts?.feminine ?? rng.chance(0.48);
  const uniforms = role === "enemyLeader" ? ENEMY_UNIFORMS : role === "commander" ? COMMAND_UNIFORMS : ALLY_UNIFORMS;
  const headgear = pickHeadgear(rng, role);
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIR),
    hairStyle: pickHair(rng, feminine),
    eyes: rng.pick(EYES),
    brow: rng.next() * 0.7 + 0.15,
    jaw: feminine ? rng.next() * 0.28 + 0.78 : rng.next() * 0.36 + 0.86,
    mouthWidth: feminine ? rng.next() * 0.28 + 0.4 : rng.next() * 0.32 + 0.34,
    nose: rng.next() * 0.48 + 0.36,
    uniform: rng.pick(uniforms),
    headgear,
    insignia: rng.int(4) as FaceDna["insignia"],
    beard: pickBeard(rng, feminine),
    scar: pickScar(rng, role),
    feminine,
    glasses: rng.chance(feminine ? 0.22 : 0.18),
    headset: role === "advisor" ? rng.chance(0.55) && headgear !== 3 : rng.chance(0.08) && headgear === 0,
    eyeShape: feminine ? rng.pick([0, 1, 1, 1, 2]) : rng.pick([0, 0, 1, 2, 2]),
    eyeSize: feminine ? rng.next() * 0.28 + 0.92 : rng.next() * 0.32 + 0.78,
    noseStyle: feminine ? rng.pick([0, 0, 1, 1, 2]) : rng.pick([0, 1, 1, 2, 2]),
    mouthStyle: feminine ? rng.pick([0, 1, 1, 1, 2]) : rng.pick([0, 0, 1, 2, 2]),
  };
}

export function generateFaces() {
  return { generateFace };
}
