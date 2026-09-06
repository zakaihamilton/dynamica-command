import type { BiomeName } from "../../types";
import { mixHex } from "../tilePalette";
import type { BlockerTone, PropPrim } from "./types";
import { pe, pl, pc, pp, shadow, liftGreen, SNOW } from "./primitives";

export function lushBiome(biome: BiomeName): boolean {
  return biome === "jungle wreckage" || biome === "salt marshes";
}

export function treePrims(v: number, t: BlockerTone, biome: BiomeName): PropPrim[] {
  const lean = ((v % 5) - 2) * 0.55;
  const dark = mixHex(t.high, t.blocked, 0.28);
  const mid = liftGreen(t.high, 28);
  const hi = t.light;
  const wood = mixHex(t.dark, "#3e2a1c", 0.45);
  const lobes = [
    { x: -10, y: -16, rx: 14.5, ry: 9.2, rot: -0.08, c: dark },
    { x: 7, y: -20, rx: 12.2, ry: 8.2, rot: 0.14, c: mid },
    { x: -2, y: -23, rx: 10.5, ry: 7.2, rot: -0.12, c: mid },
    { x: 11, y: -15, rx: 8.4, ry: 5.6, rot: 0.22, c: dark },
    { x: -12, y: -12, rx: 7.6, ry: 5.0, rot: -0.18, c: dark },
    { x: 2, y: -26, rx: 6.4, ry: 4.2, rot: -0.05, c: hi },
  ];
  const out: PropPrim[] = [
    shadow(18.5, 5.6),
    pl(-2.4, 6.2, 2.2, 6.2, wood, 5.2, { minWidth: 3.2, cap: "round" }),
    pc(0, 6, lean * 0.35, -4, lean, -18, wood, 3.6, { minWidth: 2.4, cap: "round" }),
  ];
  for (let i = 0; i < lobes.length; i++) {
    const lobe = lobes[i]!;
    out.push(pe(lobe.x + lean * 0.35, lobe.y, lobe.rx, lobe.ry, lobe.rot, lobe.c, i === 5 ? 0.55 : undefined));
  }
  if (biome === "jungle wreckage" && v % 3 !== 1) {
    const vine = mixHex(dark, "#285a30", 0.4);
    out.push(
      pc(-4 + lean, -18, -8 + lean, -8, -7, 2, vine, 1.1, { minWidth: 0.85 }),
      pc(6 + lean, -20, 9, -10, 8, 1, vine, 1.1, { minWidth: 0.85 }),
    );
  }
  if (biome === "salt marshes") {
    out.push(pe(-6 + lean, -12, 4, 2.2, -0.3, mixHex(t.high, "#5a6e46", 0.35), 0.5));
  }
  return out;
}

export function pinePrims(v: number, t: BlockerTone, snow: boolean): PropPrim[] {
  const lean = ((v % 3) - 1) * 0.3;
  const needle = mixHex(t.high, "#30603e", 0.35);
  const dark = mixHex(t.mid, needle, 0.4);
  const out: PropPrim[] = [
    shadow(14.5, 4.8),
    pl(0, 6.2, lean, -10, t.dark, 2.8, { minWidth: 1.8, cap: "round" }),
  ];
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const w = 17.5 - i * 2.7;
    const y = -2 - i * 6.2;
    out.push(pp(
      [-w + lean, y + 7.4, lean, y - 6.2, w + lean, y + 7.4],
      i >= tiers - 2 ? mixHex(needle, t.light, 0.16) : dark,
    ));
    if (snow && i >= 2) {
      out.push(pp(
        [-w * 0.35 + lean, y + 1.2, lean, y - 6.2, w * 0.35 + lean, y + 1.2],
        mixHex(t.light, SNOW, 0.5),
        0.55,
      ));
    }
  }
  return out;
}

export function deadTreePrims(v: number, t: BlockerTone): PropPrim[] {
  const wood = mixHex(t.dark, t.blocked, 0.25);
  const lean = ((v % 5) - 2) * 0.3;
  return [
    shadow(11, 3.6),
    pc(0, 5.4, lean * 0.4, -4, lean, -16, wood, 2.5, { minWidth: 1.7, cap: "round" }),
    pl(lean * 0.3, -5, -7.2, -12, wood, 1.45, { minWidth: 1.05, cap: "round" }),
    pl(lean * 0.4, -8, 6.4, -14, wood, 1.45, { minWidth: 1.05, cap: "round" }),
    pl(lean * 0.5, -11, -3.2, -17, wood, 1.45, { minWidth: 1.05, cap: "round" }),
    pl(lean * 0.45, -7, 4.2, -9.5, wood, 1.45, { minWidth: 1.05, cap: "round" }),
  ];
}

export function deadShrubPrims(v: number, t: BlockerTone): PropPrim[] {
  const wood = mixHex(t.dark, t.blocked, 0.2);
  const dust = mixHex(t.light, t.blocked, 0.35);
  const lean = ((v % 3) - 1) * 0.4;
  return [
    shadow(11.5, 3.6),
    pl(0, 5.2, lean, -9, wood, 1.8, { minWidth: 1.25, cap: "round" }),
    pl(-0.5, -2.4, -7.4, -8.4, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pl(0.6, -3.6, 7.2, -9.6, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pl(lean * 0.4, -6, 2.4, -13, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pl(lean * 0.3, -5, -3.4, -11, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pl(0.2, -4, 4.6, -6.4, wood, 1.15, { minWidth: 0.9, cap: "round" }),
    pe(-4.4, -7.4, 3.4, 1.7, -0.4, dust, 0.55),
    pe(4.6, -8.4, 3.0, 1.5, 0.3, dust, 0.55),
    pe(1.2, -11.2, 2.2, 1.15, 0.1, dust, 0.55),
  ];
}
