import type { BiomeName } from "../../types";
import { hash, mixHex } from "../tilePalette";
import type { BlockerTone, PropPrim } from "./types";
import { pe, pl, pc, pp, shadow, liftGreen, SNOW } from "./primitives";

export function lushBiome(biome: BiomeName): boolean {
  return biome === "jungle wreckage" || biome === "salt marshes";
}

type TreeLobe = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  fill: "dark" | "mid" | "hi";
  alpha?: number;
};

type TreeProfile = {
  lobes: readonly TreeLobe[];
};

const TREE_PROFILES: readonly TreeProfile[] = [
  {
    lobes: [
      { x: -10.5, y: -15.3, rx: 13.6, ry: 8.6, rot: -0.1, fill: "dark" },
      { x: 6.4, y: -18.8, rx: 11.7, ry: 8.0, rot: 0.14, fill: "mid" },
      { x: -1.8, y: -22.4, rx: 10.0, ry: 7.1, rot: -0.12, fill: "mid" },
      { x: 10.1, y: -14.8, rx: 7.5, ry: 5.2, rot: 0.22, fill: "dark" },
      { x: -11.7, y: -11.7, rx: 6.8, ry: 4.8, rot: -0.18, fill: "dark" },
      { x: 2.0, y: -25.8, rx: 6.1, ry: 4.1, rot: -0.05, fill: "hi", alpha: 0.55 },
      { x: -5.2, y: -24.5, rx: 5.3, ry: 3.7, rot: 0.15, fill: "mid" },
    ],
  },
  {
    lobes: [
      { x: -6.5, y: -14.4, rx: 10.0, ry: 7.7, rot: -0.08, fill: "dark" },
      { x: 4.6, y: -17.3, rx: 9.4, ry: 7.6, rot: 0.12, fill: "mid" },
      { x: -1.0, y: -21.7, rx: 8.1, ry: 7.0, rot: -0.1, fill: "mid" },
      { x: 6.8, y: -23.2, rx: 6.5, ry: 5.5, rot: 0.2, fill: "mid" },
      { x: -8.1, y: -20.9, rx: 6.0, ry: 5.2, rot: -0.2, fill: "dark" },
      { x: 1.6, y: -26.4, rx: 5.9, ry: 4.0, rot: -0.03, fill: "hi", alpha: 0.55 },
      { x: 9.8, y: -14.8, rx: 5.2, ry: 4.4, rot: 0.28, fill: "dark" },
    ],
  },
  {
    lobes: [
      { x: -10.8, y: -15.4, rx: 12.4, ry: 8.0, rot: -0.12, fill: "dark" },
      { x: -2.5, y: -18.8, rx: 10.5, ry: 7.8, rot: 0.08, fill: "mid" },
      { x: 7.7, y: -19.2, rx: 8.2, ry: 6.5, rot: 0.2, fill: "mid" },
      { x: -12.5, y: -10.8, rx: 5.0, ry: 4.5, rot: -0.26, fill: "dark" },
      { x: 10.8, y: -14.2, rx: 5.9, ry: 4.7, rot: 0.25, fill: "dark" },
      { x: -5.0, y: -24.2, rx: 6.0, ry: 4.5, rot: -0.1, fill: "mid" },
      { x: 2.5, y: -25.9, rx: 5.2, ry: 3.8, rot: 0.04, fill: "hi", alpha: 0.55 },
    ],
  },
  {
    lobes: [
      { x: -10.2, y: -14.2, rx: 10.9, ry: 7.2, rot: -0.16, fill: "dark" },
      { x: 2.6, y: -17.7, rx: 10.1, ry: 7.1, rot: 0.16, fill: "mid" },
      { x: 10.1, y: -13.1, rx: 6.0, ry: 4.6, rot: 0.28, fill: "dark" },
      { x: -3.0, y: -24.0, rx: 8.1, ry: 5.4, rot: -0.08, fill: "mid" },
      { x: 8.2, y: -24.1, rx: 5.4, ry: 4.0, rot: 0.18, fill: "mid" },
      { x: -8.4, y: -22.6, rx: 5.3, ry: 3.8, rot: -0.24, fill: "hi", alpha: 0.55 },
    ],
  },
];

