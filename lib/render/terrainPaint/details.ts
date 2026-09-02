import { TILE_H } from "../../iso";
import type { BiomeName, SimState } from "../../types";
import { fogAt } from "../../sim/fog";
import { biomeMaterials, fogTerrainGain, oreCrystalCluster, tileVariant } from "../terrainAtlas";
import type { BiomeMaterials } from "../terrainMaterials";
import { tileToScreen, type Camera } from "../../iso";
import { blockerPropKind, type BlockerPropKind } from "./scatter";
import { mixRgb, rgbOf, withAlpha } from "./style";

export function smoothFogGain(state: SimState, x: number, y: number): number {
  let sum = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      sum += fogTerrainGain(fogAt(state, x + dx, y + dy));
      count += 1;
    }
  }
  return sum / count;
}

function liftGreen(c: { r: number; g: number; b: number }, amount: number): { r: number; g: number; b: number } {
  return { r: c.r, g: Math.min(255, c.g + amount), b: c.b };
}

function blobShadow(ctx: CanvasRenderingContext2D, z: number, rx: number, ry: number, dy = 6): void {
  ctx.fillStyle = "rgba(6,10,12,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, dy * z, rx * z, ry * z, 0, 0, Math.PI * 2);
  ctx.fill();
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
  ctx.closePath();
  ctx.fill();
}

