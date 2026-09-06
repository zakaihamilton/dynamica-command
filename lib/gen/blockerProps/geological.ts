import { mixHex } from "../tilePalette";
import type { BlockerTone, PropPrim } from "./types";
import { pe, pl, pp, shadow, liftGreen, SNOW } from "./primitives";

export function boulderPrims(v: number, t: BlockerTone, lush: boolean, snowCap: boolean): PropPrim[] {
  const twist = ((v % 5) - 2) * 0.35;
  const body = lush ? liftGreen(t.blocked, 18) : t.blocked;
  const facet = mixHex(body, t.dark, 0.28);
  const cap = snowCap ? mixHex(t.light, SNOW, 0.55) : t.light;
  const out: PropPrim[] = [
    shadow(16.5, 5.2),
    pp([-15, 2.2, 14, 3.1, 10, 9.2, -12, 8.4], t.dark),
    pp([
      -13 + twist, 2,
      -6 + twist, -8,
      -1, -13,
      13 + twist * 0.4, -1.4,
      9, 5.4,
      -10, 5.6,
    ], body),
    pp([-6, 1, -1, -12, 6, -3, 4, 4], facet),
    pp([2, 2, 6, -3, 13 + twist * 0.4, -1.4, 9, 5.4], mixHex(body, t.dark, 0.45)),
    pl(-4, -4, 3, 3, mixHex(t.dark, body, 0.35), 0.85, { minWidth: 0.7 }),
  ];
  if (lush) {
    out.push(
      pe(-5, -2, 4.2, 2.1, -0.4, liftGreen(t.high, 12), 0.55),
      pe(4, 1.2, 3.2, 1.6, 0.2, liftGreen(t.high, 12), 0.55),
    );
  }
  out.push(pp([-1, -13, 13 + twist * 0.4, -1.4, 5, 0.6, -7, -6.4], cap, snowCap ? 0.86 : 0.5));
  return out;
}

export function sandstonePrims(v: number, t: BlockerTone): PropPrim[] {
  const lean = ((v % 5) - 2) * 0.28;
  const base = mixHex(t.blocked, t.high, 0.22);
  const mid = mixHex(t.high, t.light, 0.28);
  const hi = mixHex(t.light, "#e8d2a8", 0.35);
  const bands = [
    { y: 4, h: 5.5, c: mixHex(base, t.dark, 0.2) },
    { y: -1, h: 5.2, c: base },
    { y: -6, h: 5.0, c: mid },
  ];
  const out: PropPrim[] = [
    shadow(15.5, 5),
    pp([-14, 3, 13, 3.4, 10, 8.6, -11, 8.2], t.dark),
  ];
  for (const band of bands) {
    out.push(pp([
      -12 + lean, band.y + 1.2,
      11 + lean * 0.4, band.y + 0.6,
      9, band.y - band.h + 1.4,
      -10 + lean * 0.2, band.y - band.h + 1.8,
    ], band.c));
  }
  out.push(
    pp([-8, -9.2, 1, -12.4, 9, -8.4, 6, -6.6, -5, -7.2], hi),
    pl(-9, -1.2, 8, -2.4, mixHex(t.dark, base, 0.4), 0.75, { minWidth: 0.65 }),
    pl(-8, 3.2, 7, 2.2, mixHex(t.dark, base, 0.4), 0.75, { minWidth: 0.65 }),
  );
  return out;
}

export function crystalPrims(v: number, t: BlockerTone): PropPrim[] {
  const gem = mixHex(t.ore, t.light, 0.42);
  const dark = mixHex(t.dark, t.ore, 0.38);
  const inner = mixHex(gem, "#e6fff8", 0.4);
  const shards = [
    { lean: -7, rise: 13, half: 4.0, gem: false },
    { lean: -1, rise: 16, half: 3.2, gem: true },
    { lean: 3, rise: 20, half: 3.5, gem: true },
    { lean: 9, rise: 12, half: 3.6, gem: false },
    { lean: 5, rise: 10, half: 2.6, gem: false },
  ];
  const out: PropPrim[] = [
    shadow(13, 4.2),
    pp([-11, 3.4, 12, 3.6, 8, 7.2, -8, 7], mixHex(t.blocked, t.dark, 0.2)),
  ];
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i]!;
    const twist = ((v >>> (i * 2)) % 5 - 2) * 0.4;
    out.push(pp([
      shard.lean - shard.half, 3.2,
      shard.lean + twist, -shard.rise,
      shard.lean + shard.half, 2.6,
    ], shard.gem ? gem : dark));
  }
  out.push(pp([1.2, -2, 2.4, -17, 5, -1.2], inner, 0.5));
  return out;
}

export function wreckagePrims(v: number, t: BlockerTone): PropPrim[] {
  const rust = mixHex(t.ore, t.blocked, 0.28);
  const iron = mixHex(t.dark, t.blocked, 0.15);
  const seam = mixHex(t.light, rust, 0.4);
  const out: PropPrim[] = [
    shadow(15, 4.6),
    pp([-13, 3.2, 3, -7.2, 14, 1.2, 9, 7.4, -10, 7.2], iron),
    pp([-6.5, 1.2, 7.4, -4.4, 11, 2.2, -3.2, 5.2], rust),
    pp([-10, 2, -2, -3, 1.4, 1.6, -7, 5], mixHex(iron, t.light, 0.16)),
    pl(-8, 2, 6, -2 + (v % 3) * 0.4, seam, 1.15, { minWidth: 0.85, cap: "round" }),
    pl(8, 1, 13, -8, seam, 1.6, { minWidth: 1.1, cap: "round" }),
  ];
  const rivet = mixHex(seam, t.dark, 0.3);
  for (let i = 0; i < 4; i++) {
    out.push(pe(-6 + i * 3.2, 1.4 + (i % 2) * 0.7, 0.55, 0.4, 0, rivet));
  }
  return out;
}

export function spirePrims(v: number, t: BlockerTone): PropPrim[] {
  const rock = mixHex(t.blocked, t.dark, 0.2);
  const glow = mixHex(t.ore, "#d25024", 0.4);
  const out: PropPrim[] = [
    shadow(11, 3.8),
    pe(0, 5.4, 9.5, 3.2, 0, mixHex(t.dark, glow, 0.25), 0.45),
    pp([-8, 5.2, -2.4, -17, 2.6, -9, 8.4, 5.2, -4.2, 7.2], rock),
    pp([-1.2, 2.4, -1.6, -15, 1.8, -6.4], glow, 0.58),
    pl(-0.4, 3, -1.2, -14, mixHex(glow, "#ff8c3c", 0.35), 0.85, { minWidth: 0.7 }),
  ];
  if (v % 2 === 0) {
    out.push(pp([-2.2, -10, -2.2, -17, 0.8, -11], t.light, 0.3));
  }
  return out;
}