function treeUnit(v: number, salt: number): number {
  return hash(v + salt * 1009) / 0x1_0000_0000;
}

function treeJitter(v: number, salt: number, span: number): number {
  return (treeUnit(v, salt) * 2 - 1) * span;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function canopyLean(y: number, lean: number): number {
  return lean * Math.max(0, Math.min(1, (-y - 4) / 26));
}

export function treePrims(v: number, t: BlockerTone, biome: BiomeName): PropPrim[] {
  const dark = mixHex(t.high, t.blocked, 0.28);
  const mid = liftGreen(t.high, 28);
  const hi = t.light;
  const wood = mixHex(t.dark, "#3e2a1c", 0.45);
  const profile = TREE_PROFILES[hash(v + 7) % TREE_PROFILES.length]!;
  const scale = 0.93 + treeUnit(v, 11) * 0.14;
  const lean = treeJitter(v, 13, 2.6);
  const rootX = treeJitter(v, 17, 1.25);
  const trunkTopY = -(15.5 + treeUnit(v, 19) * 4.5) * scale;
  const trunkTopX = rootX + lean * 0.85;
  const out: PropPrim[] = [
    shadow(18.5 * scale, 5.6 * scale),
    pl(rootX - 2.4 * scale, 6.2 * scale, rootX + 2.2 * scale, 6.2 * scale, wood, 5.2 * scale, { minWidth: 3.2 * scale, cap: "round" }),
    pc(
      rootX,
      6 * scale,
      rootX + lean * 0.38 + treeJitter(v, 23, 1.8),
      -(4.5 + treeUnit(v, 29) * 2.5) * scale,
      trunkTopX,
      trunkTopY,
      wood,
      3.6 * scale,
      { minWidth: 2.4 * scale, cap: "round" },
    ),
  ];
  const fills = { dark, mid, hi };
  for (let i = 0; i < profile.lobes.length; i++) {
    const lobe = profile.lobes[i]!;
    const lobeScale = 0.92 + treeUnit(v, 41 + i * 7) * 0.16;
    const rx = lobe.rx * scale * lobeScale;
    const ry = lobe.ry * scale * lobeScale;
    const rawX = lobe.x * scale + canopyLean(lobe.y, lean) + rootX * 0.35 + treeJitter(v, 53 + i * 11, 0.85);
    const rawY = lobe.y * scale + treeJitter(v, 59 + i * 13, 0.65);
    const x = clamp(rawX, -23.5 + rx, 23.5 - rx);
    const y = clamp(rawY, -35.5 + ry, 15.5 - ry);
    out.push(pe(
      x,
      y,
      rx,
      ry,
      lobe.rot + treeJitter(v, 67 + i * 17, 0.055),
      fills[lobe.fill],
      lobe.alpha,
    ));
  }
  if (biome === "jungle wreckage" && v % 3 !== 1) {
    const vine = mixHex(dark, "#285a30", 0.4);
    out.push(
      pc(rootX * 0.35 - 4 + lean * 0.65, -18 * scale, -8 + lean, -8 * scale, -7, 2, vine, 1.1 * scale, { minWidth: 0.85 * scale }),
      pc(rootX * 0.35 + 6 + lean * 0.65, -20 * scale, 9, -10 * scale, 8, 1, vine, 1.1 * scale, { minWidth: 0.85 * scale }),
    );
  }
  if (biome === "salt marshes") {
    out.push(pe(rootX * 0.25 - 6 + lean, -12 * scale, 4 * scale, 2.2 * scale, -0.3, mixHex(t.high, "#5a6e46", 0.35), 0.5));
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