function drawBoulder(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  lush: boolean,
  snowCap: boolean,
  v: number,
): void {
  const twist = ((v % 5) - 2) * 0.35 * z;
  const body = lush ? liftGreen(mats.blocked, 18) : mats.blocked;
  const facet = mixRgb(body, mats.dark, 0.28);
  blobShadow(ctx, z, 16.5, 5.2);
  ctx.fillStyle = rgbOf(mats.dark);
  fillPoly(ctx, [-15 * z, 2.2 * z, 14 * z, 3.1 * z, 10 * z, 9.2 * z, -12 * z, 8.4 * z]);
  ctx.fillStyle = rgbOf(body);
  fillPoly(ctx, [
    -13 * z + twist, 2 * z,
    -6 * z + twist, -8 * z,
    -1 * z, -13 * z,
    13 * z + twist * 0.4, -1.4 * z,
    9 * z, 5.4 * z,
    -10 * z, 5.6 * z,
  ]);
  ctx.fillStyle = rgbOf(facet);
  fillPoly(ctx, [-6 * z, 1 * z, -1 * z, -12 * z, 6 * z, -3 * z, 4 * z, 4 * z]);
  ctx.fillStyle = rgbOf(mixRgb(body, mats.dark, 0.45));
  fillPoly(ctx, [2 * z, 2 * z, 6 * z, -3 * z, 13 * z + twist * 0.4, -1.4 * z, 9 * z, 5.4 * z]);
  ctx.strokeStyle = rgbOf(mixRgb(mats.dark, body, 0.35));
  ctx.lineWidth = Math.max(0.7, 0.85 * z);
  ctx.beginPath();
  ctx.moveTo(-4 * z, -4 * z);
  ctx.lineTo(3 * z, 3 * z);
  ctx.stroke();
  if (lush) {
    withAlpha(ctx, 0.55, () => {
      ctx.fillStyle = rgbOf(liftGreen(mats.high, 12));
      ctx.beginPath();
      ctx.ellipse(-5 * z, -2 * z, 4.2 * z, 2.1 * z, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(4 * z, 1.2 * z, 3.2 * z, 1.6 * z, 0.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  withAlpha(ctx, snowCap ? 0.86 : 0.5, () => {
    ctx.fillStyle = rgbOf(snowCap ? mixRgb(mats.light, { r: 236, g: 244, b: 246 }, 0.55) : mats.light);
    fillPoly(ctx, [-1 * z, -13 * z, 13 * z + twist * 0.4, -1.4 * z, 5 * z, 0.6 * z, -7 * z, -6.4 * z]);
  });
}

function drawSandstone(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const lean = ((v % 5) - 2) * 0.28 * z;
  const base = mixRgb(mats.blocked, mats.high, 0.22);
  const mid = mixRgb(mats.high, mats.light, 0.28);
  const hi = mixRgb(mats.light, { r: 232, g: 210, b: 168 }, 0.35);
  blobShadow(ctx, z, 15.5, 5);
  ctx.fillStyle = rgbOf(mats.dark);
  fillPoly(ctx, [-14 * z, 3 * z, 13 * z, 3.4 * z, 10 * z, 8.6 * z, -11 * z, 8.2 * z]);
  const bands = [
    { y: 4, h: 5.5, c: mixRgb(base, mats.dark, 0.2) },
    { y: -1, h: 5.2, c: base },
    { y: -6, h: 5.0, c: mid },
  ];
  for (const band of bands) {
    ctx.fillStyle = rgbOf(band.c);
    fillPoly(ctx, [
      -12 * z + lean, (band.y + 1.2) * z,
      11 * z + lean * 0.4, (band.y + 0.6) * z,
      9 * z, (band.y - band.h + 1.4) * z,
      -10 * z + lean * 0.2, (band.y - band.h + 1.8) * z,
    ]);
  }
  ctx.fillStyle = rgbOf(hi);
  fillPoly(ctx, [-8 * z, -9.2 * z, 1 * z, -12.4 * z, 9 * z, -8.4 * z, 6 * z, -6.6 * z, -5 * z, -7.2 * z]);
  ctx.strokeStyle = rgbOf(mixRgb(mats.dark, base, 0.4));
  ctx.lineWidth = Math.max(0.65, 0.75 * z);
  ctx.beginPath();
  ctx.moveTo(-9 * z, -1.2 * z);
  ctx.lineTo(8 * z, -2.4 * z);
  ctx.moveTo(-8 * z, 3.2 * z);
  ctx.lineTo(7 * z, 2.2 * z);
  ctx.stroke();
}

function drawCanopyTree(
  ctx: CanvasRenderingContext2D,
  mats: BiomeMaterials,
  z: number,
  v: number,
  biome: BiomeName,
): void {
  const lean = ((v % 5) - 2) * z * 0.55;
  const dark = mixRgb(mats.high, mats.blocked, 0.28);
  const mid = liftGreen(mats.high, 28);
  const hi = mats.light;
  const wood = mixRgb(mats.dark, { r: 62, g: 42, b: 28 }, 0.45);
  blobShadow(ctx, z, 18.5, 5.6);
  ctx.strokeStyle = rgbOf(wood);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3.2, 5.2 * z);
  ctx.beginPath();
  ctx.moveTo(-2.4 * z, 6.2 * z);
  ctx.lineTo(2.2 * z, 6.2 * z);
  ctx.stroke();
  ctx.lineWidth = Math.max(2.4, 3.6 * z);
  ctx.beginPath();
  ctx.moveTo(0, 6 * z);
  ctx.quadraticCurveTo(lean * 0.35, -4 * z, lean, -18 * z);
  ctx.stroke();
  const lobes = [
    { x: -10, y: -16, rx: 14.5, ry: 9.2, rot: -0.08, c: dark },
    { x: 7, y: -20, rx: 12.2, ry: 8.2, rot: 0.14, c: mid },
    { x: -2, y: -23, rx: 10.5, ry: 7.2, rot: -0.12, c: mid },
    { x: 11, y: -15, rx: 8.4, ry: 5.6, rot: 0.22, c: dark },
    { x: -12, y: -12, rx: 7.6, ry: 5.0, rot: -0.18, c: dark },
    { x: 2, y: -26, rx: 6.4, ry: 4.2, rot: -0.05, c: hi },
  ];
  const count = 5 + (v % 2);
  for (let i = 0; i < count; i++) {
    const lobe = lobes[i]!;
    withAlpha(ctx, i === 5 ? 0.55 : 1, () => {
      ctx.fillStyle = rgbOf(lobe.c);
      ctx.beginPath();
      ctx.ellipse(lobe.x * z + lean * 0.35, lobe.y * z, lobe.rx * z, lobe.ry * z, lobe.rot, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  if (biome === "jungle wreckage" && v % 3 !== 1) {
    ctx.strokeStyle = rgbOf(mixRgb(dark, { r: 40, g: 90, b: 48 }, 0.4));
    ctx.lineWidth = Math.max(0.85, 1.1 * z);
    ctx.beginPath();
    ctx.moveTo(-4 * z + lean, -18 * z);
    ctx.quadraticCurveTo(-8 * z + lean, -8 * z, -7 * z, 2 * z);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6 * z + lean, -20 * z);
    ctx.quadraticCurveTo(9 * z, -10 * z, 8 * z, 1 * z);
    ctx.stroke();
  }
  if (biome === "salt marshes") {
    withAlpha(ctx, 0.5, () => {
      ctx.fillStyle = rgbOf(mixRgb(mats.high, { r: 90, g: 110, b: 70 }, 0.35));
      ctx.beginPath();
      ctx.ellipse(-6 * z + lean, -12 * z, 4 * z, 2.2 * z, -0.3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawPine(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number, snow: boolean): void {
  const lean = ((v % 3) - 1) * z * 0.3;
  const needle = mixRgb(mats.high, { r: 48, g: 96, b: 62 }, 0.35);
  const dark = mixRgb(mats.mid, needle, 0.4);
  blobShadow(ctx, z, 14.5, 4.8);
  ctx.strokeStyle = rgbOf(mats.dark);
  ctx.lineWidth = Math.max(1.8, 2.8 * z);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 6.2 * z);
  ctx.lineTo(lean, -10 * z);
  ctx.stroke();
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const w = (17.5 - i * 2.7) * z;
    const y = (-2 - i * 6.2) * z;
    ctx.fillStyle = rgbOf(i >= tiers - 2 ? mixRgb(needle, mats.light, 0.16) : dark);
    fillPoly(ctx, [-w + lean, y + 7.4 * z, lean, y - 6.2 * z, w + lean, y + 7.4 * z]);
    if (snow && i >= 2) {
      withAlpha(ctx, 0.55, () => {
        ctx.fillStyle = rgbOf(mixRgb(mats.light, { r: 236, g: 244, b: 246 }, 0.5));
        fillPoly(ctx, [
          -w * 0.35 + lean, y + 1.2 * z,
          lean, y - 6.2 * z,
          w * 0.35 + lean, y + 1.2 * z,
        ]);
      });
    }
  }
}

function drawDeadTree(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const wood = mixRgb(mats.dark, mats.blocked, 0.25);
  const lean = ((v % 5) - 2) * z * 0.3;
  blobShadow(ctx, z, 11, 3.6);
  ctx.strokeStyle = rgbOf(wood);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.7, 2.5 * z);
  ctx.beginPath();
  ctx.moveTo(0, 5.4 * z);
  ctx.quadraticCurveTo(lean * 0.4, -4 * z, lean, -16 * z);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.05, 1.45 * z);
  ctx.beginPath();
  ctx.moveTo(lean * 0.3, -5 * z);
  ctx.lineTo(-7.2 * z, -12 * z);
  ctx.moveTo(lean * 0.4, -8 * z);
  ctx.lineTo(6.4 * z, -14 * z);
  ctx.moveTo(lean * 0.5, -11 * z);
  ctx.lineTo(-3.2 * z, -17 * z);
  ctx.moveTo(lean * 0.45, -7 * z);
  ctx.lineTo(4.2 * z, -9.5 * z);
  ctx.stroke();
}

function drawCrystalOutcrop(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const gem = mixRgb(mats.ore, mats.light, 0.42);
  const dark = mixRgb(mats.dark, mats.ore, 0.38);
  const inner = mixRgb(gem, { r: 230, g: 255, b: 248 }, 0.4);
  blobShadow(ctx, z, 13, 4.2);
  ctx.fillStyle = rgbOf(mixRgb(mats.blocked, mats.dark, 0.2));
  fillPoly(ctx, [-11 * z, 3.4 * z, 12 * z, 3.6 * z, 8 * z, 7.2 * z, -8 * z, 7 * z]);
  const shards = [
    { lean: -7, rise: 13, half: 4.0, gem: false },
    { lean: -1, rise: 16, half: 3.2, gem: true },
    { lean: 3, rise: 20, half: 3.5, gem: true },
    { lean: 9, rise: 12, half: 3.6, gem: false },
    { lean: 5, rise: 10, half: 2.6, gem: false },
  ];
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i]!;
    const twist = ((v >>> (i * 2)) % 5 - 2) * 0.4;
    ctx.fillStyle = rgbOf(shard.gem ? gem : dark);
    fillPoly(ctx, [
      (shard.lean - shard.half) * z, 3.2 * z,
      (shard.lean + twist) * z, -shard.rise * z,
      (shard.lean + shard.half) * z, 2.6 * z,
    ]);
  }
  withAlpha(ctx, 0.5, () => {
    ctx.fillStyle = rgbOf(inner);
    fillPoly(ctx, [1.2 * z, -2 * z, 2.4 * z, -17 * z, 5 * z, -1.2 * z]);
  });
}

function drawWreckage(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const rust = mixRgb(mats.ore, mats.blocked, 0.28);
  const iron = mixRgb(mats.dark, mats.blocked, 0.15);
  const seam = mixRgb(mats.light, rust, 0.4);
  blobShadow(ctx, z, 15, 4.6);
  ctx.fillStyle = rgbOf(iron);
  fillPoly(ctx, [-13 * z, 3.2 * z, 3 * z, -7.2 * z, 14 * z, 1.2 * z, 9 * z, 7.4 * z, -10 * z, 7.2 * z]);
  ctx.fillStyle = rgbOf(rust);
  fillPoly(ctx, [-6.5 * z, 1.2 * z, 7.4 * z, -4.4 * z, 11 * z, 2.2 * z, -3.2 * z, 5.2 * z]);
  ctx.fillStyle = rgbOf(mixRgb(iron, mats.light, 0.16));
  fillPoly(ctx, [-10 * z, 2 * z, -2 * z, -3 * z, 1.4 * z, 1.6 * z, -7 * z, 5 * z]);
  ctx.strokeStyle = rgbOf(seam);
  ctx.lineWidth = Math.max(0.85, 1.15 * z);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8 * z, 2 * z);
  ctx.lineTo(6 * z, -2 * z + (v % 3) * z * 0.4);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.1, 1.6 * z);
  ctx.beginPath();
  ctx.moveTo(8 * z, 1 * z);
  ctx.lineTo(13 * z, -8 * z);
  ctx.stroke();
  ctx.fillStyle = rgbOf(mixRgb(seam, mats.dark, 0.3));
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse((-6 + i * 3.2) * z, (1.4 + (i % 2) * 0.7) * z, 0.55 * z, 0.4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpire(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const rock = mixRgb(mats.blocked, mats.dark, 0.2);
  const glow = mixRgb(mats.ore, { r: 210, g: 80, b: 36 }, 0.4);
  blobShadow(ctx, z, 11, 3.8);
  withAlpha(ctx, 0.45, () => {
    ctx.fillStyle = rgbOf(mixRgb(mats.dark, glow, 0.25));
    ctx.beginPath();
    ctx.ellipse(0, 5.4 * z, 9.5 * z, 3.2 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = rgbOf(rock);
  fillPoly(ctx, [-8 * z, 5.2 * z, -2.4 * z, -17 * z, 2.6 * z, -9 * z, 8.4 * z, 5.2 * z, -4.2 * z, 7.2 * z]);
  withAlpha(ctx, 0.58, () => {
    ctx.fillStyle = rgbOf(glow);
    fillPoly(ctx, [-1.2 * z, 2.4 * z, -1.6 * z, -15 * z, 1.8 * z, -6.4 * z]);
  });
  ctx.strokeStyle = rgbOf(mixRgb(glow, { r: 255, g: 140, b: 60 }, 0.35));
  ctx.lineWidth = Math.max(0.7, 0.85 * z);
  ctx.beginPath();
  ctx.moveTo(-0.4 * z, 3 * z);
  ctx.lineTo(-1.2 * z, -14 * z);
  ctx.stroke();
  if (v % 2 === 0) {
    withAlpha(ctx, 0.3, () => {
      ctx.fillStyle = rgbOf(mats.light);
      fillPoly(ctx, [-2.2 * z, -10 * z, -2.2 * z, -17 * z, 0.8 * z, -11 * z]);
    });
  }
}

function drawDeadShrub(ctx: CanvasRenderingContext2D, mats: BiomeMaterials, z: number, v: number): void {
  const wood = mixRgb(mats.dark, mats.blocked, 0.2);
  const dust = mixRgb(mats.light, mats.blocked, 0.35);
  const lean = ((v % 3) - 1) * z * 0.4;
  blobShadow(ctx, z, 11.5, 3.6);
  ctx.strokeStyle = rgbOf(wood);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.25, 1.8 * z);
  ctx.beginPath();
  ctx.moveTo(0, 5.2 * z);
  ctx.lineTo(lean, -9 * z);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.9, 1.15 * z);
  ctx.beginPath();
  ctx.moveTo(-0.5 * z, -2.4 * z);
  ctx.lineTo(-7.4 * z, -8.4 * z);
  ctx.moveTo(0.6 * z, -3.6 * z);
  ctx.lineTo(7.2 * z, -9.6 * z);
  ctx.moveTo(lean * 0.4, -6 * z);
  ctx.lineTo(2.4 * z, -13 * z);
  ctx.moveTo(lean * 0.3, -5 * z);
  ctx.lineTo(-3.4 * z, -11 * z);
  ctx.moveTo(0.2 * z, -4 * z);
  ctx.lineTo(4.6 * z, -6.4 * z);
  ctx.stroke();
  withAlpha(ctx, 0.55, () => {
    ctx.fillStyle = rgbOf(dust);
    ctx.beginPath();
    ctx.ellipse(-4.4 * z, -7.4 * z, 3.4 * z, 1.7 * z, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4.6 * z, -8.4 * z, 3.0 * z, 1.5 * z, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1.2 * z, -11.2 * z, 2.2 * z, 1.15 * z, 0.1, 0, Math.PI * 2);
    ctx.fill();
  });
}

function paintBlocker(
  ctx: CanvasRenderingContext2D,
  kind: BlockerPropKind,
  mats: BiomeMaterials,
  z: number,
  v: number,
  lush: boolean,
  biome: BiomeName,
): void {
  switch (kind) {
    case "tree":
      drawCanopyTree(ctx, mats, z, v, biome);
      return;
    case "pine":
      drawPine(ctx, mats, z, v, biome === "tundra grid");
      return;
    case "deadTree":
      drawDeadTree(ctx, mats, z, v);
      return;
    case "crystalOutcrop":
      drawCrystalOutcrop(ctx, mats, z, v);
      return;
    case "wreckage":
      drawWreckage(ctx, mats, z, v);
      return;
    case "spire":
      drawSpire(ctx, mats, z, v);
      return;
    case "deadShrub":
      drawDeadShrub(ctx, mats, z, v);
      return;
    case "sandstone":
      drawSandstone(ctx, mats, z, v);
      return;
    case "snowRock":
      drawBoulder(ctx, mats, z, false, true, v);
      return;
    case "boulder":
      drawBoulder(ctx, mats, z, lush, false, v);
      return;
  }
}

export function drawBlockerProp(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  x: number,
  y: number,
  sx: number,
  sy: number,
  z: number,
): void {
  const v = tileVariant(state.seed, x, y);
  const mats = biomeMaterials(state.biome);
  const kind = blockerPropKind(state.biome, v);
  const ox = ((v % 7) - 3) * z * 0.4;
  const oy = ((Math.floor(v / 11) % 5) - 2) * z * 0.2;
  ctx.save();
  ctx.translate(sx + ox, sy + TILE_H * z * 0.42 + oy);
  const lush = state.biome === "jungle wreckage" || state.biome === "salt marshes";
  paintBlocker(ctx, kind, mats, z, v, lush, state.biome);
  ctx.restore();
}

export function rgbMix(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): string {
  return rgbOf(mixRgb(a, b, t));
}

export function drawOreCrystals(
  ctx: CanvasRenderingContext2D,
  state: SimState,
  cam: Camera,
  x: number,
  y: number,
  elev: number,
  z: number,
): void {
  const cluster = oreCrystalCluster(state, x, y);
  if (!cluster) return;
  const mats = biomeMaterials(state.biome);
  const s = tileToScreen(x, y, cam, elev);
  const gemDark = rgbMix(mats.ore, mats.dark, 0.42);
  const gem = rgbMix(mats.ore, mats.light, 0.38);
  const gemHi = rgbMix(mats.light, { r: 255, g: 246, b: 210 }, 0.62);
  ctx.save();
  ctx.translate(s.x, s.y);
  const alpha = ctx.globalAlpha * cluster.intensity;
  ctx.fillStyle = `rgb(${mats.dark.r},${mats.dark.g},${mats.dark.b})`;
  for (const burst of cluster.bursts) {
    ctx.globalAlpha = alpha * 0.32;
    ctx.beginPath();
    ctx.ellipse(burst.dx * z, burst.dy * z + 1.1 * z, 6.2 * z, 2.35 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  for (const shard of cluster.shards) {
    const ox = shard.dx * z;
    const oy = shard.dy * z;
    const tipX = ox + shard.lean * z;
    const tipY = oy - shard.rise * z;
    const vx = tipX - ox;
    const vy = tipY - oy;
    const len = Math.hypot(vx, vy);
    if (len < 0.5 * z) continue;
    const ux = vx / len;
    const uy = vy / len;
    const px = -uy;
    const py = ux;
    const half = shard.half * z;
    const buried = shard.buried * z;
    const midT = 0.34 + shard.twist * 0.05;
    const bx = ox - ux * buried;
    const by = oy - uy * buried;
    const mx = bx + (tipX - bx) * midT;
    const my = by + (tipY - by) * midT;
    const ntx = tipX - ux * 0.55 * z;
    const nty = tipY - uy * 0.55 * z;
    const baseW = half * 0.42;
    const midW = half;
    const tipW = half * 0.16;
    const baseL = { x: bx + px * baseW, y: by + py * baseW };
    const baseR = { x: bx - px * baseW, y: by - py * baseW };
    const midL = { x: mx + px * midW, y: my + py * midW };
    const midR = { x: mx - px * midW, y: my - py * midW };
    const tipL = { x: ntx + px * tipW, y: nty + py * tipW };
    const tipR = { x: ntx - px * tipW, y: nty - py * tipW };
    ctx.fillStyle = gemDark;
    ctx.beginPath();
    ctx.moveTo(baseL.x, baseL.y);
    ctx.lineTo(midL.x, midL.y);
    ctx.lineTo(tipL.x, tipL.y);
    ctx.lineTo(tipR.x, tipR.y);
    ctx.lineTo(midR.x, midR.y);
    ctx.lineTo(baseR.x, baseR.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.moveTo(baseL.x, baseL.y);
    ctx.lineTo(midL.x, midL.y);
    ctx.lineTo(tipL.x, tipL.y);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(bx + ux * buried * 0.2, by + uy * buried * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gemHi;
    ctx.globalAlpha = alpha * 0.7;
    const hx = bx + ux * len * 0.14;
    const hy = by + uy * len * 0.14;
    ctx.beginPath();
    ctx.moveTo(hx + px * half * 0.12, hy + py * half * 0.12);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(hx - px * half * 0.22, hy - py * half * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha * 0.82;
    ctx.strokeStyle = gemHi;
    ctx.lineWidth = Math.max(0.65, 0.55 * z);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
}
