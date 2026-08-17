import { createRng, type Rng } from "../seed/rng";
import type { Faction, Palette } from "../types";
import { genFactionPair } from "./names";

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h} ${s}% ${l}%)`;
}

function paletteFromHue(h: number, rng: Rng): Palette {
  const s = 48 + rng.int(30);
  return {
    primary: hsl(h, s, 42),
    secondary: hsl((h + 40) % 360, s - 10, 28),
    accent: hsl((h + 180) % 360, 70, 55),
    outline: hsl(h, 20, 10),
    light: hsl(h, s - 15, 72),
    dark: hsl(h, s, 16),
  };
}

export function generateFactions(seed: number): [Faction, Faction] {
  const rng = createRng(seed, "factions");
  const h1 = rng.int(360);
  let h2 = (h1 + 120 + rng.int(80)) % 360;
  if (Math.abs(h1 - h2) < 40) h2 = (h1 + 180) % 360;
  const [nameA, nameB] = genFactionPair(rng);
  const a = rng.fork("0");
  const b = rng.fork("1");
  return [
    {
      id: 0,
      name: nameA,
      adjective: a.pick(["allied", "loyal", "vanguard", "home"]),
      palette: paletteFromHue(h1, a),
    },
    {
      id: 1,
      name: nameB,
      adjective: b.pick(["hostile", "rival", "occupying", "rogue"]),
      palette: paletteFromHue(h2, b),
    },
  ];
}
